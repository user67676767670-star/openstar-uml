/*
 * OpenStar UML — preload: secure contextBridge API for the renderer.
 */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('OpenStar', {
  isElectron: true,

  openFileDialog: (accept) => ipcRenderer.invoke('dialog:open', accept),
  saveFileDialog: (defaultName, ext) => ipcRenderer.invoke('dialog:save', defaultName, ext),
  readFile: (path) => ipcRenderer.invoke('fs:read', path),
  writeFile: (path, text) => ipcRenderer.invoke('fs:write', path, text),
  writeBase64File: (path, dataUrl) => ipcRenderer.invoke('fs:writeBase64', path, dataUrl),

  onMenuCommand: (cb) => {
    ipcRenderer.removeAllListeners('menu-command');
    ipcRenderer.on('menu-command', (_e, cmd) => cb(cmd));
  },

  getAppInfo: () => ipcRenderer.invoke('app:info'),
  openExternal: (url) => ipcRenderer.invoke('shell:open', url),

  getLaunchFile: () => ipcRenderer.invoke('app:launchFile'),
  onOpenFile: (cb) => {
    ipcRenderer.removeAllListeners('open-file');
    ipcRenderer.on('open-file', (_e, p) => cb(p));
  },

  getRecentFilesSync: () => ipcRenderer.sendSync('recent:get'),
  addRecentFile: (entry) => ipcRenderer.send('recent:add', entry),
  setMenuState: (states) => ipcRenderer.send('menu:state', states),

  printDiagram: (dataUrl) => ipcRenderer.invoke('print:image', dataUrl),
  closeWindow: () => ipcRenderer.send('window:close')
});
