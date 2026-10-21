/*
 * OpenStar UML — native application menu, built from the shared menu defs.
 * Only file-level accelerators are registered natively (so text inputs keep
 * their native editing keys); all other shortcuts are handled in the renderer
 * with proper focus guards. Their key hints are shown in the labels.
 */
'use strict';
const { Menu, app } = require('electron');
const path = require('path');

// menu-defs.js is a UMD-style module that attaches to globalThis.OS
require(path.join(__dirname, '..', 'renderer', 'js', 'ui', 'menu-defs.js'));
const defs = globalThis.OS.menuDefs.defs;

const NATIVE_ACCELS = new Set(['new-project', 'open-project', 'save-project', 'save-project-as', 'exit']);

function displayAccel(a) {
  if (!a) return '';
  const isMac = process.platform === 'darwin';
  return a.replace('CmdOrCtrl', isMac ? '⌘' : 'Ctrl');
}

function buildTemplate(getWindow, getRecent, getState) {
  const template = [];

  if (process.platform === 'darwin') {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about', label: 'About OpenStar UML' },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  defs.forEach((menuDef) => {
    const submenu = buildItems(menuDef.items, getWindow, getRecent, getState);
    template.push({ label: menuDef.label, submenu });
  });

  return template;
}

function buildItems(items, getWindow, getRecent, getState) {
  const out = [];
  for (const it of items) {
    if (it.sep) { out.push({ type: 'separator' }); continue; }
    if (it.cmd === '__recent__') {
      const recent = getRecent() || [];
      out.push({
        label: 'Open Recent',
        enabled: recent.length > 0,
        submenu: recent.length ? recent.map((r) => ({
          label: r.name || r.path,
          click: () => send(getWindow, 'open-recent:' + r.path)
        })) : [{ label: '(none)', enabled: false }]
      });
      continue;
    }
    if (it.submenu) {
      out.push({ label: it.label, submenu: buildItems(it.submenu, getWindow, getRecent, getState) });
      continue;
    }
    if (it.cmd === 'exit') {
      out.push({ role: 'quit', label: process.platform === 'darwin' ? 'Quit' : 'Exit' });
      continue;
    }
    const native = NATIVE_ACCELS.has(it.cmd);
    const showAccel = it.accel && it.accel.includes('+');
    const entry = {
      label: native ? it.label : (showAccel ? `${it.label}    ${displayAccel(it.accel)}` : it.label),
      accelerator: native ? it.accel : undefined,
      type: it.checkable ? 'checkbox' : 'normal',
      checked: it.checkable && getState ? !!getState(it.cmd) : undefined,
      click: () => send(getWindow, it.cmd)
    };
    out.push(entry);
  }
  return out;
}

function send(getWindow, cmd) {
  const win = getWindow();
  if (win && win.webContents && !win.webContents.isDestroyed()) {
    win.webContents.send('menu-command', cmd);
  }
}

function buildAppMenu(getWindow, getRecent, getState) {
  const menu = Menu.buildFromTemplate(buildTemplate(getWindow, getRecent, getState));
  Menu.setApplicationMenu(menu);
  return menu;
}

module.exports = { buildAppMenu };
