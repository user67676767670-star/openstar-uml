/*
 * OpenStar UML — browser fallback bridge.
 * Provides the same API surface as main/preload.js (window.OpenStar) using
 * File input / download links / localStorage, so the renderer works when
 * index.html is opened outside Electron.
 */
(function (global) {
  'use strict';
  if (global.OpenStar && global.OpenStar.isElectron) return; // preload wins

  function download(name, blobOrUrl, isUrl) {
    var a = document.createElement('a');
    if (isUrl) a.href = blobOrUrl;
    else a.href = URL.createObjectURL(blobOrUrl);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      if (!isUrl) URL.revokeObjectURL(a.href);
    }, 100);
  }

  var menuHandlers = [];

  var bridge = {
    isElectron: false,

    openFileDialog: function (accept) {
      return new Promise(function (resolve) {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = accept || '.mdj,.json';
        input.addEventListener('change', function () {
          var f = input.files && input.files[0];
          if (!f) { resolve(null); return; }
          var reader = new FileReader();
          reader.onload = function () { resolve({ path: f.name, name: f.name, text: String(reader.result) }); };
          reader.onerror = function () { resolve(null); };
          reader.readAsText(f);
        });
        // resolve null if dialog dismissed (best effort)
        var fired = false;
        input.addEventListener('cancel', function () { if (!fired) { fired = true; resolve(null); } });
        input.click();
      });
    },

    saveFileDialog: function (defaultName) {
      // browsers cannot pick a save path; return the default name and
      // writeFile triggers a download
      return Promise.resolve(defaultName || 'untitled.mdj');
    },

    writeFile: function (path, text) {
      var name = String(path).split(/[\\/]/).pop();
      download(name, new Blob([text], { type: 'text/plain;charset=utf-8' }), false);
      return Promise.resolve(true);
    },

    writeBase64File: function (path, dataUrl) {
      var name = String(path).split(/[\\/]/).pop();
      download(name, dataUrl, true);
      return Promise.resolve(true);
    },

    onMenuCommand: function (cb) { menuHandlers.push(cb); },

    getAppInfo: function () {
      return Promise.resolve({ version: '1.0.0', electron: '', chrome: '', name: 'OpenStar UML' });
    },

    openExternal: function (url) { global.open(url, '_blank'); return Promise.resolve(true); },

    getRecentFiles: function () {
      try { return JSON.parse(localStorage.getItem('openstar-recent') || '[]'); }
      catch (e) { return []; }
    },
    addRecentFile: function (entry) {
      var list = bridge.getRecentFiles().filter(function (r) { return r.path !== entry.path; });
      list.unshift(entry);
      try { localStorage.setItem('openstar-recent', JSON.stringify(list.slice(0, 10))); } catch (e) { }
      return Promise.resolve(true);
    },

    printDiagram: function (dataUrl) {
      var w = global.open('', '_blank');
      if (w) {
        w.document.write('<html><head><title>Print Diagram</title></head><body style="margin:0;text-align:center"><img src="' + dataUrl + '" style="max-width:100%"/><script>window.onload=function(){window.print();}<\/script></body></html>');
        w.document.close();
      }
      return Promise.resolve(true);
    }
  };

  global.OpenStar = bridge;
})(typeof window !== 'undefined' ? window : globalThis);
