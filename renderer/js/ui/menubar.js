/*
 * OpenStar UML — in-browser fallback menubar (used when not running inside
 * Electron, e.g. opening renderer/index.html directly).
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};
  var dialogs = OS.dialogs;

  function Menubar(host, app) {
    this.host = host;
    this.app = app;
    host.classList.add('menubar');
    this.render();
  }

  function accelText(a) {
    if (!a) return '';
    var isMac = /Mac|iP(hone|ad|od)/.test(navigator.platform || '');
    return a.replace('CmdOrCtrl', isMac ? '⌘' : 'Ctrl')
      .replace('Shift', isMac ? '⇧' : 'Shift')
      .replace(/\+/g, isMac ? '' : '+');
  }

  Menubar.prototype.render = function () {
    var self = this;
    this.host.innerHTML = '';
    var brand = document.createElement('span');
    brand.className = 'menubar-brand';
    brand.textContent = 'OpenStar UML';
    this.host.appendChild(brand);

    OS.menuDefs.defs.forEach(function (menuDef) {
      var btn = document.createElement('button');
      btn.className = 'menubar-item';
      btn.textContent = menuDef.label;
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var items = self.buildItems(menuDef.items);
        var r = btn.getBoundingClientRect();
        dialogs.menu(r.left, r.bottom + 2, items, function (cmd) { self.app.runCommand(cmd); });
      });
      self.host.appendChild(btn);
    });
  };

  Menubar.prototype.buildItems = function (items) {
    var self = this;
    var out = [];
    items.forEach(function (it) {
      if (it.sep) { out.push({ sep: true }); return; }
      if (it.cmd === '__recent__') {
        var recent = self.app.getRecentFiles();
        if (recent.length) {
          out.push({
            label: 'Open Recent', submenu: recent.map(function (r) {
              return { label: r.name, id: 'open-recent:' + r.path };
            })
          });
        }
        return;
      }
      if (it.cmd === 'exit') return; // no quit in browser
      if (it.submenu) {
        out.push({ label: it.label, submenu: self.buildItems(it.submenu) });
        return;
      }
      out.push({
        label: it.label + (it.accel ? '\u2003' + accelText(it.accel) : ''),
        id: it.cmd,
        checkable: it.checkable,
        checked: it.checkable ? self.app.getCommandState(it.cmd) : false,
        enabled: self.app.getCommandEnabled ? self.app.getCommandEnabled(it.cmd) : true
      });
    });
    return out;
  };

  OS.Menubar = Menubar;
})(typeof window !== 'undefined' ? window : globalThis);
