/* Electron main-process menu builder test (electron module stubbed) */
'use strict';
const Module = require('module');
const path = require('path');

t.suite('electron menu (stubbed)');

const origLoad = Module._load;
let template = null;
Module._load = function (request) {
  if (request === 'electron') {
    return {
      Menu: {
        buildFromTemplate: (tpl) => { template = tpl; return { template: tpl }; },
        setApplicationMenu: () => { }
      },
      app: { name: 'OpenStar UML', getVersion: () => '1.0.0' }
    };
  }
  return origLoad.apply(this, arguments);
};

let menuMod = null, loadErr = null;
try { menuMod = require(path.join(__dirname, '..', 'main', 'menu.js')); }
catch (e) { loadErr = e; }
Module._load = origLoad;

t.ok(!loadErr, 'menu.js loads with stubbed electron' + (loadErr ? ': ' + loadErr.message : ''));
if (menuMod) {
  const sent = [];
  const fakeWin = { webContents: { isDestroyed: () => false, send: (ch, cmd) => sent.push(cmd) } };
  let built = null;
  t.doesNotThrow(() => {
    built = menuMod.buildAppMenu(() => fakeWin, () => [{ path: '/tmp/a.mdj', name: 'a.mdj' }], () => ({ 'toggle-grid': true }));
  }, 'buildAppMenu runs');

  t.ok(Array.isArray(template) && template.length >= 7, 'template has all top-level menus');
  const labels = template.map((m) => m.label);
  ['File', 'Edit', 'Model', 'Format', 'View', 'Tools', 'Help'].forEach((l) => {
    t.ok(labels.includes(l), 'menu present: ' + l);
  });

  const file = template.find((m) => m.label === 'File');
  const saveItem = file.submenu.find((i) => i.label === 'Save');
  t.ok(saveItem && saveItem.accelerator === 'CmdOrCtrl+S', 'Save has native accelerator');
  saveItem.click();
  t.ok(sent.includes('save-project'), 'menu click dispatches command to renderer');

  const edit = template.find((m) => m.label === 'Edit');
  const undoItem = edit.submenu.find((i) => i.label.startsWith('Undo'));
  t.ok(undoItem && undoItem.accelerator === undefined, 'Undo has NO native accelerator (renderer handles it)');
  t.ok(/Ctrl\+Z|⌘Z/.test(undoItem.label), 'Undo label shows shortcut hint');

  const view = template.find((m) => m.label === 'View');
  const gridItem = view.submenu.find((i) => i.label === 'Grid');
  t.ok(gridItem && gridItem.type === 'checkbox' && gridItem.checked === true, 'checkable Grid reflects state');

  const recent = file.submenu.find((i) => i.label === 'Open Recent');
  t.ok(recent && recent.submenu.length === 1 && recent.submenu[0].label === 'a.mdj', 'recent files submenu populated');

  const model = template.find((m) => m.label === 'Model');
  const newDiag = model.submenu.find((i) => i.label === 'New Diagram');
  t.eq(newDiag.submenu.length, 8, 'New Diagram offers all 8 diagram types');

  const help = template.find((m) => m.label === 'Help');
  const about = help.submenu.find((i) => i.label === 'About OpenStar UML');
  about.click();
  t.ok(sent.includes('about'), 'about dispatched');
}
