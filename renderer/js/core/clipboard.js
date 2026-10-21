/*
 * OpenStar UML — clipboard: capture selected views (+ their models) as
 * relocatable JSON, and paste them back with fresh ids.
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};
  var util = OS.util, meta = OS.meta, model = OS.model;

  var CHILD_LISTS = model.CHILD_LISTS;
  var REF_FIELDS = ['source', 'target', 'reference', 'classifier', 'represent', 'stereotype', 'type'];

  function capture(project, diagram, selectedViews) {
    var sel = selectedViews.slice();
    var selSet = new Set(sel);
    var idMap = {};
    function newId(old) {
      if (!idMap[old]) idMap[old] = util.genId();
      return idMap[old];
    }

    // models to copy: node-view models; edge models only when both ends selected
    var rootModels = [];
    sel.forEach(function (v) {
      if (!v.model) return;
      var isEdge = meta.isEdgeView(v._type) || v._type === 'UMLSeqMessageView';
      if (isEdge) {
        if (v.head && v.tail && selSet.has(v.head) && selSet.has(v.tail)) rootModels.push(v.model);
      } else {
        rootModels.push(v.model);
      }
    });

    // pre-assign ids for all descendants of copied models
    var copiedModels = new Set();
    rootModels.forEach(function (m) {
      newId(m._id);
      copiedModels.add(m);
      model.descendants(m).forEach(function (d) {
        if (d._type && !/View$/.test(d._type)) { newId(d._id); copiedModels.add(d); }
      });
    });

    function serializeEl(el) {
      var raw = { _type: el._type, _id: newId(el._id) };
      for (var k in el) {
        if (!Object.prototype.hasOwnProperty.call(el, k)) continue;
        if (k === '_id' || k === '_type' || k === '_parent' || k === 'ext') continue;
        var v = el[k];
        if (Array.isArray(v) && CHILD_LISTS.indexOf(k) >= 0) {
          raw[k] = v.map(serializeEl);
          continue;
        }
        if (v && typeof v === 'object' && v._id) {
          raw[k] = { $ref: idMap[v._id] || v._id }; // remapped or external
          continue;
        }
        raw[k] = util.clone(v);
      }
      if (el.ext) raw.__ext = util.clone(el.ext);
      return raw;
    }

    var rawModels = rootModels.map(serializeEl);
    var rawViews = sel.filter(function (v) {
      // only copy a view if its model is part of the copied set
      return v.model && copiedModels.has(v.model);
    }).map(function (v) {
      var raw = {
        _type: v._type, _id: newId(v._id),
        model: v.model ? (idMap[v.model._id] || null) : null,
        left: v.left, top: v.top, width: v.width, height: v.height,
        points: (v.points || []).map(function (p) { return [p.x, p.y]; }),
        head: v.head ? (selSet.has(v.head) ? newId(v.head._id) : null) : null,
        tail: v.tail ? (selSet.has(v.tail) ? newId(v.tail._id) : null) : null,
        font: v.font, lineStyle: v.lineStyle
      };
      ['fillColor', 'lineColor', 'wordWrap', 'showVisibility', 'showNamespace', 'showProperty',
        'showType', 'showMultiplicity', 'suppressAttributes', 'suppressOperations',
        'suppressLiterals'].forEach(function (k) {
        if (v[k] !== undefined) raw[k] = v[k];
      });
      return raw;
    });
    return { models: rawModels, views: rawViews, diagramType: diagram ? diagram._type : null };
  }

  function deserializeInto(project, diagram, data, offX, offY, ownerOverride) {
    offX = offX || 0; offY = offY || 0;
    var idMap = {};
    function mapId(old) {
      if (!old) return null;
      if (!idMap[old]) idMap[old] = util.genId();
      return idMap[old];
    }

    var owner = ownerOverride || diagram._parent || project.firstModel();
    var createdRoots = [];
    var byRawId = new Map();

    function buildEl(raw, parent) {
      var el = { _type: raw._type, _id: mapId(raw._id), _parent: parent || null, ext: raw.__ext ? util.clone(raw.__ext) : {} };
      byRawId.set(raw._id, el);
      for (var k in raw) {
        if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
        if (k === '_id' || k === '_type' || k === '_parent' || k === '__ext') continue;
        var v = raw[k];
        if (Array.isArray(v) && CHILD_LISTS.indexOf(k) >= 0) {
          el[k] = v.map(function (c) { return buildEl(c, el); });
          continue;
        }
        if (v && typeof v === 'object' && v.$ref) {
          // resolve now if already built (child lists processed before refs of siblings?)
          el[k] = { __pendingRef: v.$ref };
          continue;
        }
        el[k] = util.clone(v);
      }
      return el;
    }

    var rawModels = data.models || [];
    rawModels.forEach(function (raw) {
      var el = buildEl(raw, owner);
      createdRoots.push(el);
    });

    // resolve pending refs (depth-first with cycle guard: elements link via _parent)
    var visitedRefs = new Set();
    function resolveRefs(o) {
      if (!o || typeof o !== 'object' || visitedRefs.has(o)) return;
      visitedRefs.add(o);
      for (var k in o) {
        if (k === '_parent' || k === 'ext' || !Object.prototype.hasOwnProperty.call(o, k)) continue;
        var v = o[k];
        if (!v || typeof v !== 'object') continue;
        if (v.__pendingRef) {
          o[k] = byRawId.get(v.__pendingRef) || project.get(v.__pendingRef) || null;
        } else if (Array.isArray(v)) {
          v.forEach(resolveRefs);
        } else {
          resolveRefs(v);
        }
      }
    }
    createdRoots.forEach(resolveRefs);

    createdRoots.forEach(function (el) {
      model.addOwned(project, owner, el);
    });

    // views
    var newViews = [];
    var viewByRawId = new Map();
    (data.views || []).forEach(function (raw) {
      var v = {
        _type: raw._type, _id: mapId(raw._id), _parent: diagram,
        model: null, visible: true,
        font: raw.font || OS.text.DEFAULT_FONT
      };
      ['fillColor', 'lineColor', 'wordWrap', 'showVisibility', 'showNamespace', 'showProperty',
        'showType', 'showMultiplicity', 'suppressAttributes', 'suppressOperations',
        'suppressLiterals', 'lineStyle'].forEach(function (k) {
        if (raw[k] !== undefined) v[k] = raw[k];
      });
      var isEdge = meta.isEdgeView(raw._type) || raw._type === 'UMLSeqMessageView';
      if (isEdge) {
        v.points = (raw.points || []).map(function (p) { return { x: p[0] + (raw.head && raw.tail ? 0 : offX), y: p[1] + (raw.head && raw.tail ? 0 : offY) }; });
        v.head = null; v.tail = null;
        v._pendingHead = raw.head; v._pendingTail = raw.tail;
        v.showVisibility = raw.showVisibility !== false;
      } else {
        v.left = (raw.left || 0) + offX;
        v.top = (raw.top || 0) + offY;
        v.width = raw.width || 60;
        v.height = raw.height || 40;
        v.containerView = null;
      }
      v._pendingModel = raw.model;
      viewByRawId.set(raw._id, v);
      model.addView(project, diagram, v);
      newViews.push(v);
    });
    // resolve view refs (ids inside data are capture-time ids; byRawId/viewByRawId key on them)
    newViews.forEach(function (v) {
      if (v._pendingModel) v.model = byRawId.get(v._pendingModel) || null;
      delete v._pendingModel;
      if (v._pendingHead !== undefined) {
        v.head = v._pendingHead ? (viewByRawId.get(v._pendingHead) || null) : null;
        v.tail = v._pendingTail ? (viewByRawId.get(v._pendingTail) || null) : null;
        delete v._pendingHead; delete v._pendingTail;
      }
    });
    if (OS.views && OS.views.assignContainers) OS.views.assignContainers(diagram);
    return newViews;
  }

  OS.clipboard = {
    capture: capture,
    deserializeInto: deserializeInto
  };
})(typeof window !== 'undefined' ? window : globalThis);
