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

  mainWindow.on('closed', () => { mainWindow = null; });

  // external links open in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
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

/* ---------- IPC ---------- */

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
  return res.filePath;
});

ipcMain.handle('fs:read', async (_e, p) => {
  return fs.readFileSync(p, 'utf8');
});

ipcMain.handle('fs:write', async (_e, p, text) => {
  fs.writeFileSync(p, text, 'utf8');
  return true;
});

ipcMain.handle('fs:writeBase64', async (_e, p, dataUrl) => {
  const m = /^data:[^;]+;base64,(.*)$/s.exec(String(dataUrl));
  const b64 = m ? m[1] : String(dataUrl);
  fs.writeFileSync(p, Buffer.from(b64, 'base64'));
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

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('print:image', async (event, dataUrl) => {
  // data URLs can exceed Chromium's URL length limit for big diagrams →
  // write a temp PNG and print that instead
  const m = /^data:[^;]+;base64,([\s\S]*)$/.exec(String(dataUrl));
  const tmp = path.join(app.getPath('temp'), 'openstar-print-' + Date.now() + '.png');
  fs.writeFileSync(tmp, Buffer.from(m ? m[1] : String(dataUrl), 'base64'));
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  try {
    await win.loadURL('file://' + tmp);
    await new Promise((resolve) => {
      win.webContents.print({ silent: false, printBackground: true }, () => resolve());
    });
  } finally {
    setTimeout(() => {
      if (!win.isDestroyed()) win.close();
      try { fs.unlinkSync(tmp); } catch (e) { /* ignore */ }
    }, 500);
  }
  return true;
});
