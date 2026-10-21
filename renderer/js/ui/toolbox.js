/*
 * OpenStar UML — Toolbox (vertical tool strip beside the canvas).
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};
  var meta = OS.meta, icons = OS.icons;

  function Toolbox(host, app) {
    this.host = host;
    this.app = app;
    this.diagramType = null;
    this.activeTool = null;
    this.buttons = [];
    host.classList.add('toolbox');
  }

  Toolbox.prototype.setDiagramType = function (type) {
    this.diagramType = type;
    this.activeTool = null;
    this.render();
  };

  Toolbox.prototype.render = function () {
    var self = this;
    this.host.innerHTML = '';
    this.buttons = [];
    var d = meta.DIAGRAMS[this.diagramType] || meta.DIAGRAMS['GenericDiagram'];

    function addButton(tool, label, iconKey) {
      var b = document.createElement('button');
      b.className = 'tool-btn' + (self.activeTool && self.activeTool.tool === tool.tool ? ' active' : '');
      b.innerHTML = icons.svg(iconKey, 20);
      b.title = label;
      b.addEventListener('click', function () {
        if (self.activeTool === tool) self.setTool(null);
        else self.setTool(tool);
      });
      self.host.appendChild(b);
      self.buttons.push({ btn: b, tool: tool });
    }

    addButton({ tool: 'pointer', label: 'Pointer', kind: 'pointer' }, 'Pointer (Esc)', 'pointer');
    (d.toolbox || []).forEach(function (t) {
      addButton(t, t.label, iconKeyFor(t));
    });

    function iconKeyFor(t) {
      if (icons.TYPE_ICON[t.modelType] && t.tool === t.modelType.replace('UML', '').toLowerCase()) return icons.TYPE_ICON[t.modelType];
      // preset-specific icons
      var presetMap = {
        'directed-association': 'directed-association', 'aggregation': 'aggregation', 'composition': 'composition',
        'boundary': 'boundary', 'initial': 'initial', 'final': 'final', 'choice': 'choice', 'junction': 'junction',
        'fork': 'fork', 'join': 'join', 'shallowhistory': 'shallowhistory', 'deephistory': 'deephistory',
        'entrypoint': 'entrypoint', 'exitpoint': 'exitpoint', 'terminate': 'terminate',
        'async-message': 'async-message', 'reply-message': 'reply-message', 'create-message': 'create-message',
        'delete-message': 'delete-message', 'self-message': 'self-message', 'combined-fragment': 'combined-fragment',
        'assembly': 'assembly', 'provided': 'provided', 'required': 'required', 'comm-path': 'comm-path',
        'interface-realization': 'interfacerealization', 'notelink': 'notelink', 'note': 'note',
        'objectflow': 'objectflow', 'controlflow': 'controlflow'
      };
      if (presetMap[t.tool] && icons.has(presetMap[t.tool])) return presetMap[t.tool];
      if (icons.TYPE_ICON[t.modelType]) return icons.TYPE_ICON[t.modelType];
      return t.tool;
    }
  };

  Toolbox.prototype.setTool = function (tool) {
    this.activeTool = tool && tool.kind !== 'pointer' ? tool : null;
    this.buttons.forEach(function (b) {
      var isActive = (b.tool === tool) || (tool && tool.kind === 'pointer' && b.tool.tool === 'pointer') || (!tool && b.tool.tool === 'pointer');
      b.btn.classList.toggle('active', !!isActive);
    });
    this.app.editor.setTool(this.activeTool);
  };

  OS.Toolbox = Toolbox;
})(typeof window !== 'undefined' ? window : globalThis);
