/*
 * OpenStar UML — model runtime: element creation, ownership, deletion
 * cascades and display-text formatting. Works on plain objects so the same
 * code runs in the renderer and in Node (tests).
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};
  var util = OS.util, meta = OS.meta, text = OS.text;

  var CHILD_LISTS = ['ownedElements', 'ownedAttributes', 'ownedOperations', 'ownedLiterals',
    'ownedEnds', 'parameters', 'ownedViews'];

  /* ============================ element lifecycle ============================ */

  /**
   * Create a detached element of `type`. Register with project if given.
   */
  function createElement(project, type, props) {
    var el = meta.defaults(type);
    el._type = type;
    el._id = util.genId();
    el._parent = null;
    if (props) for (var k in props) el[k] = props[k];
    if (project) project._register(el);
    return el;
  }

  /** Append `child` to `parent`'s child list (default ownedElements). */
  function addOwned(project, parent, child, listName) {
    listName = listName || 'ownedElements';
    if (!parent[listName]) parent[listName] = [];
    child._parent = parent;
    parent[listName].push(child);
    if (project) project._register(child);
    return child;
  }

  /** Add a view to a diagram. */
  function addView(project, diagram, view) {
    if (!diagram.ownedViews) diagram.ownedViews = [];
    view._parent = diagram;
    diagram.ownedViews.push(view);
    if (project) project._register(view);
    return view;
  }

  function removeOwned(parent, child) {
    var removed = false;
    for (var i = 0; i < CHILD_LISTS.length; i++) {
      var list = parent[CHILD_LISTS[i]];
      if (list && util.removeItem(list, child)) removed = true;
    }
    if (removed) child._parent = null;
    return removed;
  }

  /** Collect all descendants (elements + views) of el, excluding el. */
  function descendants(el, out) {
    out = out || [];
    for (var i = 0; i < CHILD_LISTS.length; i++) {
      var list = el[CHILD_LISTS[i]];
      if (!list) continue;
      for (var j = 0; j < list.length; j++) {
        out.push(list[j]);
        descendants(list[j], out);
      }
    }
    return out;
  }

  /** All views of a model element across all diagrams. */
  function viewsOf(project, model) {
    var out = [];
    project.eachDiagram(function (d) {
      (d.ownedViews || []).forEach(function (v) { if (v.model === model) out.push(v); });
    });
    return out;
  }

  /* ============================ deletion cascade ============================ */

  /**
   * Delete a model element and everything implied:
   *  - descendants (recursive)
   *  - all views referencing deleted models (any diagram)
   *  - relationships whose source/target/end references a deleted model
   *  - association ends of deleted associations
   * Mirrors StarUML semantics.
   */
  function deleteModel(project, el) {
    var doomed = collectDoomedModels(project, [el]);
    // remove views of doomed models first (cascades edge views)
    doomed.forEach(function (m) {
      viewsOf(project, m).slice().forEach(function (v) { deleteView(project, v, doomed); });
    });
    // remove from parent list
    if (el._parent) removeOwned(el._parent, el);
    doomed.forEach(function (m) { project._unregister(m); });
    return doomed;
  }

  function collectDoomedModels(project, seeds) {
    var doomed = new Set();
    seeds.forEach(function add(el) {
      if (!el || doomed.has(el)) return;
      doomed.add(el);
      descendants(el).forEach(add);
    });
    // relationships referencing doomed models
    var changed = true;
    while (changed) {
      changed = false;
      project.eachElement(function (m) {
        if (doomed.has(m) || meta.isDiagramLike(m._type) || m._type === 'Project') return;
        if (relationshipTouches(m, doomed)) { doomed.add(m); changed = true; }
      });
    }
    return doomed;
  }

  function relationshipTouches(m, doomed) {
    var d = meta.typeDescriptor(m._type);
    if (m.source && doomed.has(m.source)) return true;
    if (m.target && doomed.has(m.target)) return true;
    if (m.ownedEnds) {
      for (var i = 0; i < m.ownedEnds.length; i++) {
        if (m.ownedEnds[i].reference && doomed.has(m.ownedEnds[i].reference)) return true;
      }
    }
    return false;
  }

  /**
   * Delete a single view. Edge views also delete their model (StarUML behavior).
   * Contained views are deleted. `doomedModels` optional set of models already being deleted.
   */
  function deleteView(project, view, doomedModels) {
    var diagram = view._parent;
    if (!diagram) return;
    var removed = [];
    // contained views
    (diagram.ownedViews || []).slice().forEach(function (v) {
      if (v.containerView === view) removed.push(deleteView(project, v, doomedModels));
    });
    // edges attached to this view
    (diagram.ownedViews || []).slice().forEach(function (v) {
      if (v !== view && (v.head === view || v.tail === view)) {
        removed.push(deleteView(project, v, doomedModels));
      }
    });
    if (doomedModels) doomedModels.forEach(function () { });
    // if edge view: delete its model too (unless already doomed)
    var model = view.model;
    util.removeItem(diagram.ownedViews, view);
    project._unregister(view);
    removed.unshift(view);
    if (model && meta.isEdgeView(view._type)) {
      if (!doomedModels || !doomedModels.has || !doomedModels.has(model)) {
        // detach from owner
        if (model._parent) removeOwned(model._parent, model);
        project._unregister(model);
      }
    }
    return removed;
  }

  /* ============================ naming helpers ============================ */

  function uniqueName(parent, base) {
    var list = [];
    CHILD_LISTS.forEach(function (ln) { if (parent && parent[ln]) list = list.concat(parent[ln]); });
    var names = new Set(list.map(function (c) { return c.name; }));
    if (!names.has(base)) return base;
    var m = /^(.*?)(\d+)$/.exec(base);
    var stem = m ? m[1] : base, n = m ? parseInt(m[2], 10) + 1 : 1;
    while (names.has(stem + n)) n++;
    return stem + n;
  }

  /* ============================ display formatting ============================ */

  function visibilityMark(v) {
    switch (v) {
      case 'private': return '-';
      case 'protected': return '#';
      case 'package': return '~';
      default: return '+';
    }
  }

  function typeName(t) {
    if (!t) return '';
    if (typeof t === 'string') return t;
    if (t.name) return t.name;
    return '';
  }

  function stereotypeText(el) {
    if (!el || !el.stereotype) return '';
    if (typeof el.stereotype === 'string') return el.stereotype;
    if (el.stereotype.name) return el.stereotype.name;
    return '';
  }

  function formatAttribute(attr, opts) {
    opts = opts || {};
    var s = '';
    if (opts.showVisibility !== false) s += visibilityMark(attr.visibility);
    s += (attr.name || '');
    var type = typeName(attr.type);
    var showType = opts.showType !== false;
    var showProp = opts.showProperty !== false;
    if (showType && type) s += ' : ' + type;
    if (showProp && attr.defaultValue) s += ' = ' + attr.defaultValue;
    if (opts.showMultiplicity !== false && attr.multiplicity && attr.multiplicity !== '1') s += ' [' + attr.multiplicity + ']';
    return s;
  }

  function formatParameter(p) {
    var s = '';
    if (p.direction === 'out') s += 'out ';
    else if (p.direction === 'inout') s += 'inout ';
    s += (p.name || '');
    var t = typeName(p.type);
    if (t) s += ' : ' + t;
    if (p.defaultValue) s += ' = ' + p.defaultValue;
    if (p.multiplicity && p.multiplicity !== '1' && p.multiplicity !== '') s += ' [' + p.multiplicity + ']';
    return s;
  }

  function formatOperation(op, opts) {
    opts = opts || {};
    var s = '';
    if (opts.showVisibility !== false) s += visibilityMark(op.visibility);
    s += (op.name || '') + '(';
    var params = (op.parameters || []).filter(function (p) { return p.direction !== 'return'; });
    s += params.map(formatParameter).join(', ');
    s += ')';
    var ret = (op.parameters || []).filter(function (p) { return p.direction === 'return'; })[0];
    var retType = ret ? typeName(ret.type) : typeName(op.type);
    if (opts.showType !== false && retType) s += ' : ' + retType;
    return s;
  }

  function formatLiteral(lit) { return lit.name || ''; }

  function formatTransition(t) {
    var parts = [];
    if (t.name) parts.push(t.name);
    if (t.trigger) parts.push(t.trigger);
    var label = parts.join(' ');
    if (t.guard) label += ' [' + t.guard + ']';
    if (t.effect) label += ' / ' + t.effect;
    return label;
  }

  function formatMessage(m) {
    var s = m.name || '';
    if (m.arguments) s += '(' + m.arguments + ')';
    return s;
  }

  function formatControlFlow(f) {
    var s = f.name || '';
    if (f.guard) s += (s ? ' ' : '') + '[' + f.guard + ']';
    return s;
  }

  /** End labels for association views. */
  function formatEndRole(end, opts) {
    opts = opts || {};
    if (!end) return '';
    var s = '';
    if (opts.showVisibility !== false && end.visibility && end.visibility !== 'public') s += visibilityMark(end.visibility);
    else if (opts.showVisibility !== false && end.visibility === 'public') s += '';
    s += (end.name || '');
    return s;
  }

  function formatMultiplicity(m) {
    if (!m || m === '1' || m === '') return m === '*' ? '*' : (m || '');
    return m;
  }

  /* ============================ default view sizes ============================ */

  var DEFAULT_SIZES = {
    'UMLClassView': { w: 100, h: 78 },
    'UMLInterfaceView': { w: 100, h: 56 },
    'UMLEnumerationView': { w: 100, h: 78 },
    'UMLDataTypeView': { w: 100, h: 50 },
    'UMLPackageView': { w: 120, h: 80 },
    'UMLModelView': { w: 120, h: 80 },
    'UMLSubsystemView': { w: 120, h: 80 },
    'UMLActorView': { w: 48, h: 70 },
    'UMLUseCaseView': { w: 120, h: 60 },
    'UMLComponentView': { w: 120, h: 70 },
    'UMLArtifactView': { w: 120, h: 60 },
    'UMLNodeView': { w: 140, h: 90 },
    'UMLInstanceView': { w: 120, h: 60 },
    'UMLStateMachineView': { w: 120, h: 60 },
    'UMLActivityView': { w: 120, h: 60 },
    'UMLStateView': { w: 90, h: 40 },
    'UMLCompositeStateView': { w: 180, h: 120 },
    'UMLPseudostateView': { w: 20, h: 20 },
    'UMLFinalStateView': { w: 26, h: 26 },
    'UMLActionView': { w: 100, h: 40 },
    'UMLObjectNodeView': { w: 100, h: 40 },
    'UMLInitialNodeView': { w: 20, h: 20 },
    'UMLActivityFinalNodeView': { w: 26, h: 26 },
    'UMLFlowFinalNodeView': { w: 26, h: 26 },
    'UMLDecisionNodeView': { w: 40, h: 30 },
    'UMLMergeNodeView': { w: 40, h: 30 },
    'UMLForkNodeView': { w: 100, h: 6 },
    'UMLJoinNodeView': { w: 100, h: 6 },
    'UMLSeqLifelineView': { w: 110, h: 50 },
    'UMLCombinedFragmentView': { w: 160, h: 120 },
    'UMLNoteView': { w: 100, h: 50 },
    'UMLConstraintView': { w: 100, h: 50 }
  };

  OS.model = {
    CHILD_LISTS: CHILD_LISTS,
    createElement: createElement,
    addOwned: addOwned,
    addView: addView,
    removeOwned: removeOwned,
    descendants: descendants,
    viewsOf: viewsOf,
    deleteModel: deleteModel,
    deleteView: deleteView,
    collectDoomedModels: collectDoomedModels,
    uniqueName: uniqueName,
    visibilityMark: visibilityMark,
    typeName: typeName,
    stereotypeText: stereotypeText,
    formatAttribute: formatAttribute,
    formatOperation: formatOperation,
    formatParameter: formatParameter,
    formatLiteral: formatLiteral,
    formatTransition: formatTransition,
    formatMessage: formatMessage,
    formatControlFlow: formatControlFlow,
    formatEndRole: formatEndRole,
    formatMultiplicity: formatMultiplicity,
    DEFAULT_SIZES: DEFAULT_SIZES
  };
})(typeof window !== 'undefined' ? window : globalThis);
