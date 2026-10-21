/*
 * OpenStar UML — application bootstrap & orchestration.
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};
  var util = OS.util, meta = OS.meta, model = OS.model, views = OS.views, dialogs = OS.dialogs;

  var SETTINGS_KEY = 'openstar-settings-v1';
  var DEFAULT_SETTINGS = {
    theme: 'dark', gridSize: 8, showGrid: true, snap: false,
    showExplorer: true, showProperties: true, showToolbox: true
  };

  var CLASSIFIER_TYPES = ['UMLClass', 'UMLInterface', 'UMLEnumeration', 'UMLDataType', 'UMLComponent',
    'UMLNode', 'UMLArtifact', 'UMLActor', 'UMLUseCase', 'UMLSubsystem', 'UMLInstance'];
  var NON_TARGET_TYPES = { 'UMLAttribute': 1, 'UMLOperation': 1, 'UMLParameter': 1, 'UMLEnumerationLiteral': 1,
    'UMLAssociationEnd': 1, 'UMLTag': 1, 'UMLReception': 1 };

  function App() {
    this.bridge = global.OpenStar;
    this.isElectron = !!(this.bridge && this.bridge.isElectron);
    this.settings = this.loadSettings();
    this.project = new OS.Project();
    this.clipboardData = null;

    /* ---- DOM ---- */
    var $ = function (id) { return document.getElementById(id); };
    this.dom = {
      menubar: $('menubar'), toolbar: $('toolbar'),
      explorer: $('explorer-host'), toolbox: $('toolbox-host'),
      tabs: $('tabs-host'), canvasHost: $('canvas-host'),
      props: $('props-host'), statusLeft: $('status-left'), statusRight: $('status-right'),
      zoomLabel: $('zoom-label')
    };

    /* ---- components ---- */
    this.editor = new OS.Editor(this.dom.canvasHost, { project: this.project });
    this.explorer = new OS.Explorer(this.dom.explorer, this);
    this.tabs = new OS.Tabs(this.dom.tabs, this);
    this.toolbox = new OS.Toolbox(this.dom.toolbox, this);
    this.props = new OS.PropertyPanel(this.dom.props, this);
    if (!this.isElectron) {
      this.menubar = new OS.Menubar(this.dom.menubar, this);
      this.dom.menubar.style.display = 'flex';
      this.buildBrowserToolbar();
    } else {
      this.dom.menubar.style.display = 'none';
      this.dom.toolbar.style.display = 'none';
    }

    this.wireProject();
    this.wireEditor();
    this.wireDnd();
    this.wireKeyboard();
    this.wireBridge();
    this.applySettings();
    this.buildStatusControls();

    var self = this;
    this.project.newProject();
    var def = this.project.defaultDiagram();
    if (def) this.openDiagram(def);
    this.refreshAll();

    // Electron: open file passed on launch / second instance / double-click association
    if (this.isElectron && this.bridge.getLaunchFile) {
      this.bridge.getLaunchFile().then(function (p) { if (p) self.openPath(p); });
    }
    if (this.isElectron && this.bridge.onOpenFile) {
      this.bridge.onOpenFile(function (p) { self.openPath(p); });
    }
    global.addEventListener('beforeunload', function (ev) {
      if (self.project.dirty) { ev.preventDefault(); ev.returnValue = ''; }
    });
  }

  /* ============================ settings ============================ */

  App.prototype.loadSettings = function () {
    try {
      var s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return Object.assign({}, DEFAULT_SETTINGS, s);
    } catch (e) { return Object.assign({}, DEFAULT_SETTINGS); }
  };

  App.prototype.saveSettings = function () {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch (e) { }
  };

  App.prototype.applySettings = function () {
    document.body.dataset.theme = this.settings.theme;
    document.body.classList.toggle('hide-explorer', !this.settings.showExplorer);
    document.body.classList.toggle('hide-props', !this.settings.showProperties);
    document.body.classList.toggle('hide-toolbox', !this.settings.showToolbox);
    this.editor.showGrid = this.settings.showGrid;
    this.editor.snapToGrid = this.settings.snap;
    this.editor.gridSize = this.settings.gridSize;
    this.editor.render();
    if (this.bridge && this.bridge.setMenuState) {
      this.bridge.setMenuState({
        'toggle-grid': this.settings.showGrid,
        'toggle-snap': this.settings.snap,
        'toggle-explorer': this.settings.showExplorer,
        'toggle-properties': this.settings.showProperties,
        'toggle-toolbox': this.settings.showToolbox
      });
    }
  };

  /* ============================ wiring ============================ */

  App.prototype.wireProject = function () {
    var self = this;
    this.project.on('change', function () { self.onProjectChanged(); });
    this.project.on('restored', function () {
      if (!self.editor.rebind()) {
        // active diagram vanished → fall back
        var d = self.tabs.active() || self.project.defaultDiagram();
        if (d) self.tabs.openDiagram(d);
        else { self.tabs.closeAll(); }
      }
      self.refreshAll();
    });
    this.project.on('loaded', function () {
      self.tabs.open = [];
      self.tabs.activeId = null;
      var d = self.project.defaultDiagram();
      if (d) self.tabs.openDiagram(d);
      else { self.tabs.render(); self.editor.setDiagram(null); }
      self.refreshAll();
    });
    this.project.on('dirty', function () { self.updateTitle(); });
  };

  App.prototype.wireEditor = function () {
    var self = this;
    this.editor.on('selection', function (sel) { self.updatePropsFromSelection(); self.updateStatus(); });
    this.editor.on('structure', function () { self.refreshAll(); });
    this.editor.on('zoom', function (z) {
      if (self.dom.zoomLabel) self.dom.zoomLabel.textContent = Math.round(z * 100) + '%';
    });
    this.editor.on('status', function (p) {
      if (self.dom.statusLeft && !self._statusMessageLock) {
        self.dom.statusLeft.textContent = 'x: ' + p.x + '  y: ' + p.y;
      }
    });
    this.editor.on('status-message', function (msg) { self.showMessage(msg, 2600); });
    this.editor.on('edit-model', function (m) {
      if (m) { self.props.show({ model: m, views: self.editor.selection.slice() }); }
    });
    this.editor.on('contextmenu', function (ev) { self.showCanvasMenu(ev); });
    this.editor.on('tool-used', function () { /* keep state */ });
  };

  App.prototype.wireDnd = function () {
    var self = this;
    var host = this.dom.canvasHost;
    host.addEventListener('dragover', function (ev) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; });
    host.addEventListener('drop', function (ev) {
      ev.preventDefault();
      var id = ev.dataTransfer.getData('application/x-openstar-element');
      if (!id) return;
      var el = self.project.get(id);
      if (!el) return;
      var r = self.editor.canvas.getBoundingClientRect();
      var sp = { x: ev.clientX - r.left, y: ev.clientY - r.top };
      var wp = self.editor.screenToWorld(sp.x, sp.y);
      self.editor.dropModel(el, wp);
    });
  };

  App.prototype.wireKeyboard = function () {
    var self = this;
    this.keymap = [];
    OS.menuDefs.defs.forEach(function (menu) {
      (function walk(items) {
        items.forEach(function (it) {
          if (it.submenu) { walk(it.submenu); return; }
          if (it.accel && it.cmd && it.cmd !== 'exit') self.keymap.push({ accel: it.accel, cmd: it.cmd });
        });
      })(menu.items);
    });
    this.keymap.push({ accel: 'F2', cmd: 'rename' });

    document.addEventListener('keydown', function (ev) {
      if (self.typingTarget(ev)) return;
      var cmd = self.matchAccel(ev);
      if (cmd) {
        ev.preventDefault();
        self.runCommand(cmd);
      }
    });
  };

  App.prototype.typingTarget = function (ev) {
    var ae = document.activeElement;
    return ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT' || ae.isContentEditable);
  };

  App.prototype.matchAccel = function (ev) {
    var isMac = /Mac|iP(hone|ad|od)/.test(navigator.platform || '');
    var mod = isMac ? ev.metaKey : ev.ctrlKey;
    var key = (ev.key || '').toLowerCase();
    for (var i = 0; i < this.keymap.length; i++) {
      var a = this.keymap[i].accel;
      var parts = a.split('+');
      var needMod = false, needShift = false, needAlt = false, k = '';
      parts.forEach(function (p) {
        var lp = p.toLowerCase();
        if (lp === 'cmdorctrl' || lp === 'cmd' || lp === 'ctrl' || lp === 'control' || lp === 'command') needMod = true;
        else if (lp === 'shift') needShift = true;
        else if (lp === 'alt' || lp === 'option') needAlt = true;
        else k = lp;
      });
      if (needMod !== mod) continue;
      if (needShift !== ev.shiftKey && !(k === '=' && ev.shiftKey)) continue;
      if (needAlt !== ev.altKey) continue;
      var evKey = key;
      if (evKey === ' ') evKey = 'space';
      if (k === '=') { if (evKey === '=' || evKey === '+') return this.keymap[i].cmd; else continue; }
      if (k === 'delete') { if (evKey === 'delete' || evKey === 'backspace') return this.keymap[i].cmd; else continue; }
      if (evKey === k) return this.keymap[i].cmd;
    }
    return null;
  };

  App.prototype.wireBridge = function () {
    var self = this;
    if (!this.bridge) return;
    if (this.bridge.onMenuCommand) {
      this.bridge.onMenuCommand(function (cmd) { self.runCommand(cmd); });
    }
  };

  /* ============================ refresh ============================ */

  App.prototype.refreshAll = function () {
    this.explorer.project = this.project;
    this.explorer.refresh(true);
    this.tabs.render();
    var d = this.tabs.active();
    this.toolbox.setDiagramType(d ? d._type : null);
    if (d && this.editor.diagram !== d) this.editor.setDiagram(d);
    this.editor.render();
    this.updatePropsFromSelection();
    this.updateTitle();
    this.updateStatus();
  };

  App.prototype.onProjectChanged = function () {
    this.explorer.refresh(true);
    this.tabs.render();
    this.editor.render();
    this.props.refresh();
    this.updateTitle();
  };

  App.prototype.updateTitle = function () {
    var name = this.project.fileName || (this.project.root ? this.project.root.name : 'Untitled') || 'Untitled';
    document.title = name + (this.project.dirty ? ' ●' : '') + ' - OpenStar UML';
  };

  App.prototype.updateStatus = function () {
    var sel = this.editor.selection;
    if (sel.length === 1 && sel[0].model) {
      var m = sel[0].model;
      this.dom.statusLeft.textContent = meta.label(m._type) + ': ' + (m.name || '(unnamed)');
    } else if (sel.length > 1) {
      this.dom.statusLeft.textContent = sel.length + ' elements selected';
    }
  };

  App.prototype.showMessage = function (msg, ms) {
    var self = this;
    this.dom.statusLeft.textContent = msg;
    this._statusMessageLock = true;
    clearTimeout(this._statusTimer);
    this._statusTimer = setTimeout(function () {
      self._statusMessageLock = false;
      self.updateStatus();
    }, ms || 2500);
  };

  App.prototype.updatePropsFromSelection = function () {
    var sel = this.editor.selection;
    if (sel.length) {
      this.props.show({ model: sel[0].model || null, views: sel.slice() });
    } else {
      var d = this.tabs.active();
      var m = this.explorer.selectedId ? this.project.get(this.explorer.selectedId) : null;
      if (m) this.props.show({ model: m, views: [] });
      else if (d) this.props.show({ model: d, views: [] });
      else this.props.clear();
    }
  };

  /* ============================ explorer callbacks ============================ */

  App.prototype.onExplorerSelect = function (el) {
    if (!el) { this.updatePropsFromSelection(); return; }
    // select the element's views on the active diagram, if any
    var d = this.tabs.active();
    if (d) {
      var vs = model.viewsOf(this.project, el).filter(function (v) { return v._parent === d; });
      if (vs.length) { this.editor.setSelection(vs); return; }
    }
    this.props.show({ model: el, views: [] });
    this.updateStatus();
  };

  App.prototype.onModelEdited = function (m) {
    if (m) {
      var self = this;
      model.viewsOf(this.project, m).forEach(function (v) {
        views.autoLayout(v, { fitHeight: true });
      });
      // keep edge view endpoints in sync when source/target were edited as properties
      if (meta.isEdgeModel(m._type) || m._type === 'UMLNoteLink') {
        model.viewsOf(this.project, m).forEach(function (v) {
          var d = v._parent;
          if (!d || !d.ownedViews) return;
          function firstViewOf(el) {
            if (!el) return null;
            for (var i = 0; i < d.ownedViews.length; i++) {
              if (d.ownedViews[i].model === el) return d.ownedViews[i];
            }
            return null;
          }
          var src = m.source, tgt = m.target;
          if (!src && !tgt && m._type === 'UMLAssociation' && m.ownedEnds && m.ownedEnds.length === 2) {
            src = m.ownedEnds[0].reference;
            tgt = m.ownedEnds[1].reference;
          }
          var tv = firstViewOf(src), hv = firstViewOf(tgt);
          if (tv) v.tail = tv;
          if (hv) v.head = hv;
        });
      }
    }
    this.explorer.refresh(true);
    this.tabs.render();
    this.editor.render();
    this.updateTitle();
  };

  App.prototype.activeDiagram = function () { return this.tabs.active(); };

  /* ============================ element ops ============================ */

  App.prototype.listNameFor = function (childType) {
    switch (childType) {
      case 'UMLAttribute': return 'ownedAttributes';
      case 'UMLOperation': case 'UMLReception': return 'ownedOperations';
      case 'UMLEnumerationLiteral': return 'ownedLiterals';
      case 'UMLParameter': return 'parameters';
      case 'UMLAssociationEnd': return 'ownedEnds';
      default: return 'ownedElements';
    }
  };

  App.prototype.renameElement = function (el, name) {
    var self = this;
    this.project.transact('Rename', function () {
      var cur = self.project.get(el._id);
      if (cur) cur.name = name;
    });
    this.onModelEdited(el);
    this.props.refresh();
  };

  App.prototype.deleteElement = function (el) {
    if (el === this.project.root) return;
    var self = this;
    var wasActive = this.tabs.active();
    this.project.transact('Delete ' + meta.label(el._type), function () {
      var cur = self.project.get(el._id);
      if (cur) model.deleteModel(self.project, cur);
    });
    if (wasActive && !this.project.get(wasActive._id)) {
      var d = this.tabs.open.filter(function (t) { return self.project.get(t._id); })[0] || this.project.defaultDiagram();
      this.tabs.open = this.tabs.open.filter(function (t) { return self.project.get(t._id); });
      if (d) this.tabs.openDiagram(d);
      else { this.tabs.activeId = null; this.tabs.render(); this.editor.setDiagram(null); }
    }
    this.refreshAll();
  };

  App.prototype.createElementUnder = function (owner, type) {
    var self = this;
    if (!owner) owner = this.defaultOwner();
    if (!owner) return;
    // dropping into a diagram → keep the diagram when it may own this type
    // (e.g. lifelines/messages on sequence diagrams), else use its namespace
    if (meta.isDiagramLike(owner._type)) {
      if (meta.allowedChildren(owner._type).indexOf(type) < 0) {
        owner = this.behaviorOwner(owner) || owner._parent || owner;
      }
    }
    var created = null;
    this.project.transact('Create ' + meta.label(type), function () {
      created = self.project.createElement(owner, type);
      if (type === 'UMLStateMachine' || type === 'UMLActivity') { /* container ready */ }
    });
    this.refreshAll();
    if (created) this.explorer.selectById(created._id);
  };

  App.prototype.createDiagramUnder = function (owner, type) {
    var self = this;
    if (!owner) owner = this.defaultOwner();
    if (meta.isDiagramLike(owner._type)) owner = owner._parent;
    var created = null;
    this.project.transact('Create Diagram', function () {
      var info = meta.DIAGRAMS[type] || meta.DIAGRAMS['GenericDiagram'];
      var base = info.defaultName && info.defaultName !== 'Diagram1' ? info.defaultName : info.label.replace(/\s+/g, '');
      created = self.project.createElement(owner, type, { name: self.project.uniqueName(owner, base) });
    });
    this.refreshAll();
    if (created) this.openDiagram(created);
  };

  App.prototype.defaultOwner = function () {
    var sel = this.explorer.selectedId ? this.project.get(this.explorer.selectedId) : null;
    if (sel) {
      if (meta.isDiagramLike(sel._type)) return this.behaviorOwner(sel) || sel._parent;
      var d = meta.typeDescriptor(sel._type);
      if ((d.allowedChildren || []).length) return sel;
      return sel._parent;
    }
    var ad = this.activeDiagram();
    if (ad) return this.behaviorOwner(ad) || ad._parent;
    return this.project.firstModel();
  };

  App.prototype.behaviorOwner = function (diagram) {
    var owner = diagram._parent;
    if (owner && (owner._type === 'UMLStateMachine' || owner._type === 'UMLActivity')) return owner;
    return null;
  };

  App.prototype.isDescendant = function (el, maybeAncestor) {
    var p = el && el._parent;
    while (p) { if (p === maybeAncestor) return true; p = p._parent; }
    return false;
  };

  App.prototype.reparentElement = function (dragged, newParent) {
    if (!dragged || !newParent || dragged === newParent) return;
    if (this.isDescendant(newParent, dragged)) { this.showMessage('Cannot move an element into itself.'); return; }
    if (meta.isDiagramLike(newParent._type)) newParent = this.behaviorOwner(newParent) || newParent._parent;
    if (!newParent) return;
    var listName = this.listNameFor(dragged._type);
    if (listName !== 'ownedElements' && newParent._type !== dragged._parent._type) {
      // features only into matching owners — allow (e.g., attribute into any classifier)
    }
    var allowed = meta.allowedChildren(newParent._type);
    var ok = allowed.indexOf(dragged._type) >= 0;
    if (!ok && newParent._type === 'UMLOperation' && dragged._type === 'UMLParameter') ok = true;
    if (!ok && (newParent._type === 'UMLClass' || newParent._type === 'UMLInterface') &&
        (dragged._type === 'UMLAttribute' || dragged._type === 'UMLOperation')) ok = true;
    if (!ok && newParent._type === 'UMLEnumeration' && dragged._type === 'UMLEnumerationLiteral') ok = true;
    if (!ok && meta.isDiagramLike(dragged._type) &&
        ['UMLModel', 'UMLPackage', 'UMLSubsystem', 'UMLComponent'].indexOf(newParent._type) >= 0) ok = true;
    if (!ok && (newParent._type === 'UMLStateMachine' || newParent._type === 'UMLActivity') &&
        ['UMLState', 'UMLCompositeState', 'UMLPseudostate', 'UMLFinalState', 'UMLTransition', 'UMLRegion',
          'UMLAction', 'UMLObjectNode', 'UMLInitialNode', 'UMLActivityFinalNode', 'UMLFlowFinalNode',
          'UMLDecisionNode', 'UMLMergeNode', 'UMLForkNode', 'UMLJoinNode', 'UMLControlFlow', 'UMLObjectFlow'].indexOf(dragged._type) >= 0) ok = true;
    if (!ok && newParent._type === 'UMLState' &&
        ['UMLState', 'UMLCompositeState', 'UMLPseudostate', 'UMLFinalState'].indexOf(dragged._type) >= 0) ok = true;
    if (!ok) {
      this.showMessage(meta.label(dragged._type) + ' cannot be placed inside ' + meta.label(newParent._type) + '.');
      return;
    }
    var self = this;
    this.project.transact('Move ' + meta.label(dragged._type), function () {
      var d = self.project.get(dragged._id);
      var p = self.project.get(newParent._id);
      if (!d || !p) return;
      if (d._parent) model.removeOwned(d._parent, d);
      model.addOwned(self.project, p, d, self.listNameFor(d._type));
    });
    this.refreshAll();
  };

  App.prototype.addViewToActiveDiagram = function (el) {
    var d = this.activeDiagram();
    if (!d) { this.showMessage('No active diagram.'); return; }
    var v = this.editor.addModelView(el);
    if (v) this.refreshAll();
  };

  App.prototype.openDiagram = function (diagram) {
    if (!diagram) return;
    this.tabs.openDiagram(diagram);
    this.toolbox.setDiagramType(diagram._type);
    this.updateStatus();
  };

  App.prototype.onTabActivated = function (diagram) {
    this.editor.setDiagram(diagram || null);
    this.toolbox.setDiagramType(diagram ? diagram._type : null);
    if (diagram) this.props.show({ model: diagram, views: [] });
    else this.props.clear();
    this.updateStatus();
  };

  /* ============================ reference helpers (property panel) ============================ */

  App.prototype.referenceCandidates = function (filter) {
    var out = [];
    var models = this.project.models();
    models.forEach(function (m) {
      if (filter === 'classifier') {
        if (CLASSIFIER_TYPES.indexOf(m._type) >= 0) out.push(m);
      } else if (filter === 'lifeline') {
        if (m._type === 'UMLLifeline') out.push(m);
      } else {
        if (!NON_TARGET_TYPES[m._type] && !meta.isEdgeModel(m._type) && !meta.isDiagramLike(m._type)) out.push(m);
      }
    });
    return out;
  };

  App.prototype.elementPathLabel = function (el) {
    var parts = [];
    var p = el;
    while (p && p._type !== 'Project' && parts.length < 3) {
      parts.unshift(p.name || meta.label(p._type));
      p = p._parent;
    }
    return parts.join('::');
  };

  /* ============================ file operations ============================ */

  App.prototype.maybeSaveChanges = function () {
    if (!this.project.dirty) return Promise.resolve(true);
    return dialogs.modal({
      title: 'Unsaved Changes',
      content: '<div class="modal-message">Save changes to “' + util.xmlEscape(this.project.fileName || this.project.root.name || 'Untitled') + '” before continuing?</div>',
      buttons: [
        { label: 'Cancel', value: 'cancel' },
        { label: "Don't Save", value: 'discard' },
        { label: 'Save', value: 'save', primary: true }
      ],
      escapeValue: 'cancel'
    }).then(function (v) {
      if (v === 'discard') return true;
      if (v === 'save') return this.doSave().then(function (ok) { return ok; }.bind(this));
      return false;
    }.bind(this));
  };

  App.prototype.newProject = function () {
    var self = this;
    this.maybeSaveChanges().then(function (ok) {
      if (!ok) return;
      self.project.newProject();
      self.explorer.expanded.clear();
      var d = self.project.defaultDiagram();
      if (d) self.openDiagram(d);
      self.refreshAll();
    });
  };

  App.prototype.openProject = function () {
    var self = this;
    this.maybeSaveChanges().then(function (ok) {
      if (!ok) return;
      return self.bridge.openFileDialog('.mdj,.json').then(function (res) {
        if (!res) return;
        self.loadProjectText(res.text, res.path || res.name || null);
      });
    });
  };

  App.prototype.openPath = function (path) {
    var self = this;
    this.maybeSaveChanges().then(function (ok) {
      if (!ok) return;
      if (!self.bridge.readFile) { self.showMessage('Cannot open by path in browser mode.'); return; }
      return self.bridge.readFile(path).then(function (text) {
        self.loadProjectText(text, path);
      }).catch(function (e) {
        dialogs.alert('Open Failed', 'Could not read file:<br/><code>' + util.xmlEscape(String(e && e.message || e)) + '</code>');
      });
    });
  };

  App.prototype.loadProjectText = function (text, path) {
    try {
      var before = this.project.root ? this.project.root.name : null;
      OS.Mdj.load(this.project, text);
      if (path) {
        this.project.filePath = path;
        this.project.fileName = String(path).split(/[\\/]/).pop();
        this.addRecent(this.project.filePath, this.project.fileName);
      }
      this.explorer.expanded.clear();
      var d = this.project.defaultDiagram();
      if (d) this.openDiagram(d);
      this.refreshAll();
      this.showMessage('Project loaded.', 1800);
    } catch (e) {
      console.error(e);
      dialogs.alert('Open Failed', 'This file could not be parsed as an .mdj model.<br/><br/><code>' +
        util.xmlEscape(String(e && e.message || e)) + '</code>');
    }
  };

  App.prototype.doSave = function () {
    if (!this.project.filePath) return this.doSaveAs();
    var self = this;
    return this.writeProjectFile(this.project.filePath).then(function (ok) {
      if (ok) {
        self.project.setDirty(false);
        self.updateTitle();
        self.showMessage('Saved.', 1500);
      }
      return ok;
    });
  };

  App.prototype.doSaveAs = function () {
    var self = this;
    var def = (this.project.fileName || (this.project.root && this.project.root.name) || 'Untitled') + '.mdj';
    if (!/\.mdj$/i.test(def)) def += '.mdj';
    return this.bridge.saveFileDialog(def, '.mdj').then(function (path) {
      if (!path) return false;
      return self.writeProjectFile(path).then(function (ok) {
        if (ok) {
          self.project.filePath = path;
          self.project.fileName = String(path).split(/[\\/]/).pop();
          self.addRecent(path, self.project.fileName);
          self.project.setDirty(false);
          self.updateTitle();
          self.showMessage('Saved.', 1500);
        }
        return ok;
      });
    });
  };

  App.prototype.writeProjectFile = function (path) {
    var text;
    try {
      views.prepareDiagramAll && views.prepareDiagramAll(this.project);
      this.project.eachDiagram(function (d) { OS.views.prepareDiagram(d); });
      text = OS.Mdj.serialize(this.project);
    } catch (e) {
      console.error(e);
      dialogs.alert('Save Failed', 'Serialization error: ' + util.xmlEscape(String(e && e.message || e)));
      return Promise.resolve(false);
    }
    return this.bridge.writeFile(path, text).then(function () { return true; })
      .catch(function (e) {
        dialogs.alert('Save Failed', util.xmlEscape(String(e && e.message || e)));
        return false;
      });
  };

  /* ---- export / import ---- */

  App.prototype.requireDiagram = function () {
    var d = this.activeDiagram();
    if (!d) { dialogs.alert('Export', 'No diagram is open.'); return null; }
    if (!(d.ownedViews || []).length) {
      this.showMessage('Diagram is empty — exporting anyway.', 2000);
    }
    return d;
  };

  App.prototype.exportText = function (defaultName, text) {
    var self = this;
    return this.bridge.saveFileDialog(defaultName).then(function (path) {
      if (!path) return;
      return self.bridge.writeFile(path, text);
    }).then(function () { self.showMessage('Exported.', 1800); });
  };

  App.prototype.exportPNG = function () {
    var d = this.requireDiagram();
    if (!d) return;
    var self = this;
    var dataUrl = OS.Image.toPNGDataUrl(d, 2);
    var name = (d.name || 'diagram').replace(/[^\w\-. ]+/g, '_') + '.png';
    this.bridge.saveFileDialog(name, '.png').then(function (path) {
      if (!path) return;
      return self.bridge.writeBase64File(path, dataUrl);
    }).then(function () { self.showMessage('PNG exported.', 1800); });
  };

  App.prototype.printDiagram = function () {
    var d = this.requireDiagram();
    if (!d) return;
    var dataUrl = OS.Image.toPNGDataUrl(d, 2);
    this.bridge.printDiagram(dataUrl);
  };

  App.prototype.importXMI = function () {
    var self = this;
    this.bridge.openFileDialog('.xml,.xmi').then(function (res) {
      if (!res) return;
      var before = OS.Mdj.stateJSON(self.project);
      var result;
      try {
        result = OS.Xmi.importInto(self.project, res.text);
      } catch (e) {
        dialogs.alert('Import Failed', 'Could not parse XMI:<br/><code>' + util.xmlEscape(String(e && e.message || e)) + '</code>');
        return;
      }
      self.project._pushStateUndo('Import XMI', before);
      self.refreshAll();
      var msg = 'XMI imported into “' + util.xmlEscape(result.model.name) + '”.';
      if (result.unresolved) msg += ' (' + result.unresolved + ' unresolved reference' + (result.unresolved > 1 ? 's' : '') + ' ignored)';
      self.showMessage(msg, 3500);
    });
  };

  /* ---- recent ---- */

  App.prototype.getRecentFiles = function () {
    if (this.bridge && this.bridge.getRecentFilesSync) {
      try { return this.bridge.getRecentFilesSync(); } catch (e) { return []; }
    }
    try { return JSON.parse(localStorage.getItem('openstar-recent') || '[]'); } catch (e) { return []; }
  };

  App.prototype.addRecent = function (path, name) {
    if (this.bridge && this.bridge.addRecentFile) {
      this.bridge.addRecentFile({ path: path, name: name || path });
      return;
    }
    var list = this.getRecentFiles().filter(function (r) { return r.path !== path; });
    list.unshift({ path: path, name: name || path });
    try { localStorage.setItem('openstar-recent', JSON.stringify(list.slice(0, 10))); } catch (e) { }
  };

  /* ============================ canvas context menu ============================ */

  App.prototype.showCanvasMenu = function (ev) {
    var self = this;
    var items = [];
    var sel = this.editor.selection;
    if (ev.view && sel.length) {
      items.push({ label: 'Rename…', id: 'rename', accel: 'F2' });
      items.push({ label: 'Duplicate', id: 'duplicate', accel: 'Ctrl+D' });
      items.push({ label: 'Delete', id: 'delete', accel: 'Del' });
      items.push({ sep: true });
      items.push({
        label: 'Z-Order', submenu: [
          { label: 'Bring to Front', id: 'z-front' },
          { label: 'Bring Forward', id: 'z-forward' },
          { label: 'Send Backward', id: 'z-backward' },
          { label: 'Send to Back', id: 'z-back' }
        ]
      });
      if (sel.length >= 2) {
        items.push({
          label: 'Align', submenu: [
            { label: 'Left', id: 'align-left' }, { label: 'Center', id: 'align-center' },
            { label: 'Right', id: 'align-right' }, { label: 'Top', id: 'align-top' },
            { label: 'Middle', id: 'align-middle' }, { label: 'Bottom', id: 'align-bottom' }
          ]
        });
      }
      if (sel.length >= 3) {
        items.push({
          label: 'Distribute', submenu: [
            { label: 'Horizontal', id: 'distribute-horizontal' },
            { label: 'Vertical', id: 'distribute-vertical' }
          ]
        });
      }
      items.push({ sep: true });
    }
    items.push({ label: 'Select All', id: 'select-all', accel: 'Ctrl+A' });
    if (this.clipboardData) items.push({ label: 'Paste', id: 'paste', accel: 'Ctrl+V' });
    items.push({ sep: true });
    items.push({ label: 'Actual Size', id: 'zoom-actual', accel: 'Ctrl+0' });
    items.push({ label: 'Fit to Window', id: 'zoom-fit' });
    items.push({ sep: true });
    items.push({ label: 'Grid', id: 'toggle-grid', checked: this.editor.showGrid });
    items.push({ label: 'Snap to Grid', id: 'toggle-snap', checked: this.editor.snapToGrid });
    dialogs.menu(ev.nativeEvent.clientX, ev.nativeEvent.clientY, items, function (cmd) {
      self.runCommand(cmd);
    });
  };

  /* ============================ commands ============================ */

  App.prototype.getCommandState = function (cmd) {
    switch (cmd) {
      case 'toggle-grid': return this.editor.showGrid;
      case 'toggle-snap': return this.editor.snapToGrid;
      case 'toggle-explorer': return this.settings.showExplorer;
      case 'toggle-properties': return this.settings.showProperties;
      case 'toggle-toolbox': return this.settings.showToolbox;
      default: return false;
    }
  };

  App.prototype.runCommand = function (cmd) {
    if (!cmd) return;
    var ed = this.editor;

    // parametrized commands
    if (cmd.indexOf('new-element:') === 0) { this.createElementUnder(this.defaultOwner(), cmd.slice(12)); return; }
    if (cmd.indexOf('new-diagram:') === 0) { this.createDiagramUnder(this.defaultOwner(), cmd.slice(12)); return; }
    if (cmd.indexOf('open-external:') === 0) { this.bridge.openExternal(cmd.slice(14)); return; }
    if (cmd.indexOf('open-recent:') === 0) { this.openPath(cmd.slice(12)); return; }

    switch (cmd) {
      /* file */
      case 'new-project': this.newProject(); break;
      case 'open-project': this.openProject(); break;
      case 'save-project': this.doSave(); break;
      case 'save-project-as': this.doSaveAs(); break;
      case 'import-xmi': this.importXMI(); break;
      case 'export-png': this.exportPNG(); break;
      case 'export-svg': {
        var d1 = this.requireDiagram(); if (!d1) break;
        this.exportText((d1.name || 'diagram') + '.svg', OS.Image.toSVG(d1));
        break;
      }
      case 'export-xmi':
        this.exportText((this.project.fileName || 'model').replace(/\.(mdj|json)$/i, '') + '.xml', OS.Xmi.exportProject(this.project));
        break;
      case 'export-plantuml': {
        var d2 = this.requireDiagram(); if (!d2) break;
        this.exportText((d2.name || 'diagram') + '.puml', OS.PlantUML.generate(this.project, d2));
        break;
      }
      case 'export-plantuml-all':
        this.exportText((this.project.fileName || 'model').replace(/\.(mdj|json)$/i, '') + '.puml', OS.PlantUML.generateAll(this.project));
        break;
      case 'export-markdown':
        this.exportText((this.project.fileName || 'model').replace(/\.(mdj|json)$/i, '') + '.md', OS.Markdown.generate(this.project));
        break;
      case 'print': this.printDiagram(); break;
      case 'exit': if (this.bridge.closeWindow) this.bridge.closeWindow(); break;

      /* edit */
      case 'undo':
        if (!this.project.canUndo()) { this.showMessage('Nothing to undo.', 1500); break; }
        this.project.undo();
        break;
      case 'redo':
        if (!this.project.canRedo()) { this.showMessage('Nothing to redo.', 1500); break; }
        this.project.redo();
        break;
      case 'copy': this.clipboardData = ed.copyData(); this.showMessage('Copied.', 1200); break;
      case 'cut':
        this.clipboardData = ed.copyData();
        if (this.clipboardData) ed.deleteSelection();
        break;
      case 'paste':
        if (!this.clipboardData) { this.showMessage('Clipboard is empty.', 1500); break; }
        ed.pasteData(this.clipboardData, 20, 20);
        break;
      case 'delete':
        if (ed.selection.length) ed.deleteSelection();
        else if (this.explorer.selectedId) {
          var el = this.project.get(this.explorer.selectedId);
          if (el && el !== this.project.root) this.deleteElement(el);
        }
        break;
      case 'duplicate': ed.duplicateSelection(); break;
      case 'select-all': ed.selectAll(); break;
      case 'rename': {
        if (ed.selection.length) { ed.startInlineEdit(ed.selection[0]); break; }
        var el2 = this.explorer.selectedId ? this.project.get(this.explorer.selectedId) : null;
        if (el2) this.explorer.startRename(el2);
        break;
      }
      case 'edit-selected': {
        var m = ed.getSelectedModel();
        if (m) { this.props.show({ model: m, views: ed.selection.slice() }); }
        var firstInput = this.dom.props.querySelector('input,select,textarea');
        if (firstInput) firstInput.focus();
        break;
      }

      /* format */
      case 'align-left': ed.align('left'); break;
      case 'align-center': ed.align('center'); break;
      case 'align-right': ed.align('right'); break;
      case 'align-top': ed.align('top'); break;
      case 'align-middle': ed.align('middle'); break;
      case 'align-bottom': ed.align('bottom'); break;
      case 'distribute-horizontal': ed.distribute('horizontal'); break;
      case 'distribute-vertical': ed.distribute('vertical'); break;
      case 'z-front': ed.zOrder('front'); break;
      case 'z-forward': ed.zOrder('forward'); break;
      case 'z-backward': ed.zOrder('backward'); break;
      case 'z-back': ed.zOrder('back'); break;

      /* view */
      case 'zoom-in': ed.zoomIn(); break;
      case 'zoom-out': ed.zoomOut(); break;
      case 'zoom-actual': ed.zoomActual(); break;
      case 'zoom-fit': ed.zoomFit(); break;
      case 'toggle-grid':
        this.settings.showGrid = !this.settings.showGrid;
        this.saveSettings(); this.applySettings();
        break;
      case 'toggle-snap':
        this.settings.snap = !this.settings.snap;
        this.saveSettings(); this.applySettings();
        break;
      case 'toggle-explorer':
        this.settings.showExplorer = !this.settings.showExplorer;
        this.saveSettings(); this.applySettings();
        break;
      case 'toggle-properties':
        this.settings.showProperties = !this.settings.showProperties;
        this.saveSettings(); this.applySettings();
        break;
      case 'toggle-toolbox':
        this.settings.showToolbox = !this.settings.showToolbox;
        this.saveSettings(); this.applySettings();
        break;

      /* tools & help */
      case 'preferences': this.showPreferences(); break;
      case 'about': this.showAbout(); break;
      case 'shortcuts': this.showShortcuts(); break;
      case 'license': this.showLicense(); break;

      default:
        console.warn('Unknown command:', cmd);
    }
  };

  /* ============================ dialogs ============================ */

  App.prototype.showPreferences = function () {
    var self = this;
    var s = this.settings;
    var body = dialogs.el('div', 'prefs-body');
    body.innerHTML =
      '<div class="pref-row"><label>Theme</label><select id="pref-theme">' +
      '<option value="dark">Dark (StarUML-style)</option><option value="light">Light</option></select></div>' +
      '<div class="pref-row"><label>Grid size</label><select id="pref-grid">' +
      [4, 8, 16, 32].map(function (g) { return '<option value="' + g + '">' + g + ' px</option>'; }).join('') + '</select></div>' +
      '<div class="pref-row"><label>Options</label><span class="pref-checks">' +
      '<label><input type="checkbox" id="pref-showgrid"/> Show grid</label>' +
      '<label><input type="checkbox" id="pref-snap"/> Snap to grid</label>' +
      '<label><input type="checkbox" id="pref-explorer"/> Model Explorer</label>' +
      '<label><input type="checkbox" id="pref-props"/> Property Editor</label>' +
      '<label><input type="checkbox" id="pref-toolbox"/> Toolbox</label>' +
      '</span></div>';
    dialogs.modal({
      title: 'Preferences', content: body,
      buttons: [{ label: 'Cancel', value: false }, { label: 'OK', value: true, primary: true }]
    }).then(function (ok) {
      if (!ok) { self.applySettings(); return; }
      // values were read before close? modal removes DOM — capture via live refs
    });
    // capture elements and wire live-apply (simpler + no focus races)
    var themeSel = body.querySelector('#pref-theme');
    var gridSel = body.querySelector('#pref-grid');
    var showGridCb = body.querySelector('#pref-showgrid');
    var snapCb = body.querySelector('#pref-snap');
    var expCb = body.querySelector('#pref-explorer');
    var propsCb = body.querySelector('#pref-props');
    var tbCb = body.querySelector('#pref-toolbox');
    themeSel.value = s.theme;
    gridSel.value = String(s.gridSize);
    showGridCb.checked = s.showGrid;
    snapCb.checked = s.snap;
    expCb.checked = s.showExplorer;
    propsCb.checked = s.showProperties;
    tbCb.checked = s.showToolbox;
    function apply() {
      s.theme = themeSel.value;
      s.gridSize = parseInt(gridSel.value, 10) || 8;
      s.showGrid = showGridCb.checked;
      s.snap = snapCb.checked;
      s.showExplorer = expCb.checked;
      s.showProperties = propsCb.checked;
      s.showToolbox = tbCb.checked;
      self.saveSettings();
      self.applySettings();
    }
    [themeSel, gridSel].forEach(function (x) { x.addEventListener('change', apply); });
    [showGridCb, snapCb, expCb, propsCb, tbCb].forEach(function (x) { x.addEventListener('change', apply); });
  };

  App.prototype.showAbout = function () {
    var self = this;
    var body = dialogs.el('div', 'about-body');
    body.innerHTML =
      '<div class="about-logo">' + OS.icons.svg('project', 56) + '</div>' +
      '<h2>OpenStar UML</h2>' +
      '<p class="about-ver">Version <span id="about-ver">1.0.0</span></p>' +
      '<p>A free and open-source UML modeling tool — made fully by Qwen.<br/>Model · Design · Document.</p>' +
      '<p class="about-lic">Released under the MIT License.</p>' +
      '<p class="about-tech">Supports StarUML-compatible <code>.mdj</code> projects, XMI 2.1, PNG/SVG export and PlantUML generation.</p>';
    dialogs.modal({ title: 'About', content: body, buttons: [{ label: 'OK', value: true, primary: true }] });
    if (this.bridge && this.bridge.getAppInfo) {
      this.bridge.getAppInfo().then(function (info) {
        var v = body.querySelector('#about-ver');
        if (v && info) v.textContent = info.version + (info.electron ? ' (Electron ' + info.electron + ')' : '');
      });
    }
  };

  App.prototype.showShortcuts = function () {
    var rows = [
      ['New / Open / Save', 'Ctrl+N / Ctrl+O / Ctrl+S'],
      ['Save As', 'Ctrl+Shift+S'],
      ['Undo / Redo', 'Ctrl+Z / Ctrl+Shift+Z'],
      ['Cut / Copy / Paste', 'Ctrl+X / Ctrl+C / Ctrl+V'],
      ['Duplicate', 'Ctrl+D'],
      ['Delete selection', 'Delete'],
      ['Select all', 'Ctrl+A'],
      ['Rename', 'F2 or double-click'],
      ['Zoom in / out / actual / fit', 'Ctrl+= / Ctrl+- / Ctrl+0 / Ctrl+Shift+F'],
      ['Pan canvas', 'Space+drag or middle-mouse drag'],
      ['Nudge selection', 'Arrow keys (Shift = grid step)'],
      ['Constrain move axis', 'Shift while dragging'],
      ['Cancel current tool', 'Esc'],
      ['Keep tool after placement', 'Shift+click']
    ];
    var body = dialogs.el('div');
    body.innerHTML = '<table class="shortcuts-table">' + rows.map(function (r) {
      return '<tr><td>' + r[0] + '</td><td><code>' + r[1] + '</code></td></tr>';
    }).join('') + '</table>';
    dialogs.modal({ title: 'Keyboard Shortcuts', content: body, wide: true, buttons: [{ label: 'OK', value: true, primary: true }] });
  };

  App.prototype.showLicense = function () {
    var body = dialogs.el('div');
    body.innerHTML = '<pre class="license-text">MIT License\n\nCopyright (c) 2026 OpenStar UML contributors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.</pre>';
    dialogs.modal({ title: 'License', content: body, wide: true, buttons: [{ label: 'OK', value: true, primary: true }] });
  };

  /* ============================ status bar controls ============================ */

  App.prototype.buildStatusControls = function () {
    var self = this;
    var host = this.dom.statusRight;
    if (!host) return;
    function btn(label, title, fn) {
      var b = document.createElement('button');
      b.className = 'status-btn';
      b.textContent = label;
      b.title = title;
      b.addEventListener('click', fn);
      host.appendChild(b);
      return b;
    }
    btn('−', 'Zoom Out', function () { self.editor.zoomOut(); });
    this.dom.zoomLabel = document.createElement('button');
    this.dom.zoomLabel.className = 'status-btn zoom-label';
    this.dom.zoomLabel.textContent = '100%';
    this.dom.zoomLabel.title = 'Actual Size';
    this.dom.zoomLabel.addEventListener('click', function () { self.editor.zoomActual(); });
    host.appendChild(this.dom.zoomLabel);
    btn('+', 'Zoom In', function () { self.editor.zoomIn(); });
    btn('Fit', 'Fit to Window', function () { self.editor.zoomFit(); });
    var gridBtn = btn('⌗', 'Toggle Grid', function () { self.runCommand('toggle-grid'); });
    gridBtn.classList.add('grid-toggle');
  };

  /* ============================ browser toolbar ============================ */

  App.prototype.buildBrowserToolbar = function () {
    var self = this;
    var tb = this.dom.toolbar;
    tb.style.display = 'flex';
    function textBtn(label, title, cmd) {
      var b = document.createElement('button');
      b.className = 'tb-btn tb-text';
      b.title = title;
      b.textContent = label;
      b.addEventListener('click', function () { self.runCommand(cmd); });
      tb.appendChild(b);
      return b;
    }
    textBtn('🗋', 'New Project (Ctrl+N)', 'new-project');
    textBtn('📂', 'Open… (Ctrl+O)', 'open-project');
    textBtn('💾', 'Save (Ctrl+S)', 'save-project');
    tb.appendChild(dialogs.el('span', 'tb-sep'));
    textBtn('↶', 'Undo (Ctrl+Z)', 'undo');
    textBtn('↷', 'Redo (Ctrl+Shift+Z)', 'redo');
    tb.appendChild(dialogs.el('span', 'tb-sep'));
    textBtn('🖨', 'Print Diagram', 'print');
  };

  /* ============================ boot ============================ */

  function boot() {
    var app = new App();
    global.openstarApp = app;
    if (global.document) global.document.body.classList.add('app-ready');
  }

  OS.App = App;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
