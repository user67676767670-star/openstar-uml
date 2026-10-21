/*
 * OpenStar UML — Model Explorer (tree panel).
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};
  var util = OS.util, meta = OS.meta, model = OS.model, icons = OS.icons, dialogs = OS.dialogs;

  var HIDDEN_CHILD_TYPES = { 'UMLRegion': false /* show children */, 'UMLTag': true, 'UMLAssociationEnd': true, 'UMLNoteLink': true, 'UMLInteractionOperand': false };

  function Explorer(host, app) {
    this.host = host;
    this.app = app;
    this.project = app.project;
    this.expanded = new Set();
    this.selectedId = null;
    this.root = document.createElement('div');
    this.root.className = 'explorer-tree';
    host.appendChild(this.root);
    var self = this;
    host.addEventListener('dragover', function (ev) { ev.preventDefault(); });
    host.addEventListener('drop', function (ev) {
      ev.preventDefault();
      // dropped on empty explorer area → move to project root model
      var id = ev.dataTransfer.getData('application/x-openstar-element');
      if (id) self.app.reparentElement(self.project.get(id), self.project.firstModel());
    });
  }

  Explorer.prototype.refresh = function (keepSelection) {
    var sel = keepSelection ? this.selectedId : this.selectedId;
    this.root.innerHTML = '';
    if (!this.project.root) return;
    // ensure root expanded by default
    if (this.expanded.size === 0) {
      this.expanded.add(this.project.root._id);
      var m0 = this.project.firstModel();
      if (m0) this.expanded.add(m0._id);
    }
    this.root.appendChild(this.buildNode(this.project.root, 0));
    if (sel) {
      var el = this.root.querySelector('[data-id="' + cssEscape(sel) + '"] > .tree-row');
      if (el) el.classList.add('selected');
    }
    this.selectedId = sel;
  };

  function cssEscape(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  Explorer.prototype.childElements = function (el) {
    var out = [];
    ['ownedElements', 'ownedAttributes', 'ownedOperations', 'ownedLiterals'].forEach(function (ln) {
      (el[ln] || []).forEach(function (c) {
        if (HIDDEN_CHILD_TYPES[c._type] === true) return;
        if (c._type === 'UMLRegion') return; // regions are transparent; children shown below
        out.push(c);
      });
    });
    // regions: show their children transparently
    var regions = (el.ownedElements || []).filter(function (c) { return c._type === 'UMLRegion'; });
    regions.forEach(function (r) {
      (r.ownedElements || []).forEach(function (c) {
        if (HIDDEN_CHILD_TYPES[c._type] === true) return;
        if (out.indexOf(c) < 0) out.push(c);
      });
    });
    return out;
  };

  Explorer.prototype.buildNode = function (el, depth) {
    var self = this;
    var wrap = document.createElement('div');
    wrap.className = 'tree-node';
    wrap.dataset.id = el._id;

    var row = document.createElement('div');
    row.className = 'tree-row';
    row.style.paddingLeft = (6 + depth * 14) + 'px';
    if (el._id === this.selectedId) row.classList.add('selected');

    var kids = this.childElements(el);
    var chevron = document.createElement('span');
    chevron.className = 'tree-chev' + (kids.length ? '' : ' none');
    chevron.textContent = this.expanded.has(el._id) ? '▾' : '▸';
    chevron.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (!kids.length) return;
      if (self.expanded.has(el._id)) self.expanded.delete(el._id);
      else self.expanded.add(el._id);
      self.refresh(true);
    });

    var icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.innerHTML = icons.iconForType(el._type, 15);

    var label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = displayLabel(el);
    label.title = meta.label(el._type) + (el.name ? ': ' + el.name : '');

    row.appendChild(chevron);
    row.appendChild(icon);
    row.appendChild(label);
    row.draggable = true;
    wrap.appendChild(row);

    row.addEventListener('click', function (ev) {
      self.select(el);
    });
    row.addEventListener('dblclick', function (ev) {
      ev.stopPropagation();
      if (meta.isDiagramLike(el._type)) self.app.openDiagram(el);
      else self.startRename(el);
    });
    row.addEventListener('contextmenu', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      self.select(el);
      self.showContextMenu(el, ev.clientX, ev.clientY);
    });
    row.addEventListener('dragstart', function (ev) {
      ev.dataTransfer.setData('application/x-openstar-element', el._id);
      ev.dataTransfer.effectAllowed = 'copyMove';
    });
    row.addEventListener('dragover', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      row.classList.add('drop-target');
    });
    row.addEventListener('dragleave', function () { row.classList.remove('drop-target'); });
    row.addEventListener('drop', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      row.classList.remove('drop-target');
      var id = ev.dataTransfer.getData('application/x-openstar-element');
      if (!id) return;
      var dragged = self.project.get(id);
      if (!dragged || dragged === el) return;
      self.app.reparentElement(dragged, el);
    });

    if (kids.length && this.expanded.has(el._id)) {
      var childWrap = document.createElement('div');
      childWrap.className = 'tree-children';
      kids.forEach(function (c) { childWrap.appendChild(self.buildNode(c, depth + 1)); });
      wrap.appendChild(childWrap);
    }
    return wrap;
  };

  function displayLabel(el) {
    if (el._type === 'UMLOperation') {
      var params = (el.parameters || []).filter(function (p) { return p.direction !== 'return'; });
      return (el.name || '') + '(' + params.length + ')';
    }
    if (el._type === 'UMLAttribute') return (el.name || '') + (el.type ? ' : ' + model.typeName(el.type) : '');
    var stereo = model.stereotypeText(el);
    var n = el.name || '';
    if (el._type === 'UMLNote' && !n) n = 'Note';
    return (stereo ? '«' + stereo + '» ' : '') + (n || meta.label(el._type));
  }

  Explorer.prototype.select = function (el) {
    this.selectedId = el ? el._id : null;
    this.root.querySelectorAll('.tree-row.selected').forEach(function (r) { r.classList.remove('selected'); });
    if (el) {
      var row = this.root.querySelector('[data-id="' + cssEscape(el._id) + '"] > .tree-row');
      if (row) row.classList.add('selected');
    }
    this.app.onExplorerSelect(el);
  };

  Explorer.prototype.selectById = function (id) {
    var el = this.project.get(id);
    if (el) {
      // expand ancestors
      var p = el._parent;
      while (p) { this.expanded.add(p._id); p = p._parent; }
      this.refresh(true);
      this.select(el);
    }
  };

  Explorer.prototype.startRename = function (el) {
    var self = this;
    var row = this.root.querySelector('[data-id="' + cssEscape(el._id) + '"] > .tree-row');
    if (!row) return;
    var label = row.querySelector('.tree-label');
    var input = document.createElement('input');
    input.className = 'tree-rename';
    input.value = el.name || '';
    label.replaceWith(input);
    input.focus();
    input.select();
    function commit(cancel) {
      var value = input.value;
      var span = document.createElement('span');
      span.className = 'tree-label';
      input.replaceWith(span);
      if (cancel || value === (el.name || '')) { self.refresh(true); return; }
      self.app.renameElement(el, value);
    }
    input.addEventListener('keydown', function (ev) {
      ev.stopPropagation();
      if (ev.key === 'Enter') commit(false);
      if (ev.key === 'Escape') commit(true);
    });
    input.addEventListener('blur', function () { commit(false); });
  };

  Explorer.prototype.showContextMenu = function (el, x, y) {
    var self = this;
    var items = [];
    var app = this.app;

    if (meta.isDiagramLike(el._type)) {
      items.push({ label: 'Open Diagram', id: 'open' });
      items.push({ sep: true });
    }
    // "New ..." child items
    var allowed = meta.allowedChildren(el._type);
    var elementTypes = allowed.filter(function (t) { return !meta.isDiagram(t) && meta.TYPES[t]; });
    var diagramTypes = allowed.filter(function (t) { return meta.isDiagram(t); });
    if (elementTypes.length) {
      items.push({
        label: 'New', submenu: elementTypes.map(function (t) {
          return { label: meta.label(t), id: 'new:' + t };
        })
      });
    }
    if (el._type === 'UMLOperation') {
      items.push({ label: 'New Parameter', id: 'new:UMLParameter' });
    }
    if (diagramTypes.length && !meta.isDiagramLike(el._type)) {
      items.push({
        label: 'New Diagram', submenu: diagramTypes.map(function (t) {
          return { label: meta.DIAGRAMS[t].label, id: 'newdiagram:' + t };
        })
      });
    }
    if (items.length) items.push({ sep: true });
    // create view on current diagram
    var activeDiagram = app.activeDiagram();
    var viewType = meta.MODEL_TO_VIEW[el._type];
    if (activeDiagram && viewType && !meta.isDiagramLike(el._type)) {
      var droppable = meta.droppableTypes(activeDiagram._type);
      if (droppable.indexOf(el._type) >= 0) {
        items.push({ label: 'Add to “' + activeDiagram.name + '”', id: 'addview' });
      }
    }
    items.push({ label: 'Rename', id: 'rename' });
    if (el !== this.project.root) {
      items.push({ label: 'Delete', id: 'delete' });
    }

    dialogs.menu(x, y, items, function (id) {
      if (id === 'open') app.openDiagram(el);
      else if (id === 'rename') self.startRename(el);
      else if (id === 'delete') app.deleteElement(el);
      else if (id === 'addview') app.addViewToActiveDiagram(el);
      else if (id && id.indexOf('new:') === 0) app.createElementUnder(el, id.slice(4));
      else if (id && id.indexOf('newdiagram:') === 0) app.createDiagramUnder(el, id.slice(11));
    });
  };

  OS.Explorer = Explorer;
})(typeof window !== 'undefined' ? window : globalThis);
