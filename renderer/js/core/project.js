/*
 * OpenStar UML — Project container: element registry, transactions with
 * snapshot-based undo/redo, dirty tracking and event dispatch.
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};
  var util = OS.util, meta = OS.meta, model = OS.model;

  /* ============================ tiny event emitter ============================ */

  function Emitter() { this._handlers = {}; }
  Emitter.prototype.on = function (evt, fn) {
    (this._handlers[evt] = this._handlers[evt] || []).push(fn);
    return fn;
  };
  Emitter.prototype.off = function (evt, fn) {
    var list = this._handlers[evt];
    if (list) util.removeItem(list, fn);
  };
  Emitter.prototype.emit = function (evt, arg) {
    var list = this._handlers[evt];
    if (list) list.slice().forEach(function (fn) { fn(arg); });
  };

  /* ============================ Project ============================ */

  /* Maximum undo/redo entries kept in memory. Each entry stores two full
   * state snapshots, so an unbounded stack on a large project is a memory
   * DoS. Oldest entries are dropped first (FIFO). */
  var UNDO_LIMIT = 100;

  function Project() {
    Emitter.call(this);
    this.byId = new Map();      // _id -> element (models, diagrams, views)
    this.root = null;
    this.filePath = null;
    this.fileName = null;
    this.dirty = false;
    this.UNDO_LIMIT = UNDO_LIMIT;
    this._undo = [];
    this._redo = [];
    this._transactDepth = 0;
    this._transactBefore = null;
    this._transactLabel = '';
  }
  Project.prototype = Object.create(Emitter.prototype);
  Project.prototype.constructor = Project;

  /* ---------- registry ---------- */

  Project.prototype._register = function (el) {
    if (el && el._id) {
      // re-register descendants too (used after paste/import of subtrees)
      this.byId.set(el._id, el);
    }
    return el;
  };
  Project.prototype.registerTree = function (el) {
    this._register(el);
    model.descendants(el).forEach(this._register, this);
  };
  Project.prototype._unregister = function (el) {
    if (el && el._id) this.byId.delete(el._id);
    model.descendants(el).forEach(function (d) {
      if (d._id) this.byId.delete(d._id);
    }, this);
    return el;
  };
  Project.prototype.get = function (id) { return this.byId.get(id) || null; };

  Project.prototype.eachElement = function (fn) {
    this.byId.forEach(function (el) { fn(el); });
  };

  Project.prototype.eachDiagram = function (fn) {
    this.byId.forEach(function (el) {
      if (meta.isDiagramLike(el._type)) fn(el);
    });
  };

  Project.prototype.diagrams = function () {
    var out = [];
    this.eachDiagram(function (d) { out.push(d); });
    // deterministic order: tree order
    var order = [];
    (function walk(el) {
      order.push(el);
      (el.ownedElements || []).forEach(walk);
    })(this.root);
    var rank = new Map();
    order.forEach(function (el, i) { rank.set(el, i); });
    out.sort(function (a, b) { return (rank.get(a) || 0) - (rank.get(b) || 0); });
    return out;
  };

  /** All model elements (excluding project root, diagrams and views). */
  Project.prototype.models = function () {
    var out = [];
    this.byId.forEach(function (el) {
      if (el === this.root) return;
      if (meta.isDiagramLike(el._type)) return;
      if (/View$/.test(el._type)) return;
      out.push(el);
    }, this);
    return out;
  };

  /* ---------- lifecycle ---------- */

  Project.prototype.newProject = function () {
    this.byId.clear();
    this._undo = [];
    this._redo = [];
    this.root = model.createElement(this, 'Project', { name: 'Untitled' });
    var m = model.createElement(this, 'UMLModel', { name: 'Model' });
    model.addOwned(this, this.root, m);
    var d = model.createElement(this, 'UMLClassDiagram', { name: 'Main', defaultDiagram: true });
    model.addOwned(this, m, d);
    this.filePath = null;
    this.fileName = null;
    this.setDirty(false);
    this.emit('loaded', { reason: 'new' });
    return this;
  };

  Project.prototype.setDirty = function (d) {
    if (this.dirty !== d) {
      this.dirty = d;
      this.emit('dirty', d);
    }
  };

  /* ---------- transactions / undo ---------- */

  /**
   * Run `fn` as one undoable transaction.
   * Nested transactions merge into the outer one.
   */
  Project.prototype.transact = function (label, fn) {
    if (this._transactDepth === 0) {
      // Snapshot before-state only when the undo stack can actually hold it:
      // on huge projects stateJSON() is expensive and an entry that gets
      // dropped again immediately is pure waste.
      if (this._undo.length >= this.UNDO_LIMIT) this._undo.shift();
      this._transactBefore = OS.Mdj.stateJSON(this);
      this._transactLabel = label;
    }
    this._transactDepth++;
    var result;
    try {
      result = fn();
    } catch (e) {
      this._transactDepth--;
      if (this._transactDepth === 0) {
        // roll back failed transaction
        OS.Mdj.loadState(this, this._transactBefore);
        this._transactBefore = null;
        this.emit('restored', { label: 'rollback' });
      }
      throw e;
    }
    this._transactDepth--;
    if (this._transactDepth === 0) {
      var after = OS.Mdj.stateJSON(this);
      var before = this._transactBefore;
      this._transactBefore = null;
      if (before !== after) {
        this._pushUndoEntry({ label: this._transactLabel || label, before: before, after: after });
        this._redo.length = 0;
        this.setDirty(true);
        this.emit('change', { label: label, structural: true });
      }
    }
    return result;
  };

  /**
   * Append an undo entry with history capping in one place. The old code
   * pushed first and shifted afterwards, which made a freshly captured
   * snapshot disposable work when the stack was already full.
   */
  Project.prototype._pushUndoEntry = function (entry) {
    while (this._undo.length >= this.UNDO_LIMIT) this._undo.shift();
    this._undo.push(entry);
  };

  Project.prototype.canUndo = function () { return this._undo.length > 0; };
  Project.prototype.canRedo = function () { return this._redo.length > 0; };
  Project.prototype.undoLabel = function () { return this._undo.length ? this._undo[this._undo.length - 1].label : ''; };
  Project.prototype.redoLabel = function () { return this._redo.length ? this._redo[0].label : ''; };

  /**
   * Push an undo entry for mutations that already happened outside transact()
   * (e.g. continuous mouse drags). `beforeJSON` is a stateJSON captured before
   * the gesture started.
   */
  Project.prototype._pushStateUndo = function (label, beforeJSON) {
    var after = OS.Mdj.stateJSON(this);
    if (beforeJSON === after) return false;
    this._pushUndoEntry({ label: label, before: beforeJSON, after: after });
    this._redo.length = 0;
    this.setDirty(true);
    this.emit('change', { label: label, structural: true });
    return true;
  };

  Project.prototype.undo = function () {
    var entry = this._undo.pop();
    if (!entry) return false;
    OS.Mdj.loadState(this, entry.before);
    // cap redo symmetrically: a redo entry pushed onto an already-full stack
    // would be immediately unreachable via undo() and leak memory.
    while (this._redo.length >= this.UNDO_LIMIT) this._redo.shift();
    this._redo.push(entry);
    this.setDirty(true);
    this.emit('restored', { label: entry.label });
    return true;
  };

  Project.prototype.redo = function () {
    var entry = this._redo.pop();
    if (!entry) return false;
    OS.Mdj.loadState(this, entry.after);
    this._undo.push(entry);
    this.setDirty(true);
    this.emit('restored', { label: entry.label });
    return true;
  };

  Project.prototype.clearHistory = function () {
    this._undo = [];
    this._redo = [];
  };

  /* ---------- queries ---------- */

  Project.prototype.defaultDiagram = function () {
    var found = null;
    this.eachDiagram(function (d) { if (d.defaultDiagram && !found) found = d; });
    return found || this.diagrams()[0] || null;
  };

  /** Owner (namespace) used when creating new elements from the Model menu. */
  Project.prototype.firstModel = function () {
    var kids = this.root && this.root.ownedElements ? this.root.ownedElements : [];
    return kids[0] || null;
  };

  /** Generate a unique sibling name like StarUML (Class1, Class2...). */
  Project.prototype.uniqueName = function (parent, base) {
    return model.uniqueName(parent, base);
  };

  /* ---------- view factory ---------- */

  /**
   * Create a view for `modelEl` on `diagram`.
   * opts: {x, y, width, height, head, tail, points, preset}
   */
  Project.prototype.createView = function (diagram, modelEl, opts) {
    opts = opts || {};
    var viewType = meta.MODEL_TO_VIEW[modelEl._type];
    if (!viewType) return null;
    var view = {
      _type: viewType,
      _id: util.genId(),
      _parent: diagram,
      model: modelEl,
      visible: true,
      font: OS.text.DEFAULT_FONT
    };
    if (meta.isEdgeView(viewType)) {
      view.head = opts.head || null;
      view.tail = opts.tail || null;
      view.points = opts.points || [];
      view.lineStyle = opts.lineStyle || 'ortho';
    } else {
      var size = model.DEFAULT_SIZES[viewType] || { w: 100, h: 60 };
      view.left = opts.x !== undefined ? opts.x : 0;
      view.top = opts.y !== undefined ? opts.y : 0;
      view.width = opts.width || size.w;
      view.height = opts.height || size.h;
      view.wordWrap = false;
      view.showVisibility = true;
      view.showNamespace = false;
      view.showProperty = true;
      view.showType = true;
      view.showMultiplicity = true;
      view.suppressAttributes = false;
      view.suppressOperations = false;
      view.suppressLiterals = false;
      view.containerView = null;
    }
    model.addView(this, diagram, view);
    // auto-fit initial size from content
    if (OS.views && OS.views.autoLayout) OS.views.autoLayout(view, { growOnly: true });
    return view;
  };

  /** Types that stay unnamed unless the user names them (StarUML behavior). */
  var NO_AUTO_NAME = {
    'UMLPseudostate': 1, 'UMLFinalState': 1, 'UMLInitialNode': 1, 'UMLActivityFinalNode': 1,
    'UMLFlowFinalNode': 1, 'UMLDecisionNode': 1, 'UMLMergeNode': 1, 'UMLForkNode': 1,
    'UMLJoinNode': 1, 'UMLNoteLink': 1, 'UMLAssociationEnd': 1, 'UMLRegion': 1
  };

  /** Create a new model element owned by `owner`, with default naming. */
  Project.prototype.createElement = function (owner, type, props) {
    var base = meta.label(type).replace(/\s+/g, '');
    var el = model.createElement(this, type, props);
    var desc = meta.typeDescriptor(type);
    var isRelationship = desc.category === 'relationship';
    if (!el.name && !isRelationship && !NO_AUTO_NAME[type]) {
      el.name = this.uniqueName(owner, base + '1');
    }
    if (owner) model.addOwned(this, owner, el);
    return el;
  };

  OS.Emitter = Emitter;
  OS.Project = Project;
})(typeof window !== 'undefined' ? window : globalThis);
