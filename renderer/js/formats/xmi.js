/*
 * OpenStar UML — XMI 2.1 export/import (pragmatic UML 2 profile).
 *
 * Export produces schema-shaped XMI (xmi:XMI / uml:Model / packagedElement /
 * ownedAttribute / ownedOperation / generalization / ownedEnd ...).
 * Import is tolerant: reads any well-formed XMI with xmi:type annotations
 * (UML 2.x), including files from other tools.
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};
  var util = OS.util, meta = OS.meta, model = OS.model, xml = OS.xml;

  var UML_TYPE_MAP = {
    'UMLModel': 'uml:Model',
    'UMLPackage': 'uml:Package',
    'UMLSubsystem': 'uml:Package',
    'UMLClass': 'uml:Class',
    'UMLInterface': 'uml:Interface',
    'UMLEnumeration': 'uml:Enumeration',
    'UMLDataType': 'uml:DataType',
    'UMLActor': 'uml:Actor',
    'UMLUseCase': 'uml:UseCase',
    'UMLComponent': 'uml:Component',
    'UMLNode': 'uml:Node',
    'UMLArtifact': 'uml:Artifact',
    'UMLInstance': 'uml:InstanceSpecification',
    'UMLStateMachine': 'uml:StateMachine',
    'UMLActivity': 'uml:Activity',
    'UMLAssociation': 'uml:Association',
    'UMLNote': 'uml:Comment',
    'UMLInteraction': 'uml:Interaction'
  };

  var FEATURE_HOSTS = {
    'UMLClass': true, 'UMLInterface': true, 'UMLEnumeration': true, 'UMLDataType': true,
    'UMLActor': true, 'UMLUseCase': true, 'UMLComponent': true, 'UMLNode': true,
    'UMLArtifact': true, 'UMLSubsystem': true
  };

  var REL_NESTED = {
    'UMLGeneralization': { tag: 'generalization', type: 'uml:Generalization', targetAttr: 'general' },
    'UMLRealization': { tag: 'realization', type: 'uml:Realization', targetAttr: 'supplier' },
    'UMLInterfaceRealization': { tag: 'interfaceRealization', type: 'uml:InterfaceRealization', targetAttr: 'supplier' },
    'UMLDependency': { tag: 'dependency', type: 'uml:Dependency', targetAttr: 'supplier' },
    'UMLInclude': { tag: 'include', type: 'uml:Include', targetAttr: 'addition' },
    'UMLExtend': { tag: 'extend', type: 'uml:Extend', targetAttr: 'extendedCase' },
    'UMLConnector': { tag: 'connector', type: 'uml:Connector', targetAttr: 'supplier' },
    'UMLCommunicationPath': { tag: 'communicationPath', type: 'uml:CommunicationPath', targetAttr: 'supplier' }
  };

  /* ============================ export ============================ */

  function Exporter() {
    this.idMap = new Map();
    this.counter = 0;
    this.pendingNestedRels = new Map(); // sourceEl -> [relEls]
  }
  Exporter.prototype.xid = function (el) {
    if (!el || !el._id) return null;
    if (!this.idMap.has(el._id)) this.idMap.set(el._id, '_OS' + (++this.counter));
    return this.idMap.get(el._id);
  };

  function splitMultiplicity(m) {
    if (!m) return null;
    var parts = String(m).split('..');
    if (parts.length === 1) return { lower: parts[0], upper: parts[0] };
    return { lower: parts[0], upper: parts[1] };
  }

  Exporter.prototype.multiplicityNodes = function (mult, baseId) {
    var mm = splitMultiplicity(mult);
    if (!mm) return [];
    var out = [];
    if (mm.lower !== '' && mm.lower !== undefined && mm.lower !== '1') {
      out.push(xml.el('lowerValue', { 'xmi:type': 'uml:LiteralInteger', 'xmi:id': baseId + '_lv', value: mm.lower }));
    }
    if (mm.upper !== '' && mm.upper !== undefined && mm.upper !== '1') {
      out.push(xml.el('upperValue', {
        'xmi:type': mm.upper === '*' ? 'uml:LiteralUnlimitedNatural' : 'uml:LiteralInteger',
        'xmi:id': baseId + '_uv', value: mm.upper
      }));
    }
    return out;
  };

  Exporter.prototype.typeNodes = function (t, baseId) {
    if (!t) return [];
    if (typeof t === 'string') {
      if (!t) return [];
      return [xml.el('type', { 'xmi:type': 'uml:PrimitiveType', 'xmi:id': baseId + '_t', name: t })];
    }
    return []; // element refs are emitted as type attribute
  };

  Exporter.prototype.typeAttr = function (t) {
    if (t && typeof t === 'object' && t._id) return this.xid(t);
    return null;
  };

  Exporter.prototype.exportAttr = function (a) {
    var id = this.xid(a) || ('_a' + (++this.counter));
    if (!this.idMap.has(a._id)) this.idMap.set(a._id, id);
    var attrs = { 'xmi:type': 'uml:Property', 'xmi:id': id, name: a.name || '' };
    if (a.visibility) attrs.visibility = a.visibility;
    if (a.isStatic) attrs.isStatic = 'true';
    if (a.isReadOnly) attrs.isReadOnly = 'true';
    if (a.isID) attrs['isID'] = 'true';
    if (a.defaultValue) attrs.defaultValue = a.defaultValue;
    var ta = this.typeAttr(a.type);
    if (ta) attrs.type = ta;
    var kids = this.typeNodes(a.type, id).concat(this.multiplicityNodes(a.multiplicity, id));
    return xml.el('ownedAttribute', attrs, kids);
  };

  Exporter.prototype.exportParam = function (p) {
    var id = this.xid(p);
    var attrs = { 'xmi:type': 'uml:Parameter', 'xmi:id': id, name: p.name || '' };
    if (p.direction && p.direction !== 'in') attrs.direction = p.direction;
    var ta = this.typeAttr(p.type);
    if (ta) attrs.type = ta;
    if (p.defaultValue) attrs.defaultValue = p.defaultValue;
    var kids = this.typeNodes(p.type, id).concat(this.multiplicityNodes(p.multiplicity, id));
    return xml.el('ownedParameter', attrs, kids);
  };

  Exporter.prototype.exportOperation = function (o) {
    var id = this.xid(o);
    var attrs = { 'xmi:type': 'uml:Operation', 'xmi:id': id, name: o.name || '' };
    if (o.visibility) attrs.visibility = o.visibility;
    if (o.isStatic) attrs.isStatic = 'true';
    if (o.isAbstract) attrs.isAbstract = 'true';
    if (o.isQuery) attrs.isQuery = 'true';
    var kids = (o.parameters || []).map(this.exportParam, this);
    return xml.el('ownedOperation', attrs, kids);
  };

  Exporter.prototype.exportLiteral = function (l) {
    return xml.el('ownedLiteral', { 'xmi:type': 'uml:EnumerationLiteral', 'xmi:id': this.xid(l), name: l.name || '' });
  };

  Exporter.prototype.exportAssociation = function (assoc) {
    var id = this.xid(assoc);
    var attrs = { 'xmi:type': 'uml:Association', 'xmi:id': id };
    if (assoc.name) attrs.name = assoc.name;
    if (assoc.visibility && assoc.visibility !== 'public') attrs.visibility = assoc.visibility;
    var kids = (assoc.ownedEnds || []).map(function (end) {
      var eid = this.xid(end);
      var ea = { 'xmi:type': 'uml:Property', 'xmi:id': eid };
      if (end.name) ea.name = end.name;
      if (end.visibility && end.visibility !== 'public') ea.visibility = end.visibility;
      if (end.reference) ea.type = this.xid(end.reference);
      if (end.aggregation && end.aggregation !== 'none') ea.aggregation = end.aggregation;
      if (end.navigable === false) ea.isNavigable = 'false';
      if (end.isReadOnly) ea.isReadOnly = 'true';
      var ekids = this.multiplicityNodes(end.multiplicity, eid);
      return xml.el('ownedEnd', ea, ekids);
    }, this);
    return xml.el('packagedElement', attrs, kids);
  };

  Exporter.prototype.exportStateMachine = function (sm) {
    var id = this.xid(sm);
    var kids = [];
    var states = (sm.ownedElements || []).filter(function (e) {
      return e._type === 'UMLState' || e._type === 'UMLCompositeState' || e._type === 'UMLPseudostate' || e._type === 'UMLFinalState';
    });
    var regions = (sm.ownedElements || []).filter(function (e) { return e._type === 'UMLRegion'; });
    regions.forEach(function (r) {
      states = states.concat((r.ownedElements || []).filter(function (e) {
        return e._type === 'UMLState' || e._type === 'UMLCompositeState' || e._type === 'UMLPseudostate' || e._type === 'UMLFinalState';
      }));
    });
    states.forEach(function (s) { kids.push(this.exportStateVertex(s)); }, this);
    var transitions = [];
    (function collect(el) {
      (el.ownedElements || []).forEach(function (c) {
        if (c._type === 'UMLTransition') transitions.push(c);
        else collect(c);
      });
    })(sm);
    transitions.forEach(function (t) {
      var tid = this.xid(t);
      var attrs = { 'xmi:type': 'uml:Transition', 'xmi:id': tid };
      if (t.name) attrs.name = t.name;
      if (t.source) attrs.source = this.xid(t.source);
      if (t.target) attrs.target = this.xid(t.target);
      var kids2 = [];
      if (t.trigger) kids2.push(xml.el('trigger', { 'xmi:type': 'uml:TriggerEvent', 'xmi:id': tid + '_tr', name: t.trigger }));
      if (t.guard) kids2.push(xml.el('guard', { 'xmi:type': 'uml:Constraint', 'xmi:id': tid + '_g' }, [String(t.guard)]));
      if (t.effect) kids2.push(xml.el('effect', { 'xmi:type': 'uml:Activity', 'xmi:id': tid + '_e', name: t.effect }));
      kids.push(xml.el('transition', attrs, kids2));
    }, this);
    var attrs = { 'xmi:type': 'uml:StateMachine', 'xmi:id': id, name: sm.name || '' };
    return xml.el('packagedElement', attrs, [xml.el('region', { 'xmi:type': 'uml:Region', 'xmi:id': id + '_r' }, kids)]);
  };

  Exporter.prototype.exportStateVertex = function (s) {
    var id = this.xid(s);
    var type = s._type === 'UMLPseudostate' ? 'uml:Pseudostate' : s._type === 'UMLFinalState' ? 'uml:FinalState' : 'uml:State';
    var attrs = { 'xmi:type': type, 'xmi:id': id };
    if (s.name) attrs.name = s.name;
    if (s._type === 'UMLPseudostate' && s.kind) attrs.kind = s.kind;
    var kids = [];
    if (s.entryActivity) kids.push(xml.el('entry', { 'xmi:type': 'uml:Activity', 'xmi:id': id + '_en', name: s.entryActivity }));
    if (s.doActivity) kids.push(xml.el('doActivity', { 'xmi:type': 'uml:Activity', 'xmi:id': id + '_do', name: s.doActivity }));
    if (s.exitActivity) kids.push(xml.el('exit', { 'xmi:type': 'uml:Activity', 'xmi:id': id + '_ex', name: s.exitActivity }));
    if (s._type === 'UMLState' || s._type === 'UMLCompositeState') {
      (s.ownedElements || []).forEach(function (c) {
        if (c._type === 'UMLState' || c._type === 'UMLCompositeState' || c._type === 'UMLPseudostate' || c._type === 'UMLFinalState') {
          kids.push(this.exportStateVertex(c));
        }
      }, this);
    }
    return xml.el('subvertex', attrs, kids);
  };

  Exporter.prototype.exportActivity = function (act) {
    var id = this.xid(act);
    var kids = [];
    var edges = [];
    (function collect(el) {
      (el.ownedElements || []).forEach(function (c) {
        if (c._type === 'UMLControlFlow' || c._type === 'UMLObjectFlow') edges.push(c);
        else if (/^UML(Action|ObjectNode|InitialNode|ActivityFinalNode|FlowFinalNode|DecisionNode|MergeNode|ForkNode|JoinNode)$/.test(c._type)) {
          var nid = this.xid(c);
          var nt = 'uml:' + c._type.replace('UML', '');
          var attrs = { 'xmi:type': nt, 'xmi:id': nid };
          if (c.name) attrs.name = c.name;
          kids.push(xml.el('node', attrs));
          collect.call(this, c);
        } else collect.call(this, c);
      }, this);
    }).call(this, act);
    edges.forEach(function (e) {
      var eid = this.xid(e);
      var attrs = { 'xmi:type': e._type === 'UMLObjectFlow' ? 'uml:ObjectFlow' : 'uml:ControlFlow', 'xmi:id': eid };
      if (e.name) attrs.name = e.name;
      if (e.guard) attrs.guard = e.guard;
      if (e.source) attrs.source = this.xid(e.source);
      if (e.target) attrs.target = this.xid(e.target);
      kids.push(xml.el('edge', attrs));
    }, this);
    return xml.el('packagedElement', { 'xmi:type': 'uml:Activity', 'xmi:id': id, name: act.name || '' }, kids);
  };

  Exporter.prototype.exportInteraction = function (diagram) {
    var id = this.xid(diagram);
    var kids = [];
    var lifelines = (diagram.ownedElements || []).filter(function (e) { return e._type === 'UMLLifeline'; });
    var messages = (diagram.ownedElements || []).filter(function (e) { return e._type === 'UMLMessage'; });
    lifelines.forEach(function (l) {
      kids.push(xml.el('lifeline', { 'xmi:type': 'uml:Lifeline', 'xmi:id': this.xid(l), name: l.name || '' }));
    }, this);
    messages.forEach(function (m) {
      var attrs = { 'xmi:type': 'uml:Message', 'xmi:id': this.xid(m) };
      if (m.name) attrs.name = m.name;
      if (m.messageSort) attrs.messageSort = m.messageSort;
      if (m.arguments) attrs.argument = m.arguments;
      if (m.source) attrs.sendEvent = this.xid(m.source);
      if (m.target) attrs.receiveEvent = this.xid(m.target);
      kids.push(xml.el('message', attrs));
    }, this);
    return xml.el('packagedElement', { 'xmi:type': 'uml:Interaction', 'xmi:id': id, name: diagram.name || '' }, kids);
  };

  Exporter.prototype.exportElement = function (el) {
    var t = el._type;
    if (meta.isDiagramLike(t)) return null; // diagrams exported separately (interactions)
    // relationships: nested into source when possible
    if (REL_NESTED[t]) return null; // handled by host pass
    if (t === 'UMLAssociation') return this.exportAssociation(el);
    if (t === 'UMLStateMachine') return this.exportStateMachine(el);
    if (t === 'UMLActivity') return this.exportActivity(el);
    if (t === 'UMLNote') {
      return xml.el('ownedComment', { 'xmi:type': 'uml:Comment', 'xmi:id': this.xid(el) }, [el.documentation || el.name || '']);
    }
    if (t === 'UMLRegion' || t === 'UMLTransition' || t === 'UMLState' || t === 'UMLCompositeState' ||
        t === 'UMLPseudostate' || t === 'UMLFinalState') return null; // nested by behavior exporter
    if (/^UML(Action|ObjectNode|InitialNode|ActivityFinalNode|FlowFinalNode|DecisionNode|MergeNode|ForkNode|JoinNode|ControlFlow|ObjectFlow)$/.test(t)) return null;
    if (t === 'UMLLifeline' || t === 'UMLMessage' || t === 'UMLCombinedFragment' || t === 'UMLInteractionOperand') return null;
    if (t === 'UMLAttribute' || t === 'UMLOperation' || t === 'UMLParameter' ||
        t === 'UMLEnumerationLiteral' || t === 'UMLAssociationEnd') return null;

    var umlType = UML_TYPE_MAP[t];
    if (!umlType) {
      // unknown/unsupported → generic package to preserve name
      umlType = 'uml:Package';
    }
    var attrs = { 'xmi:type': umlType, 'xmi:id': this.xid(el) };
    if (el.name) attrs.name = el.name;
    if (el.visibility && el.visibility !== 'public') attrs.visibility = el.visibility;
    if (el.isAbstract) attrs.isAbstract = 'true';
    if (el.isFinalSpecialization) attrs.isFinalSpecialization = 'true';
    if (el.documentation) attrs.documentation = el.documentation;
    var stereo = model.stereotypeText(el);
    if (stereo) attrs.stereotype = stereo;

    var kids = [];
    (el.ownedAttributes || []).forEach(function (a) { kids.push(this.exportAttr(a)); }, this);
    (el.ownedOperations || []).forEach(function (o) { kids.push(this.exportOperation(o)); }, this);
    (el.ownedLiterals || []).forEach(function (l) { kids.push(this.exportLiteral(l)); }, this);

    // relationships among children: nest when this element is the source,
    // otherwise emit as sibling packagedElement with explicit end attributes
    (el.ownedElements || []).forEach(function (c) {
      if (REL_NESTED[c._type]) {
        kids.push(this.exportRelNode(c, el));
        return;
      }
      var sub = this.exportElement(c);
      if (sub) kids.push(sub);
    }, this);

    var tag = (t === 'UMLModel' && el._parent && !el._parent._parent) ? 'uml:Model' : 'packagedElement';
    return xml.el(tag, attrs, kids);
  };

  Exporter.prototype.exportRelNode = function (r, containerEl) {
    var spec = REL_NESTED[r._type];
    var id = this.xid(r);
    var stereo = model.stereotypeText(r);
    if (r.source === containerEl) {
      var rattrs = { 'xmi:type': spec.type, 'xmi:id': id };
      if (r.name) rattrs.name = r.name;
      if (stereo) rattrs.stereotype = stereo;
      if (r.target) rattrs[spec.targetAttr] = this.xid(r.target);
      return xml.el(spec.tag, rattrs);
    }
    var attrs = { 'xmi:type': spec.type, 'xmi:id': id };
    if (r.name) attrs.name = r.name;
    if (stereo) attrs.stereotype = stereo;
    var s = this.xid(r.source), tg = this.xid(r.target);
    switch (r._type) {
      case 'UMLGeneralization': attrs.specific = s; attrs.general = tg; break;
      case 'UMLInclude': attrs.includingCase = s; attrs.addition = tg; break;
      case 'UMLExtend': attrs.extension = s; attrs.extendedCase = tg; break;
      default: attrs.client = s; attrs.supplier = tg;
    }
    return xml.el('packagedElement', attrs);
  };

  function exportProject(project) {
    var ex = new Exporter();
    // pre-assign ids depth-first so references resolve
    (function pre(el) {
      ex.xid(el);
      model.descendants(el).forEach(function (d) { ex.xid(d); });
    })(project.root);

    var modelNodes = [];
    (project.root.ownedElements || []).forEach(function (m) {
      var node = ex.exportElement(m);
      if (node) modelNodes.push(node);
    });
    // sequence diagrams: export as interactions
    project.eachDiagram(function (d) {
      if (d._type === 'UMLSequenceDiagram') {
        var node = ex.exportInteraction(d);
        if (node) modelNodes.push(node);
      }
    });

    var root = xml.el('xmi:XMI', {
      'xmlns:uml': 'http://schema.omg.org/spec/UML/2.1',
      'xmlns:xmi': 'http://www.omg.org/spec/XMI/2.1',
      'xmi.version': '2.1'
    }, modelNodes);
    return xml.serialize(root);
  }

  /* ============================ import ============================ */

  function importInto(project, text) {
    var doc = xml.parse(text);
    var xmi = xml.findChild(doc, 'XMI') || doc;
    var idToEl = new Map();     // xmi:id -> runtime element
    var pending = [];           // {el, key, xid}
    var pendingTypeNames = [];  // {el, key, name} — unresolved type names

    function newXid(node) {
      var xid = node.attrs['xmi:id'] || node.attrs['id'] || node.attrs['xmi:idref'];
      return xid || util.genId();
    }

    function stripUml(t) { return (t || '').replace(/^uml:/, ''); }

    function refOrPend(container, key, xidVal) {
      if (!xidVal) return;
      pending.push({ container: container, key: key, xid: xidVal });
    }

    function typeFromChild(node) {
      var tn = xml.findChild(node, 'type');
      if (tn) {
        if (tn.attrs.name) return tn.attrs.name;
        if (tn.attrs['xmi:idref']) return { __xid: tn.attrs['xmi:idref'] };
      }
      return null;
    }

    function multiplicityFromChildren(node) {
      var lo = xml.findChild(node, 'lowerValue');
      var up = xml.findChild(node, 'upperValue');
      var lv = lo ? (lo.attrs.value !== undefined ? lo.attrs.value : (lo.text || '')) : '1';
      var uv = up ? (up.attrs.value !== undefined ? up.attrs.value : (up.text || '')) : '1';
      if (!lo && !up) return '';
      if (lv === uv) return lv;
      return lv + '..' + uv;
    }

    function createTyped(type, props) {
      var el = model.createElement(project, type, props || {});
      return el;
    }

    var CLASS_LIKE = {
      'Class': 'UMLClass', 'Interface': 'UMLInterface', 'Enumeration': 'UMLEnumeration',
      'DataType': 'UMLDataType', 'PrimitiveType': 'UMLDataType', 'Actor': 'UMLActor',
      'UseCase': 'UMLUseCase', 'Component': 'UMLComponent', 'Node': 'UMLNode',
      'Artifact': 'UMLArtifact', 'InstanceSpecification': 'UMLInstance',
      'Package': 'UMLPackage', 'Model': 'UMLModel', 'Subsystem': 'UMLSubsystem'
    };

    function buildElement(node, parentEl, owner) {
      var xt = stripUml(node.attrs['xmi:type']);
      var name = node.attrs.name || '';
      var xid = newXid(node);
      var el = null;

      if (CLASS_LIKE[xt]) {
        el = createTyped(CLASS_LIKE[xt], {
          name: name,
          visibility: node.attrs.visibility || 'public',
          isAbstract: node.attrs.isAbstract === 'true',
          documentation: node.attrs.documentation || ''
        });
        if (node.attrs.stereotype) el.stereotype = node.attrs.stereotype;
        idToEl.set(xid, el);
        // features & nested
        node.children.forEach(function (c) {
          if (c.name === '#text') return;
          var ct = stripUml(c.attrs['xmi:type']);
          var cn = xml.stripNs(c.name);
          if (cn === 'ownedAttribute' || (ct === 'Property' && cn !== 'ownedEnd')) {
            var attr = buildAttribute(c);
            model.addOwned(project, el, attr, 'ownedAttributes');
          } else if (cn === 'ownedOperation' || ct === 'Operation') {
            var op = buildOperation(c);
            model.addOwned(project, el, op, 'ownedOperations');
          } else if (cn === 'ownedLiteral' || ct === 'EnumerationLiteral') {
            var lit = createTyped('UMLEnumerationLiteral', { name: c.attrs.name || '' });
            idToEl.set(newXid(c), lit);
            model.addOwned(project, el, lit, 'ownedLiterals');
          } else if (REL_NESTED_BY_TAG[cn]) {
            buildNestedRel(c, cn, el, owner);
          } else if (cn === 'generalization' || ct === 'Generalization') {
            buildNestedRel(c, 'generalization', el, owner);
          } else if (cn === 'ownedComment' || ct === 'Comment') {
            var note = createTyped('UMLNote', { name: 'Note', documentation: (xml.findChild(c, 'body') ? xml.findChild(c, 'body').text : c.text) || c.attrs.body || '' });
            idToEl.set(newXid(c), note);
            model.addOwned(project, owner || el, note);
          } else if (c.attrs['xmi:type'] || CLASS_LIKE[ct]) {
            var sub = buildElement(c, el, el);
            if (sub) model.addOwned(project, el, sub);
          }
        });
        return el;
      }

      if (REL_BY_XT[xt]) {
        el = createTyped(REL_BY_XT[xt], { name: name, stereotype: node.attrs.stereotype || '' });
        idToEl.set(xid, el);
        var srcXid = node.attrs.client || node.attrs.specific || node.attrs.extension ||
          node.attrs.includingCase || node.attrs.source;
        var tgtXid = node.attrs.supplier || node.attrs.general || node.attrs.addition ||
          node.attrs.extendedCase || node.attrs.target;
        if (srcXid) refOrPend(el, 'source', srcXid);
        if (tgtXid) refOrPend(el, 'target', tgtXid);
        return el;
      }

      if (xt === 'Association') {
        el = createTyped('UMLAssociation', { name: name, visibility: node.attrs.visibility || 'public' });
        idToEl.set(xid, el);
        el.ownedEnds = [];
        var memberEnds = (node.attrs.memberEnd || '').split(/\s+/).filter(Boolean);
        node.children.forEach(function (c) {
          var cn = xml.stripNs(c.name);
          if (cn === 'ownedEnd' || cn === 'memberEnd' || stripUml(c.attrs['xmi:type']) === 'Property') {
            var end = createTyped('UMLAssociationEnd', {
              name: c.attrs.name || '',
              visibility: c.attrs.visibility || 'public',
              aggregation: c.attrs.aggregation || 'none',
              navigable: c.attrs.isNavigable !== 'false',
              multiplicity: multiplicityFromChildren(c)
            });
            idToEl.set(newXid(c), end);
            if (c.attrs.type) refOrPend(end, 'reference', c.attrs.type);
            el.ownedEnds.push(end);
            end._parent = el;
            project._register(end);
          }
        });
        if (el.ownedEnds.length === 0 && memberEnds.length === 2) {
          memberEnds.forEach(function (mx) {
            var end = createTyped('UMLAssociationEnd', {});
            el.ownedEnds.push(end);
            end._parent = el;
            project._register(end);
            pending.push({ container: '__end', key: end, xid: mx });
          });
        }
        return el;
      }

      if (xt === 'StateMachine') {
        el = createTyped('UMLStateMachine', { name: name });
        idToEl.set(xid, el);
        var region = xml.findChild(node, 'region') || node;
        buildStateChildren(region, el);
        return el;
      }

      if (xt === 'Activity') {
        el = createTyped('UMLActivity', { name: name });
        idToEl.set(xid, el);
        node.children.forEach(function (c) {
          var cn = xml.stripNs(c.name);
          var ct = stripUml(c.attrs['xmi:type']);
          if (cn === 'node') {
            var nodeEl = buildActivityNode(c, el);
            if (nodeEl) model.addOwned(project, el, nodeEl);
          } else if (cn === 'edge') {
            var et = ct === 'ObjectFlow' ? 'UMLObjectFlow' : 'UMLControlFlow';
            var e = createTyped(et, { name: c.attrs.name || '', guard: c.attrs.guard || '' });
            idToEl.set(newXid(c), e);
            if (c.attrs.source) refOrPend(e, 'source', c.attrs.source);
            if (c.attrs.target) refOrPend(e, 'target', c.attrs.target);
            model.addOwned(project, el, e);
          }
        });
        return el;
      }

      if (xt === 'Interaction') {
        // create a sequence diagram under owner
        var diag = model.createElement(project, 'UMLSequenceDiagram', { name: name || 'SequenceDiagram' });
        idToEl.set(xid, diag);
        diag.ownedElements = [];
        diag.ownedViews = [];
        node.children.forEach(function (c) {
          var cn = xml.stripNs(c.name);
          var ct = stripUml(c.attrs['xmi:type']);
          if (cn === 'lifeline' || ct === 'Lifeline') {
            var l = createTyped('UMLLifeline', { name: c.attrs.name || '' });
            idToEl.set(newXid(c), l);
            model.addOwned(project, diag, l);
          } else if (cn === 'message' || ct === 'Message') {
            var msg = createTyped('UMLMessage', {
              name: c.attrs.name || '',
              messageSort: c.attrs.messageSort || 'synchCall',
              arguments: c.attrs.argument || c.attrs.arguments || ''
            });
            idToEl.set(newXid(c), msg);
            if (c.attrs.sendEvent) refOrPend(msg, 'source', c.attrs.sendEvent);
            if (c.attrs.receiveEvent) refOrPend(msg, 'target', c.attrs.receiveEvent);
            if (c.attrs.source) refOrPend(msg, 'source', c.attrs.source);
            if (c.attrs.target) refOrPend(msg, 'target', c.attrs.target);
            model.addOwned(project, diag, msg);
          }
        });
        return diag;
      }

      if (xt === 'Comment') {
        var bodyNode = xml.findChild(node, 'body');
        el = createTyped('UMLNote', {
          name: name || 'Note',
          documentation: String(node.attrs.documentation || (bodyNode ? bodyNode.text : node.text) || '').trim()
        });
        idToEl.set(xid, el);
        return el;
      }

      // fallback: generic package-ish container
      el = createTyped('UMLPackage', { name: name || xt || 'Element' });
      el.ext = el.ext || {};
      el.ext.__xmiType = xt;
      idToEl.set(xid, el);
      node.children.forEach(function (c) {
        if (c.name === '#text') return;
        var sub = buildElement(c, el, el);
        if (sub) model.addOwned(project, el, sub);
      });
      return el;
    }

    var REL_TYPE_BY_XT = {};
    for (var k in REL_NESTED) REL_TYPE_BY_XT[stripUml(REL_NESTED[k].type)] = k;
    var REL_NESTED_BY_TAG = {};
    for (var k2 in REL_NESTED) REL_NESTED_BY_TAG[REL_NESTED[k2].tag] = k2;
    REL_NESTED_BY_TAG['generalization'] = 'UMLGeneralization';
    REL_NESTED_BY_TAG['realization'] = 'UMLRealization';
    REL_NESTED_BY_TAG['interfaceRealization'] = 'UMLInterfaceRealization';
    REL_NESTED_BY_TAG['dependency'] = 'UMLDependency';
    REL_NESTED_BY_TAG['include'] = 'UMLInclude';
    REL_NESTED_BY_TAG['extend'] = 'UMLExtend';
    REL_NESTED_BY_TAG['connector'] = 'UMLConnector';
    REL_NESTED_BY_TAG['communicationPath'] = 'UMLCommunicationPath';

    /* sibling-form relationships (packagedElement with client/supplier etc.) */
    var REL_BY_XT = {
      'Generalization': 'UMLGeneralization',
      'Realization': 'UMLRealization',
      'InterfaceRealization': 'UMLInterfaceRealization',
      'Dependency': 'UMLDependency',
      'Abstraction': 'UMLDependency',
      'Usage': 'UMLDependency',
      'Include': 'UMLInclude',
      'Extend': 'UMLExtend',
      'Connector': 'UMLConnector',
      'CommunicationPath': 'UMLCommunicationPath'
    };

    function buildNestedRel(c, tagName, sourceEl, owner) {
      var relType = REL_NESTED_BY_TAG[tagName];
      if (!relType) return null;
      var xt = stripUml(c.attrs['xmi:type']);
      if (REL_TYPE_BY_XT[xt]) relType = REL_TYPE_BY_XT[xt];
      var rel = createTyped(relType, { name: c.attrs.name || '', stereotype: c.attrs.stereotype || '' });
      idToEl.set(newXid(c), rel);
      rel.source = sourceEl;
      var spec = REL_NESTED[relType];
      var targetXid = spec ? (c.attrs[spec.targetAttr] || c.attrs.supplier || c.attrs.client) : null;
      if (relType === 'UMLGeneralization') targetXid = c.attrs.general;
      if (relType === 'UMLInclude') targetXid = c.attrs.addition || c.attrs.supplier;
      if (relType === 'UMLExtend') targetXid = c.attrs.extendedCase || c.attrs.supplier;
      if (targetXid) refOrPend(rel, 'target', targetXid);
      model.addOwned(project, sourceEl, rel);
      return rel;
    }

    function buildAttribute(c) {
      var a = createTyped('UMLAttribute', {
        name: c.attrs.name || '',
        visibility: c.attrs.visibility || 'public',
        isStatic: c.attrs.isStatic === 'true',
        isReadOnly: c.attrs.isReadOnly === 'true',
        defaultValue: c.attrs.defaultValue || '',
        multiplicity: multiplicityFromChildren(c)
      });
      idToEl.set(newXid(c), a);
      var tn = typeFromChild(c);
      if (c.attrs.type) refOrPend(a, 'type', c.attrs.type);
      else if (tn && typeof tn === 'string') a.type = tn;
      else if (tn && tn.__xid) refOrPend(a, 'type', tn.__xid);
      return a;
    }

    function buildOperation(c) {
      var o = createTyped('UMLOperation', {
        name: c.attrs.name || '',
        visibility: c.attrs.visibility || 'public',
        isStatic: c.attrs.isStatic === 'true',
        isAbstract: c.attrs.isAbstract === 'true',
        isQuery: c.attrs.isQuery === 'true'
      });
      idToEl.set(newXid(c), o);
      o.parameters = [];
      c.children.forEach(function (pc) {
        if (xml.stripNs(pc.name) !== 'ownedParameter' && stripUml(pc.attrs['xmi:type']) !== 'Parameter') return;
        var p = createTyped('UMLParameter', {
          name: pc.attrs.name || '',
          direction: pc.attrs.direction || 'in',
          defaultValue: pc.attrs.defaultValue || '',
          multiplicity: multiplicityFromChildren(pc)
        });
        idToEl.set(newXid(pc), p);
        var tn = typeFromChild(pc);
        if (pc.attrs.type) refOrPend(p, 'type', pc.attrs.type);
        else if (tn && typeof tn === 'string') p.type = tn;
        else if (tn && tn.__xid) refOrPend(p, 'type', tn.__xid);
        p._parent = o;
        project._register(p);
        o.parameters.push(p);
      });
      return o;
    }

    var STATE_TYPES = { 'State': 'UMLState', 'Pseudostate': 'UMLPseudostate', 'FinalState': 'UMLFinalState' };

    function buildStateChildren(node, owner) {
      node.children.forEach(function (c) {
        if (c.name === '#text') return;
        var cn = xml.stripNs(c.name);
        var ct = stripUml(c.attrs['xmi:type']);
        if (cn === 'subvertex' || STATE_TYPES[ct]) {
          var t = STATE_TYPES[ct] || 'UMLState';
          var s = createTyped(t, { name: c.attrs.name || '', kind: c.attrs.kind || 'initial' });
          if (t === 'UMLPseudostate') s.kind = c.attrs.kind || 'initial';
          idToEl.set(newXid(c), s);
          var en = xml.findChild(c, 'entry'); if (en) s.entryActivity = en.attrs.name || en.text || '';
          var doA = xml.findChild(c, 'doActivity'); if (doA) s.doActivity = doA.attrs.name || doA.text || '';
          var ex = xml.findChild(c, 'exit'); if (ex) s.exitActivity = ex.attrs.name || ex.text || '';
          model.addOwned(project, owner, s);
          buildStateChildren(c, s);
        } else if (cn === 'transition' || ct === 'Transition') {
          var tr = createTyped('UMLTransition', { name: c.attrs.name || '' });
          idToEl.set(newXid(c), tr);
          if (c.attrs.source) refOrPend(tr, 'source', c.attrs.source);
          if (c.attrs.target) refOrPend(tr, 'target', c.attrs.target);
          var trg = xml.findChild(c, 'trigger'); if (trg) tr.trigger = (trg.attrs.name || trg.text || '').trim();
          var gd = xml.findChild(c, 'guard');
          if (gd) {
            var spec = xml.findChild(gd, 'specification');
            tr.guard = String(gd.attrs.name || (spec ? spec.text : gd.text) || '').trim();
          }
          var ef = xml.findChild(c, 'effect'); if (ef) tr.effect = (ef.attrs.name || ef.text || '').trim();
          if (c.attrs.trigger) tr.trigger = c.attrs.trigger;
          if (c.attrs.guard) tr.guard = c.attrs.guard;
          if (c.attrs.effect) tr.effect = c.attrs.effect;
          model.addOwned(project, owner, tr);
        } else if (cn === 'region') {
          buildStateChildren(c, owner);
        }
      });
    }

    function buildActivityNode(c, owner) {
      var ct = stripUml(c.attrs['xmi:type']);
      var map = {
        'Action': 'UMLAction', 'ObjectNode': 'UMLObjectNode', 'InitialNode': 'UMLInitialNode',
        'ActivityFinalNode': 'UMLActivityFinalNode', 'FlowFinalNode': 'UMLFlowFinalNode',
        'DecisionNode': 'UMLDecisionNode', 'MergeNode': 'UMLMergeNode',
        'ForkNode': 'UMLForkNode', 'JoinNode': 'UMLJoinNode',
        'OpaqueAction': 'UMLAction'
      };
      var t = map[ct];
      if (!t) return null;
      var el = createTyped(t, { name: c.attrs.name || '' });
      idToEl.set(newXid(c), el);
      return el;
    }

    // walk top-level models
    var importedRoots = [];
    var importModel = model.createElement(project, 'UMLModel', { name: 'ImportedModel' });
    var foundTop = false;
    xmi.children.forEach(function (c) {
      if (c.name === '#text') return;
      var ct = stripUml(c.attrs['xmi:type']);
      var cn = xml.stripNs(c.name);
      if (cn === 'Model' || ct === 'Model') {
        foundTop = true;
        importModel.name = c.attrs.name || 'ImportedModel';
        idToEl.set(newXid(c), importModel);
        c.children.forEach(function (cc) {
          if (cc.name === '#text') return;
          var ccn = xml.stripNs(cc.name);
          var cct = stripUml(cc.attrs['xmi:type']);
          if (REL_NESTED_BY_TAG[ccn]) { buildNestedRel(cc, ccn, importModel, importModel); return; }
          var sub = buildElement(cc, importModel, importModel);
          if (sub) { model.addOwned(project, importModel, sub); importedRoots.push(sub); }
        });
      } else {
        var sub2 = buildElement(c, importModel, importModel);
        if (sub2) { model.addOwned(project, importModel, sub2); importedRoots.push(sub2); }
      }
    });

    // resolve pending refs
    var unresolved = 0;
    pending.forEach(function (p) {
      if (p.container === '__end') {
        var foundEnd = idToEl.get(p.xid);
        if (foundEnd && foundEnd._type === 'UMLAssociationEnd') return; // ends registered separately
        return;
      }
      var target = idToEl.get(p.xid);
      if (target) p.container[p.key] = target;
      else {
        unresolved++;
        if (p.key === 'type') p.container.type = p.container.type || '';
        else p.container[p.key] = null;
      }
    });

    // attach imported model under project root
    model.addOwned(project, project.root, importModel);
    return { model: importModel, unresolved: unresolved, roots: importedRoots };
  }

  OS.Xmi = {
    exportProject: exportProject,
    importInto: importInto
  };
})(typeof window !== 'undefined' ? window : globalThis);
