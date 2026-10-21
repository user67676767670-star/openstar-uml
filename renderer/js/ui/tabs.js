/*
 * OpenStar UML — diagram tabs strip.
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};
  var meta = OS.meta, icons = OS.icons, dialogs = OS.dialogs;

  function Tabs(host, app) {
    this.host = host;
    this.app = app;
    this.open = [];       // array of diagram elements
    this.activeId = null;
    host.classList.add('tabs-strip');
  }

  Tabs.prototype.isOpen = function (diagram) {
    return this.open.some(function (d) { return d._id === diagram._id; });
  };

  Tabs.prototype.openDiagram = function (diagram) {
    // drop stale tabs (diagrams deleted elsewhere)
    this.prune();
    if (!this.isOpen(diagram)) this.open.push(diagram);
    this.activeId = diagram._id;
    this.render();
    this.app.onTabActivated(diagram);
  };

  Tabs.prototype.prune = function () {
    var self = this;
    this.open = this.open.filter(function (d) { return !!self.app.project.get(d._id); });
    if (this.activeId && !this.app.project.get(this.activeId)) this.activeId = null;
  };

  Tabs.prototype.closeDiagram = function (diagram) {
    var idx = this.open.indexOf(diagram);
    if (idx < 0) return;
    this.open.splice(idx, 1);
    if (this.activeId === diagram._id) {
      var next = this.open[Math.min(idx, this.open.length - 1)] || null;
      this.activeId = next ? next._id : null;
      this.render();
      this.app.onTabActivated(next);
    } else {
      this.render();
    }
  };

  Tabs.prototype.closeOthers = function (diagram) {
    var self = this;
    this.open.slice().forEach(function (d) { if (d !== diagram) self.closeDiagram(d); });
  };

  Tabs.prototype.closeAll = function () {
    this.open.slice().forEach(this.closeDiagram, this);
  };

  Tabs.prototype.active = function () {
    return this.activeId ? this.app.project.get(this.activeId) : null;
  };

  Tabs.prototype.render = function () {
    var self = this;
    this.prune();
    this.host.innerHTML = '';
    this.open.forEach(function (d) {
      var tab = document.createElement('div');
      tab.className = 'diagram-tab' + (d._id === self.activeId ? ' active' : '');
      tab.innerHTML = icons.iconForType(d._type, 14) + '<span class="tab-label"></span><button class="tab-close" title="Close">✕</button>';
      tab.querySelector('.tab-label').textContent = d.name || '(unnamed)';
      tab.addEventListener('click', function () {
        if (self.activeId !== d._id) {
          self.activeId = d._id;
          self.render();
          self.app.onTabActivated(d);
        }
      });
      tab.addEventListener('dblclick', function () { self.rename(d); });
      tab.addEventListener('auxclick', function (ev) {
        if (ev.button === 1) { ev.preventDefault(); self.closeDiagram(d); }
      });
      tab.addEventListener('contextmenu', function (ev) {
        ev.preventDefault();
        dialogs.menu(ev.clientX, ev.clientY, [
          { label: 'Close', id: 'close' },
          { label: 'Close Others', id: 'closeothers' },
          { label: 'Close All', id: 'closeall' },
          { sep: true },
          { label: 'Rename…', id: 'rename' }
        ], function (id) {
          if (id === 'close') self.closeDiagram(d);
          else if (id === 'closeothers') self.closeOthers(d);
          else if (id === 'closeall') self.closeAll();
          else if (id === 'rename') self.rename(d);
        });
      });
      tab.querySelector('.tab-close').addEventListener('click', function (ev) {
        ev.stopPropagation();
        self.closeDiagram(d);
      });
      self.host.appendChild(tab);
    });
  };

  Tabs.prototype.rename = function (diagram) {
    var self = this;
    dialogs.prompt('Rename Diagram', 'Name:', diagram.name || '').then(function (v) {
      if (v === null) return;
      self.app.renameElement(diagram, v);
    });
  };

  OS.Tabs = Tabs;
})(typeof window !== 'undefined' ? window : globalThis);
