/*
 * OpenStar UML — Electron main process.
 */
'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const { buildAppMenu } = require('./menu.js');

let mainWindow = null;
let launchFile = null;
let menuStates = {};
/* Must live at module scope: the 'window:close' IPC handler below sets this
 * flag, but it used to be declared inside createWindow() where the handler
 * could not see it (ReferenceError on close → window could never be closed
 * after a "Don't Save" choice). */
let forceClose = false;

/* DoS guard: refuse absurdly large model files instead of freezing/OOMing. */
const MAX_FILE_BYTES = 64 * 1024 * 1024; // 64 MB

function statLimited(p) {
  const st = fs.statSync(p);
  if (!st.isFile()) throw new Error('Not a file: ' + p);
  if (st.size > MAX_FILE_BYTES) {
    throw new Error('File too large (' + Math.round(st.size / 1048576) + ' MB, limit ' +
      Math.round(MAX_FILE_BYTES / 1048576) + ' MB)');
  }
  return st;
}

/* ---------- single instance ---------- */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const f = fileFromArgs(argv);
    if (f) openFileInWindow(f);
  });
}

function fileFromArgs(argv) {
  for (const a of argv || []) {
    if (typeof a === 'string' && /\.mdj$/i.test(a) && !a.startsWith('-')) {
      return path.resolve(a);
    }
  }
  return null;
}

/* ---------- recent files ---------- */

function recentPath() { return path.join(app.getPath('userData'), 'recent.json'); }

function getRecent() {
  try { return JSON.parse(fs.readFileSync(recentPath(), 'utf8')); }
  catch (e) { return []; }
}

function addRecent(entry) {
  if (!entry || !entry.path) return;
  let list = getRecent().filter((r) => r.path !== entry.path);
  list.unshift({ path: entry.path, name: entry.name || path.basename(entry.path) });
  list = list.slice(0, 10);
  try { fs.writeFileSync(recentPath(), JSON.stringify(list, null, 2)); } catch (e) { /* ignore */ }
  rebuildMenu();
}

function rebuildMenu() {
  buildAppMenu(() => mainWindow, getRecent, () => menuStates);
}

/* ---------- window ---------- */

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#222428',
    title: 'OpenStar UML',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      autoplayPolicy: 'user-gesture-required'
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('close', (e) => {
    // Ask the renderer to confirm (it shows Save / Don't Save / Cancel when dirty),
    // because Electron silently swallows beforeunload dialogs.
    if (forceClose) return;
    e.preventDefault();
    if (mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('close-requested');
    } else {
      forceClose = true;
      mainWindow.close();
    }
  });

  // Safety net: never let a stray beforeunload handler block closing
  mainWindow.webContents.on('will-prevent-unload', (e) => { e.preventDefault(); });

  mainWindow.on('closed', () => { mainWindow = null; forceClose = false; });

  // external links open in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // In-window navigation to anything but our own content is denied:
  // blocks javascript:/file:/remote redirects coming from injected markup.
  mainWindow.webContents.on('will-navigate', (e, url) => {
    const self = require('url').pathToFileURL(
      path.join(__dirname, '..', 'renderer', 'index.html')).toString();
    if (url !== self) e.preventDefault();
  });
}

function openFileInWindow(p) {
  if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('open-file', p);
  } else {
    launchFile = p;
  }
}

/* ---------- app lifecycle ---------- */

app.whenReady().then(() => {
  launchFile = fileFromArgs(process.argv.slice(1));

  rebuildMenu();
  createWindow();

  if (process.platform === 'darwin') {
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  }
});

app.on('open-file', (event, p) => {   // macOS file association / dock drop
  event.preventDefault();
  if (mainWindow) openFileInWindow(p);
  else launchFile = p;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ---------- crash recovery (autosave) ---------- */

function recoveryPath() { return path.join(app.getPath('userData'), 'recovery.json'); }

ipcMain.handle('recovery:save', (_e, state) => {
  // renderer periodically pushes a compact snapshot so an unsaved project can
  // be offered back after a crash; capped to avoid disk/memory abuse
  const json = JSON.stringify(state || null);
  if (json.length > MAX_FILE_BYTES) throw new Error('Recovery snapshot too large');
  try { fs.writeFileSync(recoveryPath(), json); } catch (e) { /* ignore */ }
  return true;
});

ipcMain.handle('recovery:load', () => {
  try {
    const raw = fs.readFileSync(recoveryPath(), 'utf8');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
});

ipcMain.handle('recovery:clear', () => {
  try { fs.unlinkSync(recoveryPath()); } catch (e) { /* ignore */ }
  return true;
});

/* ---------- IPC ---------- */

/* Security policy for renderer-initiated file access: only paths that the
 * user selected through a native dialog are writable/readable. This prevents
 * a compromised or buggy renderer from reading/writing arbitrary files. */
const MAX_PATH_LEN = 4096;
const recentlyDialoged = new Map(); // resolved path → expiry timestamp
const DIALOG_PATH_TTL_MS = 30 * 60 * 1000;

function rememberDialogPath(p) {
  try {
    recentlyDialoged.set(path.resolve(p), Date.now() + DIALOG_PATH_TTL_MS);
    if (recentlyDialoged.size > 50) {
      const now = Date.now();
      for (const [k, exp] of recentlyDialoged) if (exp < now) recentlyDialoged.delete(k);
    }
  } catch (e) { /* ignore */ }
}

function isAllowedPath(p) {
  if (typeof p !== 'string' || !p || p.indexOf('\0') >= 0 || p.length > MAX_PATH_LEN) return false;
  let abs;
  try { abs = path.resolve(p); } catch (e) { return false; }
  const exp = recentlyDialoged.get(abs);
  if (exp === undefined) return false;
  if (exp < Date.now()) { recentlyDialoged.delete(abs); return false; }
  return true;
}

function atomicWriteFileSync(p, data) {
  const tmp = p + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, data);
  try { fs.unlinkSync(p); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  fs.renameSync(tmp, p);
}

function filtersFor(accept) {
  if (accept && /xmi|xml/i.test(accept)) {
    return [
      { name: 'XMI / XML', extensions: ['xml', 'xmi'] },
      { name: 'All Files', extensions: ['*'] }
    ];
  }
  return [
    { name: 'UML Model', extensions: ['mdj'] },
    { name: 'JSON', extensions: ['json'] },
    { name: 'All Files', extensions: ['*'] }
  ];
}

ipcMain.handle('dialog:open', async (event, accept) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const res = await dialog.showOpenDialog(win, {
    title: 'Open Project',
    filters: filtersFor(accept),
    properties: ['openFile']
  });
  if (res.canceled || !res.filePaths.length) return null;
  const p = res.filePaths[0];
  try { statLimited(p); } catch (e) { throw new Error('Cannot open file: ' + e.message); }
  rememberDialogPath(p);
  const text = fs.readFileSync(p, 'utf8');
  return { path: p, name: path.basename(p), text };
});

ipcMain.handle('dialog:save', async (event, defaultName, ext) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  let filters;
  if (/png/i.test(ext || '')) filters = [{ name: 'PNG Image', extensions: ['png'] }];
  else if (/svg/i.test(ext || '')) filters = [{ name: 'SVG Image', extensions: ['svg'] }];
  else if (/\.xml|\.xmi/i.test(defaultName || '')) filters = [{ name: 'XMI', extensions: ['xml', 'xmi'] }];
  else if (/\.puml/i.test(defaultName || '')) filters = [{ name: 'PlantUML', extensions: ['puml', 'plantuml', 'txt'] }];
  else if (/\.md$/i.test(defaultName || '')) filters = [{ name: 'Markdown', extensions: ['md'] }];
  else filters = [{ name: 'UML Model', extensions: ['mdj'] }];
  const res = await dialog.showSaveDialog(win, {
    title: 'Save',
    defaultPath: defaultName || 'untitled.mdj',
    filters
  });
  if (res.canceled || !res.filePath) return null;
  rememberDialogPath(res.filePath);
  return res.filePath;
});

ipcMain.handle('fs:read', async (_e, p) => {
  if (!isAllowedPath(p)) throw new Error('Access denied: path was not selected in a file dialog');
  statLimited(p);
  return fs.readFileSync(p, 'utf8');
});

ipcMain.handle('fs:write', async (_e, p, text) => {
  if (!isAllowedPath(p)) throw new Error('Access denied: path was not selected in a file dialog');
  const s = String(text);
  if (s.length > MAX_FILE_BYTES) throw new Error('Refusing to write oversized content');
  atomicWriteFileSync(p, s);
  return true;
});

ipcMain.handle('fs:writeBase64', async (_e, p, dataUrl) => {
  if (!isAllowedPath(p)) throw new Error('Access denied: path was not selected in a file dialog');
  const m = /^data:[^;]+;base64,(.*)$/s.exec(String(dataUrl));
  const b64 = m ? m[1] : String(dataUrl);
  if (b64.length > Math.ceil(MAX_FILE_BYTES / 3) * 4 + 8) throw new Error('Refusing to write oversized image');
  atomicWriteFileSync(p, Buffer.from(b64, 'base64'));
  return true;
});

ipcMain.handle('app:info', async () => {
  return {
    name: 'OpenStar UML',
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  };
});

ipcMain.handle('shell:open', async (_e, url) => {
  if (/^https?:\/\//i.test(String(url))) { await shell.openExternal(String(url)); return true; }
  return false;
});

ipcMain.handle('app:launchFile', async () => {
  const f = launchFile;
  launchFile = null;
  return f;
});

ipcMain.on('recent:get', (event) => {
  event.returnValue = getRecent();
});

ipcMain.on('recent:add', (_e, entry) => {
  addRecent(entry);
});

ipcMain.on('menu:state', (_e, states) => {
  menuStates = states || {};
  rebuildMenu();
});

ipcMain.on('window:close', (_e, force) => {
  if (force) forceClose = true;
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('print:image', async (event, dataUrl) => {
  // data URLs can exceed Chromium's URL length limit for big diagrams →
  // write a temp PNG and print that instead
  const m = /^data:[^;]+;base64,([\s\S]*)$/.exec(String(dataUrl));
  if (!m) throw new Error('print:image expects a base64 data URL');
  if (m[1].length > Math.ceil(MAX_FILE_BYTES / 3) * 4 + 8) throw new Error('Image too large to print');
  const tmp = path.join(app.getPath('temp'), 'openstar-print-' + Date.now() + '-' + process.pid + '.png');
  fs.writeFileSync(tmp, Buffer.from(m[1], 'base64'));
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      // the print window loads an untrusted image file — give it no bridge at all
      preload: undefined
    }
  });
  try {
    // file:// URL must be properly encoded (paths with spaces etc.)
    await win.loadURL(require('url').pathToFileURL(tmp).toString());
    await new Promise((resolve) => {
      win.webContents.print({ silent: false, printBackground: true }, () => resolve());
    });
  } finally {
    // always clean up the temp file, even if load/print threw
    try { fs.unlinkSync(tmp); } catch (e) { /* ignore */ }
    if (!win.isDestroyed()) win.close();
  }
  return true;
});
