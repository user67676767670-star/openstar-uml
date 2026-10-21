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
    if (typeof document === 'undefined' || !document || !document.body) return; // page torn down mid-flight
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
      var s = String(dataUrl);
      // only accept well-formed image data URLs; anything else (e.g. a
      // javascript:/data:text/html URL smuggled in as "content") is refused
      if (!/^data:image\/(png|svg\+xml|jpeg);base64,[A-Za-z0-9+/=]*$/.test(s)) {
        return Promise.reject(new Error('writeBase64File expects an image data URL'));
      }
      var name = String(path).split(/[\\/]/).pop();
      download(name, s, true);
      return Promise.resolve(true);
    },

    onMenuCommand: function (cb) { menuHandlers.push(cb); },

    getAppInfo: function () {
      return Promise.resolve({ version: '1.0.0', electron: '', chrome: '', name: 'OpenStar UML' });
    },

    openExternal: function (url) {
      // never hand non-http(s) schemes (javascript:, data:, file:) to the
      // browser — they would execute in the victim's context
      if (!/^https?:\/\//i.test(String(url))) return Promise.resolve(false);
      global.open(String(url), '_blank', 'noopener,noreferrer');
      return Promise.resolve(true);
    },

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
      // Build the print document with DOM APIs instead of document.write and
      // set the image via .src assignment — a raw data URL interpolated into
      // an HTML string would allow script injection (XSS).
      var w = global.open('', '_blank', 'noopener');
      if (w) {
        try {
          var doc = w.document;
          doc.title = 'Print Diagram';
          doc.body.style.margin = '0';
          doc.body.style.textAlign = 'center';
          var img = doc.createElement('img');
          img.style.maxWidth = '100%';
          img.onload = function () { try { w.focus(); w.print(); } catch (e) { /* ignore */ } };
          img.src = String(dataUrl); // attribute assignment, never parsed as HTML
          doc.body.appendChild(img);
          doc.close();
        } catch (e) { /* popup blocked or torn down */ }
      }
      return Promise.resolve(true);
    },

    closeWindow: function () {
      try { global.close(); } catch (e) { /* tabs not opened by script can't self-close */ }
      return Promise.resolve(true);
    },

    onCloseRequested: function () { return Promise.resolve(false); }
  };

  global.OpenStar = bridge;
})(typeof window !== 'undefined' ? window : globalThis);
