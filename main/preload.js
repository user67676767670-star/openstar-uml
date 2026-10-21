/*
 * OpenStar UML — preload: secure contextBridge API for the renderer.
 */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

/* Keep our own registry so repeated subscriptions ADD listeners instead of
 * wiping previously registered callbacks (the old removeAllListeners approach
 * broke re-registration: only the last callback ever fired). */
const channelSubs = {}; // channel → [{rawListener, userCb}]

function subscribe(channel, cb) {
  if (typeof cb !== 'function') return () => {};
  if (!channelSubs[channel]) channelSubs[channel] = [];
  const rawListener = (_e, arg) => { try { cb(arg); } catch (err) { console.error(err); } };
  channelSubs[channel].push({ rawListener, userCb: cb });
  ipcRenderer.on(channel, rawListener);
  return () => unsubscribe(channel, cb);
}

function unsubscribe(channel, cb) {
  const list = channelSubs[channel] || [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (!cb || list[i].userCb === cb) {
      ipcRenderer.removeListener(channel, list[i].rawListener);
      list.splice(i, 1);
      if (cb) return;
    }
  }
}

// defensive: never let a throwing listener break IPC delivery
process.on('unhandledRejection', (err) => console.error(err));

contextBridge.exposeInMainWorld('OpenStar', {
  isElectron: true,

  openFileDialog: (accept) => ipcRenderer.invoke('dialog:open', accept),
  saveFileDialog: (defaultName, ext) => ipcRenderer.invoke('dialog:save', defaultName, ext),
  readFile: (path) => ipcRenderer.invoke('fs:read', path),
  writeFile: (path, text) => ipcRenderer.invoke('fs:write', path, text),
  writeBase64File: (path, dataUrl) => ipcRenderer.invoke('fs:writeBase64', path, dataUrl),

  onMenuCommand: (cb) => subscribe('menu-command', cb),

  getAppInfo: () => ipcRenderer.invoke('app:info'),
  openExternal: (url) => ipcRenderer.invoke('shell:open', url),

  getLaunchFile: () => ipcRenderer.invoke('app:launchFile'),
  onOpenFile: (cb) => subscribe('open-file', cb),

  getRecentFilesSync: () => ipcRenderer.sendSync('recent:get'),
  addRecentFile: (entry) => ipcRenderer.send('recent:add', entry),
  setMenuState: (states) => ipcRenderer.send('menu:state', states),

  printDiagram: (dataUrl) => ipcRenderer.invoke('print:image', dataUrl),
  closeWindow: (force) => ipcRenderer.send('window:close', !!force),
  onCloseRequested: (cb) => {
    ipcRenderer.removeAllListeners('close-requested');
    ipcRenderer.on('close-requested', () => cb());
  }
});
