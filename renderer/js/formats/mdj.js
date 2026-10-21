/*
 * OpenStar UML — .mdj file format (StarUML-compatible JSON).
 *
 * serialize(project)  → full .mdj file text (with StarUML-style subViews)
 * stateJSON(project)  → compact state text used for undo snapshots
 * load(project, text) → replace project contents from .mdj text (tolerant)
 * loadState(...)      → same, for undo snapshots
 *
 * Tolerance rules: unknown element/view/diagram types are preserved verbatim
 * (round-trip safe) and rendered with placeholders. Missing fields get
 * StarUML defaults.
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};
  var util = OS.util, meta = OS.meta, model = OS.model;

  var REF_FIELDS_COMMON = ['stereotype'];

  /* ============================ writer ============================ */

  function refOf(el) { return el && el._id ? { $ref: el._id } : undefined; }

  function knownKeys(type) {
    var d = meta.TYPES[type];
    var keys = new Set(['_type', '_id', '_parent']);
    if (d && d.defaults) {
      var def = d.defaults();
      Object.keys(def).forEach(function (k) { keys.add(k); });
    }
    ['name', 'stereotype', 'visibility', 'documentation', 'tags', 'ownedElements',
      'ownedAttributes', 'ownedOperations', 'ownedLiterals', 'ownedEnds', 'parameters',
      'ownedViews', 'source', 'target', 'reference', 'represent', 'classifier',
      'type', 'defaultValue', 'multiplicity', 'isStatic', 'isAbstract', 'isLeaf',
      'isReadOnly', 'isOrdered', 'isUnique', 'isID', 'isQuery', 'concurrency',
      'isDerived', 'navigable', 'aggregation', 'kind', 'operator', 'messageSort',
      'arguments', 'trigger', 'guard', 'effect', 'entryActivity', 'doActivity',
      'exitActivity', 'fileName', 'isFinalSpecialization', 'isMultiInstance',
      'defaultDiagram', 'specification', 'checked', 'value'].forEach(function (k) { keys.add(k); });
    return keys;
  }

  function writeElement(el, fileMode) {
    var raw = { _type: el._type, _id: el._id };
    if (el._parent) raw._parent = refOf(el._parent);
    // preserved unknown fields first (known fields override)
    if (el.ext) for (var ek in el.ext) raw[ek] = util.clone(el.ext[ek]);
    var known = knownKeys(el._type);
    for (var k in el) {
      if (!Object.prototype.hasOwnProperty.call(el, k)) continue;
      if (k === '_type' || k === '_id' || k === '_parent' || k === 'ext') continue;
      if (k === 'containerView') { if (!fileMode) raw.containerView = refOf(el[k]); continue; }
      if (k === 'ownedViews') continue; // diagrams handled below
      var v = el[k];
      if (Array.isArray(v) && v.length && v[0] && v[0]._type) {
        raw[k] = v.map(function (c) { return writeElement(c, fileMode); });
        continue;
      }
      if (v === null || v === undefined) continue;
      if (v && typeof v === 'object' && v._id) { raw[k] = refOf(v); continue; }
      raw[k] = util.clone(v);
    }
    // diagrams
    if (meta.isDiagram(el._type) || el.ownedViews) {
      raw.ownedElements = (el.ownedElements || []).map(function (c) { return writeElement(c, fileMode); });
      if (fileMode) {
        raw.ownedViews = (el.ownedViews || []).map(function (v) { return writeView(v, fileMode); });
      } else {
        raw.ownedViews = (el.ownedViews || []).map(function (v) { return writeViewState(v); });
      }
    }
    return raw;
  }

  /* ---- state (snapshot) view serialization: compact, lossless for us ---- */
  function writeViewState(v) {
    var raw = { _type: v._type, _id: v._id };
    if (v._parent) raw._parent = refOf(v._parent);
    raw.model = refOf(v.model);
    if (v.head) raw.head = refOf(v.head);
    if (v.tail) raw.tail = refOf(v.tail);
    if (v.containerView) raw.containerView = refOf(v.containerView);
    ['left', 'top', 'width', 'height', 'font', 'fillColor', 'lineColor', 'visible',
      'wordWrap', 'showVisibility', 'showNamespace', 'showProperty', 'showType',
      'showMultiplicity', 'suppressAttributes', 'suppressOperations', 'suppressLiterals',
      'lineStyle'].forEach(function (k) {
      if (v[k] !== undefined && v[k] !== null) raw[k] = v[k];
    });
    if (v.points) raw.points = v.points.map(function (p) { return [p.x, p.y]; });
    return raw;
  }

  /* ---- file view serialization: StarUML-compatible ---- */
  function labelView(id, parentId, opts) {
    var l = {
      _type: 'LabelView', _id: id, _parent: { $ref: parentId },
      visible: opts.visible !== false, font: opts.font || OS.text.DEFAULT_FONT,
      left: Math.round(opts.left || 0), top: Math.round(opts.top || 0),
      width: Math.round(opts.width || 0), height: Math.round(opts.height || 13)
    };
    if (opts.text !== undefined) l.text = opts.text;
    if (opts.horizontalAlignment !== undefined) l.horizontalAlignment = opts.horizontalAlignment;
    return l;
  }

  function edgeLabelView(id, viewId, opts) {
    var l = {
      _type: 'EdgeLabelView', _id: id, _parent: { $ref: viewId },
      model: { $ref: viewId }, visible: !!opts.visible,
      font: opts.font || OS.text.DEFAULT_FONT,
      alpha: opts.alpha !== undefined ? opts.alpha : 1.5707963267948966,
      distance: opts.distance !== undefined ? opts.distance : 15
    };
    if (opts.text !== undefined) l.text = opts.text;
    if (opts.hostEdge) l.hostEdge = { $ref: viewId };
    if (opts.edgePosition !== undefined) l.edgePosition = opts.edgePosition;
    return l;
  }

  function compartmentView(id, viewId, type, rect, labels, visible, font) {
    var subs = labels.map(function (lo, i) {
      return labelView(id + '-L' + i, id, lo);
    });
    var c = {
      _type: type, _id: id, _parent: { $ref: viewId }, model: { $ref: viewId },
      subViews: subs, font: font || OS.text.DEFAULT_FONT,
      left: Math.round(rect.x), top: Math.round(rect.y),
      width: Math.round(rect.width), height: Math.round(rect.height)
    };
    if (visible === false) c.visible = false;
    return c;
  }

  function writeView(v, fileMode) {
    var isEdge = meta.isEdgeView(v._type) || v._type === 'UMLSeqMessageView';
    var raw = { _type: v._type, _id: v._id };
    if (v._parent) raw._parent = refOf(v._parent);
    if (v.ext) for (var ek in v.ext) raw[ek] = util.clone(v.ext[ek]);
    raw.model = refOf(v.model);
    if (v.font) raw.font = v.font;
    if (v.visible === false) raw.visible = false;
    if (v.fillColor) raw.fillColor = v.fillColor;
    if (v.lineColor) raw.lineColor = v.lineColor;

    if (isEdge) {
      raw.head = refOf(v.head);
      raw.tail = refOf(v.tail);
      raw.lineStyle = v.lineStyle === 'ortho' ? 2 : 1;
      if (v.points && v.points.length) {
        raw.points = v.points.map(function (p) { return Math.round(p.x) + ':' + Math.round(p.y); }).join(';');
      }
      if (v.showVisibility === false) raw.showVisibility = false;
      raw.subViews = writeEdgeSubViews(v);
      return raw;
    }

    raw.left = Math.round(v.left || 0);
    raw.top = Math.round(v.top || 0);
    raw.width = Math.round(v.width || 0);
    raw.height = Math.round(v.height || 0);
    if (v.wordWrap) raw.wordWrap = true;
    if (v.showVisibility === false) raw.showVisibility = false;
    if (v.showNamespace) raw.showNamespace = true;
    if (v.showProperty === false) raw.showProperty = false;
    if (v.showType === false) raw.showType = false;
    if (v.showMultiplicity === false) raw.showMultiplicity = false;
    if (v.suppressAttributes) raw.suppressAttributes = true;
    if (v.suppressOperations) raw.suppressOperations = true;
    if (v.suppressLiterals) raw.suppressLiterals = true;
    if (OS.views && OS.views.isContainerType && OS.views.isContainerType(v._type)) raw.containerChangeable = true;

    if (v._type === 'UMLNoteView') {
      raw.text = (v.model && v.model.documentation) || v.text || '';
      raw.subViews = [];
      return raw;
    }
    if (v._type === 'UMLSeqLifelineView') {
      raw.subViews = writeLifelineSubViews(v);
      return raw;
    }
    if (v._type === 'UMLCombinedFragmentView') {
      raw.subViews = [];
      return raw;
    }
    raw.subViews = writeNodeSubViews(v);
    return raw;
  }

  function writeNodeSubViews(v) {
    var subs = [];
    var layout = OS.views && OS.views.computeLayout ? OS.views.computeLayout(v) : null;
    var m = v.model || {};
    var font = v.font || OS.text.DEFAULT_FONT;
    var stereo = model.stereotypeText(m);

    if (layout && layout.nameCompartment) {
      var nc = layout.nameCompartment;
      var fp = OS.text.parseFont(font);
      var boldF = OS.text.fontToMdj({ family: fp.family, size: fp.size, bold: true, italic: fp.italic, underline: fp.underline });
      var nameComp = compartmentView(v._id + ':nc', v._id, 'UMLNameCompartmentView', nc.rect, [
        { visible: !!stereo, text: stereo ? '«' + stereo + '»' : '', left: nc.rect.x, top: nc.rect.y + 1, width: nc.rect.width, height: stereo ? 13 : 0, font: font },
        { visible: true, text: nc.text || m.name || '', left: nc.rect.x, top: nc.rect.y + (stereo ? 15 : 4), width: nc.rect.width, height: 13, font: boldF },
        { visible: !!v.showNamespace, text: nc.namespace ? '(' + nc.namespace + ')' : '', left: nc.rect.x, top: nc.rect.y + nc.rect.height + 2, width: nc.rect.width, height: 13, font: font },
        { visible: false, left: nc.rect.x, top: nc.rect.y, width: 0, height: 13, horizontalAlignment: 1, font: font }
      ], true, font);
      subs.push(nameComp);
    } else {
      var simple = compartmentView(v._id + ':nc', v._id, 'UMLNameCompartmentView',
        { x: v.left || 0, y: v.top || 0, width: v.width || 0, height: 0 }, [], true, font);
      subs.push(simple);
    }

    if (layout && layout.compartments) {
      layout.compartments.forEach(function (c, ci) {
        var typeMap = { attributes: 'UMLAttributeCompartmentView', operations: 'UMLOperationCompartmentView', literals: 'UMLEnumerationLiteralCompartmentView', receptions: 'UMLReceptionCompartmentView' };
        var cv = compartmentView(v._id + ':c' + ci, v._id, typeMap[c.id] || 'UMLAttributeCompartmentView', c.rect,
          (c.lines || []).map(function (ln) {
            return { visible: true, text: ln.text, left: c.rect.x + 2, top: ln.y !== undefined ? ln.y : c.rect.y, width: c.rect.width - 4, height: 13, font: font };
          }), c.visible !== false, font);
        subs.push(cv);
      });
    }
    if (layout && layout.classifierStyle) {
      // StarUML class-style views carry hidden reception & template compartments
      subs.push(hiddenCompartment(v._id + ':rc', v._id, 'UMLReceptionCompartmentView', font));
      subs.push(hiddenCompartment(v._id + ':tp', v._id, 'UMLTemplateParameterCompartmentView', font));
    }
    return subs;
  }

  function hiddenCompartment(id, viewId, type, font) {
    return {
      _type: type, _id: id, _parent: { $ref: viewId }, model: { $ref: viewId },
      subViews: [], visible: false, font: font || OS.text.DEFAULT_FONT, left: 0, top: 0, width: 10, height: 10
    };
  }

  function writeLifelineSubViews(v) {
    var subs = [];
    var font = v.font || OS.text.DEFAULT_FONT;
    var m = v.model || {};
    var stereo = model.stereotypeText(m);
    var nc = compartmentView(v._id + ':nc', v._id, 'UMLNameCompartmentView',
      { x: v.left || 0, y: v.top || 0, width: v.width || 0, height: 25 }, [
        { visible: !!stereo, text: stereo ? '«' + stereo + '»' : '', left: v.left || 0, top: v.top || 0, width: v.width || 0, height: 13, font: font },
        { visible: true, text: m.name || '', left: v.left || 0, top: (v.top || 0) + (stereo ? 13 : 0), width: v.width || 0, height: 13, font: font },
        { visible: false, left: 0, top: 0, width: 0, height: 13, font: font },
        { visible: false, left: 0, top: 0, width: 0, height: 13, horizontalAlignment: 1, font: font }
      ], true, font);
    subs.push(nc);
    var lineH = Math.max(200, (v._lineHeight || 400));
    subs.push({
      _type: 'UMLLinePartView', _id: v._id + ':lp', _parent: { $ref: v._id }, model: { $ref: v._id },
      font: font, left: Math.round((v.left || 0) + (v.width || 0) / 2), top: Math.round((v.top || 0) + (v.height || 0)),
      width: 1, height: Math.round(lineH)
    });
    return subs;
  }

  function writeEdgeSubViews(v) {
    var subs = [];
    var font = v.font || OS.text.DEFAULT_FONT;
    var m = v.model || {};
    var stereo = model.stereotypeText(m);
    var nameLbl = edgeLabelView(v._id + ':L0', v._id, { visible: !!(m.name), alpha: 1.5707963267948966, distance: 15, font: font });
    var stereoLbl = edgeLabelView(v._id + ':L1', v._id, { visible: !!stereo, alpha: 1.5707963267948966, distance: 30, font: font });
    var propLbl = edgeLabelView(v._id + ':L2', v._id, { visible: false, alpha: -1.5707963267948966, distance: 15, font: font });
    subs.push(nameLbl, stereoLbl, propLbl);
    v._labelRefs = { name: nameLbl._id, stereotype: stereoLbl._id, property: propLbl._id };
    if (v._type === 'UMLAssociationView') {
      // StarUML packs association role labels head-side first:
      // L3=headRoleName, L4=headProperty, L5=headMultiplicity,
      // L6=tailRoleName, L7=tailProperty, L8=tailMultiplicity.
      // (views.drawAssociation places ownedEnds[0] text at the head end.)
      var headRole = edgeLabelView(v._id + ':L3', v._id, { visible: false, alpha: 2.6179938779914944, distance: 30, font: font });
      var headProp = edgeLabelView(v._id + ':L4', v._id, { visible: false, alpha: 2.6179938779914944, distance: 45, font: font });
      var headMult = edgeLabelView(v._id + ':L5', v._id, { visible: false, alpha: -2.617993877991494, distance: 30, font: font });
      var tailRole = edgeLabelView(v._id + ':L6', v._id, { visible: false, alpha: 0.5235987755982988, distance: 30, font: font });
      var tailProp = edgeLabelView(v._id + ':L7', v._id, { visible: false, alpha: 0.5235987755982988, distance: 45, font: font });
      var tailMult = edgeLabelView(v._id + ':L8', v._id, { visible: false, alpha: -0.5235987755982988, distance: 30, font: font });
      subs.push(headRole, headProp, headMult, tailRole, tailProp, tailMult);
      v._labelRefs.headRoleName = headRole._id;
      v._labelRefs.headProperty = headProp._id;
      v._labelRefs.headMultiplicity = headMult._id;
      v._labelRefs.tailRoleName = tailRole._id;
      v._labelRefs.tailProperty = tailProp._id;
      v._labelRefs.tailMultiplicity = tailMult._id;
    }
    return subs;
  }

  function serializeObject(project, fileMode) {
    // NOTE: serialization must not permanently mutate the live model.
    // writeEdgeSubViews() assigns v._labelRefs as a side effect; remember the
    // pre-serialization values and restore them afterwards so undo snapshots
    // and repeated saves stay deterministic.
    var savedLabelRefs = [];
    if (fileMode) {
      project.eachDiagram(function (d) {
        (d.ownedViews || []).forEach(function (v) {
          savedLabelRefs.push([v, '_labelRefs' in v ? v._labelRefs : undefined]);
        });
      });
    }
    try {
      return writeElement(project.root, fileMode);
    } finally {
      savedLabelRefs.forEach(function (pair) {
        if (pair[1] === undefined) delete pair[0]._labelRefs;
        else pair[0]._labelRefs = pair[1];
      });
    }
  }

  function serialize(project) {
    return JSON.stringify(serializeObject(project, true));
  }

  function stateJSON(project) {
    return JSON.stringify(serializeObject(project, false));
  }

  /* patch writeView for node compartment refs */
  var _writeViewOrig = writeView;

  function finishNodeViewRefs(rawView, v) {
    if (!rawView.subViews || !rawView.subViews.length) return rawView;
    var nameComp = rawView.subViews.filter(function (s) { return s._type === 'UMLNameCompartmentView'; })[0];
    if (nameComp) {
      rawView.nameCompartment = { $ref: nameComp._id };
      if (nameComp.subViews && nameComp.subViews.length >= 4) {
        rawView.stereotypeLabel = { $ref: nameComp.subViews[0]._id };
        rawView.nameLabel = { $ref: nameComp.subViews[1]._id };
        rawView.namespaceLabel = { $ref: nameComp.subViews[2]._id };
        rawView.propertyLabel = { $ref: nameComp.subViews[3]._id };
      }
    }
    var attrComp = rawView.subViews.filter(function (s) { return s._type === 'UMLAttributeCompartmentView'; })[0];
    var opComp = rawView.subViews.filter(function (s) { return s._type === 'UMLOperationCompartmentView'; })[0];
    var recComp = rawView.subViews.filter(function (s) { return s._type === 'UMLReceptionCompartmentView'; })[0];
    var tpComp = rawView.subViews.filter(function (s) { return s._type === 'UMLTemplateParameterCompartmentView'; })[0];
    if (attrComp) rawView.attributeCompartment = { $ref: attrComp._id };
    if (opComp) rawView.operationCompartment = { $ref: opComp._id };
    if (recComp) rawView.receptionCompartment = { $ref: recComp._id };
    if (tpComp) rawView.templateParameterCompartment = { $ref: tpComp._id };
    return rawView;
  }

  function finishEdgeRefs(rawView, v) {
    if (!v._labelRefs) return rawView;
    var r = v._labelRefs;
    if (r.name) rawView.nameLabel = { $ref: r.name };
    if (r.stereotype) rawView.stereotypeLabel = { $ref: r.stereotype };
    if (r.property) rawView.propertyLabel = { $ref: r.property };
    if (r.tailRoleName) rawView.tailRoleNameLabel = { $ref: r.tailRoleName };
    if (r.tailProperty) rawView.tailPropertyLabel = { $ref: r.tailProperty };
    if (r.tailMultiplicity) rawView.tailMultiplicityLabel = { $ref: r.tailMultiplicity };
    if (r.headRoleName) rawView.headRoleNameLabel = { $ref: r.headRoleName };
    if (r.headProperty) rawView.headPropertyLabel = { $ref: r.headProperty };
    if (r.headMultiplicity) rawView.headMultiplicityLabel = { $ref: r.headMultiplicity };
    return rawView;
  }

  /* wrap writeView to add refs */
  writeView = function (v, fileMode) {
    var raw = _writeViewOrig(v, fileMode);
    if (fileMode) {
      var isEdge = meta.isEdgeView(v._type) || v._type === 'UMLSeqMessageView';
      if (isEdge) finishEdgeRefs(raw, v);
      else finishNodeViewRefs(raw, v);
      if (v._type === 'UMLSeqLifelineView' && raw.subViews) {
        var lp = raw.subViews.filter(function (s) { return s._type === 'UMLLinePartView'; })[0];
        if (lp) raw.linePart = { $ref: lp._id };
      }
    }
    return raw;
  };

  /* ============================ reader ============================ */

  function isViewInternalType(t) {
    return t === 'LabelView' || t === 'EdgeLabelView' || /CompartmentView$/.test(t) ||
      t === 'UMLLinePartView' || t === 'UMLActivationView' || t === 'UMLInteractionOperandView';
  }

  function parsePoints(str) {
    if (Array.isArray(str)) {
      return str.map(function (p) {
        if (Array.isArray(p)) return { x: p[0], y: p[1] };
        return { x: p.x || 0, y: p.y || 0 };
      });
    }
    if (typeof str !== 'string' || !str.length) return [];
    return str.split(';').map(function (pair) {
      var xy = pair.split(':').map(parseFloat);
      return { x: xy[0] || 0, y: xy[1] || 0 };
    }).filter(function (p) { return !isNaN(p.x) && !isNaN(p.y); });
  }

  function load(project, text, opts) {
    var raw = typeof text === 'string' ? JSON.parse(stripBom(text)) : text;
    var index = new Map();
    var pendings = [];
    var viewsBuilt = [];

    function indexRaw(node) {
      if (!node || typeof node !== 'object') return;
      if (node._id) index.set(node._id, node);
      for (var k in node) {
        var v = node[k];
        if (Array.isArray(v)) v.forEach(indexRaw);
        else if (v && typeof v === 'object') indexRaw(v);
      }
    }
    indexRaw(raw);

    function refPending(container, key, refObj) {
      if (!refObj) return;
      if (typeof refObj === 'object' && refObj.$ref) {
        container[key] = null; // reserve key position for deterministic re-serialization
        pendings.push(function () {
          var target = index.get(refObj.$ref);
          if (target && target.__runtime) container[key] = target.__runtime;
          else container[key] = null;
        });
      } else {
        container[key] = refObj;
      }
    }

    function buildElement(node, parentRuntime) {
      var type = node._type || 'UnknownElement';
      var isDiag = meta.isDiagram(type) || /^UML.*Diagram$/.test(type);
      var el = { _type: type, _id: node._id || util.genId(), _parent: parentRuntime || null, ext: {} };
      node.__runtime = el;
      var known = knownKeys(type);
      var desc = meta.TYPES[type];
      var childLists = (desc && desc.childLists) || ['ownedElements'];
      if (meta.isDiagram(type) || node.ownedViews) childLists = childLists.concat(['ownedElements']);
      if (type === 'Project' || type === 'UMLModel' || type === 'UMLPackage' || type === 'UMLSubsystem' ||
          type === 'UMLStateMachine' || type === 'UMLActivity' || type === 'UMLCombinedFragment' ||
          type === 'UMLState' || type === 'UMLCompositeState' || type === 'UMLRegion' ||
          type === 'UMLClass' || type === 'UMLInterface' || type === 'UMLComponent' ||
          type === 'UMLNode' || type === 'UMLArtifact' || type === 'UMLEnumeration' ||
          type === 'UMLOperation' || type === 'UMLAssociation' || type === 'UMLActor' ||
          type === 'UMLUseCase' || type === 'UMLDataType' || type === 'UMLAction' ||
          type === 'UMLObjectNode' || type === 'UMLInstance' || type === 'UnknownElement') {
        // child lists handled generically below via knownKeys + defaults
      }
      var allChildLists = new Set(['ownedElements', 'ownedAttributes', 'ownedOperations',
        'ownedLiterals', 'ownedEnds', 'parameters', 'ownedViews']);

      for (var k in node) {
        if (!Object.prototype.hasOwnProperty.call(node, k)) continue;
        if (k === '_type' || k === '_id' || k === '_parent' || k === '__runtime') continue;
        var v = node[k];
        if (k === 'tags') { el.tags = util.clone(v); continue; }
        if (allChildLists.has(k) && Array.isArray(v)) {
          if (k === 'ownedViews') {
            if (!isDiag) { el.ext[k] = util.clone(v); continue; }
            el.ownedViews = v.filter(function (vn) { return vn && vn._type && !isViewInternalType(vn._type); })
              .map(function (vn) { return buildView(vn, el); });
            continue;
          }
          el[k] = v.filter(function (c) { return c && c._type; }).map(function (c) { return buildElement(c, el); });
          continue;
        }
        if (v && typeof v === 'object' && v.$ref !== undefined) {
          refPending(el, k, v);
          continue;
        }
        if (v && typeof v === 'object') {
          el.ext[k] = util.clone(v);
          continue;
        }
        if (!known.has(k) && k !== 'tags') {
          el.ext[k] = v;
          continue;
        }
        el[k] = v;
      }
      // defaults for missing essential fields
      if (desc && desc.defaults) {
        var def = desc.defaults();
        for (var dk in def) {
          if (el[dk] === undefined) el[dk] = def[dk];
        }
      }
      if (!el.name && el.name !== '' && def_hasName(type)) el.name = '';
      if (isDiag) {
        el._type = meta.normalizeDiagramType(type);
        if (!el.ownedViews) el.ownedViews = [];
        if (!el.ownedElements) el.ownedElements = [];
      }
      project._register(el);
      return el;
    }

    function def_hasName(type) {
      var d = meta.TYPES[type];
      return d && d.props && d.props.some(function (p) { return p.key === 'name'; });
    }

    function buildView(node, diagram) {
      var type = node._type;
      var v = {
        _type: type, _id: node._id || util.genId(), _parent: diagram,
        model: null, ext: {}, visible: node.visible !== false
      };
      node.__runtime = v;
      refPending(v, 'model', node.model);
      if (node.head) refPending(v, 'head', node.head);
      if (node.tail) refPending(v, 'tail', node.tail);
      if (node.containerView) refPending(v, 'containerView', node.containerView);
      v.font = node.font || OS.text.DEFAULT_FONT;
      if (node.fillColor) v.fillColor = node.fillColor;
      if (node.lineColor) v.lineColor = node.lineColor;
      if (node.text !== undefined) v.text = node.text;

      var isEdge = meta.isEdgeView(type) || type === 'UMLSeqMessageView';
      if (isEdge) {
        v.points = parsePoints(node.points);
        v.lineStyle = node.lineStyle === 2 ? 'ortho' : 'straight';
        v.showVisibility = node.showVisibility !== false;
      } else {
        v.left = num(node.left); v.top = num(node.top);
        v.width = num(node.width); v.height = num(node.height);
        v.wordWrap = !!node.wordWrap;
        v.showVisibility = node.showVisibility !== false;
        v.showNamespace = !!node.showNamespace;
        v.showProperty = node.showProperty !== false;
        v.showType = node.showType !== false;
        v.showMultiplicity = node.showMultiplicity !== false;
        v.suppressAttributes = !!node.suppressAttributes;
        v.suppressOperations = !!node.suppressOperations;
        v.suppressLiterals = !!node.suppressLiterals;
        v.containerView = null;
        // derive suppress flags from hidden compartments
        (node.subViews || []).forEach(function (sv) {
          if (sv._type === 'UMLAttributeCompartmentView' && sv.visible === false) v.suppressAttributes = true;
          if (sv._type === 'UMLOperationCompartmentView' && sv.visible === false) v.suppressOperations = true;
          if (sv._type === 'UMLEnumerationLiteralCompartmentView' && sv.visible === false) v.suppressLiterals = true;
          if (sv._type === 'UMLLinePartView' && typeof sv.height === 'number') v._lineHeight = sv.height;
        });
      }
      // preserve unknown view fields for round-trip fidelity
      var KNOWN_VIEW_KEYS = {
        '_type': 1, '_id': 1, '_parent': 1, '__runtime': 1, 'model': 1, 'font': 1, 'visible': 1,
        'fillColor': 1, 'lineColor': 1, 'text': 1, 'head': 1, 'tail': 1, 'points': 1, 'lineStyle': 1,
        'showVisibility': 1, 'left': 1, 'top': 1, 'width': 1, 'height': 1, 'wordWrap': 1,
        'showNamespace': 1, 'showProperty': 1, 'showType': 1, 'showMultiplicity': 1,
        'suppressAttributes': 1, 'suppressOperations': 1, 'suppressLiterals': 1,
        'subViews': 1, 'containerView': 1, 'containerChangeable': 1, 'containerExtending': 1,
        'nameCompartment': 1, 'attributeCompartment': 1, 'operationCompartment': 1,
        'receptionCompartment': 1, 'templateParameterCompartment': 1, 'linePart': 1,
        'nameLabel': 1, 'stereotypeLabel': 1, 'namespaceLabel': 1, 'propertyLabel': 1,
        'tailRoleNameLabel': 1, 'tailPropertyLabel': 1, 'tailMultiplicityLabel': 1,
        'headRoleNameLabel': 1, 'headPropertyLabel': 1, 'headMultiplicityLabel': 1,
        'showOperationKind': 1, 'showStereoType': 1
      };
      for (var vk in node) {
        if (!Object.prototype.hasOwnProperty.call(node, vk)) continue;
        if (!KNOWN_VIEW_KEYS[vk]) v.ext[vk] = util.clone(node[vk]);
      }
      viewsBuilt.push(v);
      project._register(v);
      return v;
    }

    function num(x) { return typeof x === 'number' && isFinite(x) ? x : 0; }
    function stripBom(s) { return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s; }

    // Transactional load: capture the current state first so that if any
    // stage below throws, we can restore the previous project instead of
    // leaving it half-replaced (byId cleared, root swapped, refs dangling).
    var snapshotForRollback = null;
    try {
      snapshotForRollback = project.root ? JSON.stringify(serializeObject(project, false)) : null;
    } catch (eSave) { snapshotForRollback = null; }

    function doLoad() {
    project.byId.clear();
    var root = buildElement(raw, null);
    root._parent = null;
    project.root = root;
    pendings.forEach(function (fn) { fn(); });

    // note text fallback: view.text → model.documentation
    viewsBuilt.forEach(function (v) {
      if (v._type === 'UMLNoteView' && v.model) {
        if (!v.model.documentation && v.text) v.model.documentation = v.text;
      }
      // transition trigger objects → string
    });
    project.eachElement(function (el) {
      if (el._type === 'UMLTransition') {
        ['trigger', 'guard', 'effect'].forEach(function (k) {
          if (el[k] && typeof el[k] === 'object') el[k] = el[k].name || '';
        });
      }
    });

    // compute containment for node views (StarUML derives from bounds+z-order)
    project.eachDiagram(function (d) {
      if (OS.views && OS.views.assignContainers) OS.views.assignContainers(d);
    });

    project.filePath = null;
    project.fileName = null;
    project.setDirty(false);
    if (!opts || !opts.keepHistory) project.clearHistory();
    } // function doLoad

    try {
      doLoad();
    } catch (e) {
      // Roll back: the failed load may have partially replaced the project
      // (byId cleared / root swapped). Rebuild the previous state from the
      // snapshot captured before we started, keeping undo history intact.
      if (snapshotForRollback !== null) {
        try { load(project, JSON.parse(snapshotForRollback), { keepHistory: true }); }
        catch (e2) { console.error('rollback failed', e2); }
      }
      throw e;
    }
  }

  function loadState(project, text) {
    var oldPath = project.filePath, oldName = project.fileName;
    load(project, text, { keepHistory: true });
    project.filePath = oldPath;
    project.fileName = oldName;
    project.setDirty(true);
  }

  OS.Mdj = {
    serialize: serialize,
    stateJSON: stateJSON,
    load: load,
    loadState: loadState,
    parsePoints: parsePoints
  };
})(typeof window !== 'undefined' ? window : globalThis);
