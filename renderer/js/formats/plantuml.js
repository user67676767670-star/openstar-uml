/*
 * OpenStar UML — PlantUML generation.
 * Supports: class, use case, sequence, statechart, component and deployment
 * diagrams (activity diagrams are emitted as an equivalent state-style flow).
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};
  var util = OS.util, meta = OS.meta, model = OS.model, views = OS.views;

  function alias(el, taken) {
    var base = (el.name || el._type).replace(/[^A-Za-z0-9_]/g, '_') || 'E';
    if (/^[0-9]/.test(base)) base = '_' + base;
    var a = base, i = 1;
    while (taken.has(a)) { a = base + '_' + (++i); }
    taken.add(a);
    return a;
  }

  function quoted(s) { return '"' + String(s == null ? '' : s).replace(/"/g, '\\"') + '"'; }

  function visMark(v) { return model.visibilityMark(v); }

  function collectScope(project, diagram) {
    var models = [];
    if (diagram) {
      var seen = new Set();
      (diagram.ownedElements || []).forEach(function (m) { if (!seen.has(m)) { seen.add(m); models.push(m); } });
      (diagram.ownedViews || []).forEach(function (v) {
        var m = v.model;
        if (m && !seen.has(m)) { seen.add(m); models.push(m); }
        if (m && m.ownedEnds) m.ownedEnds.forEach(function (e) {
          if (e.reference && !seen.has(e.reference)) { seen.add(e.reference); models.push(e.reference); }
        });
      });
    } else {
      (function walk(el) {
        (el.ownedElements || []).forEach(function (c) {
          if (!meta.isDiagramLike(c._type)) { models.push(c); walk(c); }
        });
      })(project.root);
    }
    return models;
  }

  /* ============================ class-ish ============================ */

  function genClassLike(project, diagram, kind) {
    var out = [];
    var models = collectScope(project, diagram);
    var taken = new Set();
    var aliases = new Map();
    var inScope = new Set(models);

    models.forEach(function (m) { aliases.set(m, alias(m, taken)); });

    // packages
    var packages = models.filter(function (m) { return m._type === 'UMLPackage' || m._type === 'UMLModel'; });
    function insidePackage(m) {
      var p = m._parent;
      while (p && p._type !== 'Project') {
        if ((p._type === 'UMLPackage' || p._type === 'UMLModel') && inScope.has(p)) return p;
        p = p._parent;
      }
      return null;
    }

    function classifierBlock(m) {
      var a = aliases.get(m);
      var lines = [];
      var stereo = model.stereotypeText(m);
      var kw = kind === 'component' ? componentKeyword(m) : keywordFor(m);
      var head = kw + ' ' + quoted(m.name || a) + ' as ' + a;
      if (stereo) head += ' <<' + stereo + '>>';
      if (m.isAbstract && kw === 'class') head = 'abstract class ' + quoted(m.name || a) + ' as ' + a + (stereo ? ' <<' + stereo + '>>' : '');
      var members = [];
      (m.ownedAttributes || []).forEach(function (at) {
        members.push(visMark(at.visibility) + (at.name || '') + (at.type ? ' : ' + model.typeName(at.type) : '') +
          (at.defaultValue ? ' = ' + at.defaultValue : ''));
      });
      (m.ownedOperations || []).forEach(function (op) {
        var params = (op.parameters || []).filter(function (p) { return p.direction !== 'return'; })
          .map(model.formatParameter).join(', ');
        var ret = (op.parameters || []).filter(function (p) { return p.direction === 'return'; })[0];
        members.push(visMark(op.visibility) + (op.name || '') + '(' + params + ')' +
          (ret && ret.type ? ' : ' + model.typeName(ret.type) : ''));
      });
      if (m._type === 'UMLEnumeration') {
        (m.ownedLiterals || []).forEach(function (l) { members.push(l.name || ''); });
      }
      if (members.length) {
        lines.push(head + ' {');
        members.forEach(function (mm) { lines.push('  ' + mm); });
        lines.push('}');
      } else {
        lines.push(head);
      }
      return lines;
    }

    function keywordFor(m) {
      switch (m._type) {
        case 'UMLClass': return 'class';
        case 'UMLInterface': return 'interface';
        case 'UMLEnumeration': return 'enum';
        case 'UMLDataType': return 'class';
        case 'UMLActor': return 'actor';
        case 'UMLUseCase': return 'usecase';
        case 'UMLComponent': return 'component';
        case 'UMLNode': return 'node';
        case 'UMLArtifact': return 'component';
        default: return 'class';
      }
    }
    function componentKeyword(m) {
      if (m._type === 'UMLInterface') return 'interface';
      if (m._type === 'UMLArtifact') return 'component';
      return keywordFor(m);
    }

    function emitTree(parent) {
      models.forEach(function (m) {
        if (insidePackage(m) !== parent) return;
        if (m._type === 'UMLPackage' || m._type === 'UMLModel') {
          out.push('package ' + quoted(m.name || '') + ' {');
          emitTree(m);
          out.push('}');
        } else if (/^UML(Class|Interface|Enumeration|DataType|Actor|UseCase|Component|Node|Artifact|Subsystem)$/.test(m._type)) {
          classifierBlock(m).forEach(function (l) { out.push(l); });
        }
      });
    }
    emitTree(null);

    // relationships
    models.forEach(function (m) {
      var rel = relationshipLine(m, aliases, inScope);
      if (rel) out.push(rel);
    });
    if (kind === 'usecase') {
      // include/extend handled by relationshipLine
    }
    return out;
  }

  function relationshipLine(m, aliases, inScope) {
    function A(el) { return el ? aliases.get(el) : null; }
    function inS(el) { return !inScope || inScope.has(el); }
    var label = m.name ? ' : ' + m.name : '';
    switch (m._type) {
      case 'UMLGeneralization':
        if (m.source && m.target && A(m.source) && A(m.target)) return A(m.target) + ' <|-- ' + A(m.source);
        return null;
      case 'UMLRealization': case 'UMLInterfaceRealization':
        if (A(m.source) && A(m.target)) return A(m.target) + ' <|.. ' + A(m.source);
        return null;
      case 'UMLDependency':
        if (A(m.source) && A(m.target)) return A(m.source) + ' ..> ' + A(m.target) + label;
        return null;
      case 'UMLInclude':
        if (A(m.source) && A(m.target)) return A(m.source) + ' ..> ' + A(m.target) + ' : <<include>>';
        return null;
      case 'UMLExtend':
        if (A(m.source) && A(m.target)) return A(m.source) + ' ..> ' + A(m.target) + ' : <<extend>>';
        return null;
      case 'UMLConnector': case 'UMLCommunicationPath':
        if (A(m.source) && A(m.target)) return A(m.source) + ' -- ' + A(m.target) + label;
        return null;
      case 'UMLAssociation': {
        var ends = m.ownedEnds || [];
        if (ends.length < 2) return null;
        var e1 = ends[0], e2 = ends[1];
        if (!A(e1.reference) || !A(e2.reference)) return null;
        function side(e) {
          var s = '';
          if (e.name) s += quoted(e.name) + ' ';
          if (e.multiplicity) s += quoted(e.multiplicity) + ' ';
          return s;
        }
        // aggregation lives on the "whole" end; PlantUML draws the diamond left
        var left = e1, right = e2, arrow;
        var agg1 = e1.aggregation || 'none', agg2 = e2.aggregation || 'none';
        if (agg2 === 'composite' || agg2 === 'shared') {
          left = e2; right = e1;
          arrow = agg2 === 'composite' ? '*--' : 'o--';
        } else if (agg1 === 'composite' || agg1 === 'shared') {
          arrow = agg1 === 'composite' ? '*--' : 'o--';
        } else if (e1.navigable === false && e2.navigable !== false) arrow = '-->';
        else if (e2.navigable === false && e1.navigable !== false) arrow = '<--';
        else arrow = '--';
        return A(left.reference) + ' ' + side(left) + arrow + ' ' + side(right) + A(right.reference) + label;
      }
      default: return null;
    }
  }

  /* ============================ sequence ============================ */

  function genSequence(project, diagram) {
    var out = [];
    var lifelines = (diagram.ownedElements || []).filter(function (e) { return e._type === 'UMLLifeline'; });
    var msgs = (diagram.ownedElements || []).filter(function (e) { return e._type === 'UMLMessage'; });
    var frags = (diagram.ownedElements || []).filter(function (e) { return e._type === 'UMLCombinedFragment'; });
    var taken = new Set();
    var aliases = new Map();
    lifelines.sort(function (a, b) { return viewX(diagram, a) - viewX(diagram, b); });
    lifelines.forEach(function (l) {
      var a = alias(l, taken);
      aliases.set(l, a);
      var rep = l.represent ? (typeof l.represent === 'string' ? l.represent : model.typeName(l.represent)) : '';
      var label = (l.name || '') + (rep ? ' : ' + rep : '');
      out.push('participant ' + quoted(label) + ' as ' + a);
    });
    function viewX(d, m) {
      var v = (d.ownedViews || []).filter(function (vv) { return vv.model === m; })[0];
      return v ? v.left : 0;
    }
    function msgY(m) {
      var v = (diagram.ownedViews || []).filter(function (vv) { return vv.model === m; })[0];
      return v && v.points && v.points[0] ? v.points[0].y : 0;
    }
    // merge messages + fragment boundaries in y order
    var events = msgs.map(function (m) { return { y: msgY(m), kind: 'msg', el: m }; });
    frags.forEach(function (f) {
      var v = (diagram.ownedViews || []).filter(function (vv) { return vv.model === f; })[0];
      if (v) {
        events.push({ y: v.top, kind: 'fragStart', el: f, v: v });
        events.push({ y: v.top + v.height, kind: 'fragEnd', el: f });
      }
    });
    events.sort(function (a, b) { return a.y - b.y; });
    events.forEach(function (ev) {
      if (ev.kind === 'fragStart') {
        var op = ev.el.operator || 'seq';
        var ops = (ev.el.ownedElements || []).filter(function (o) { return o._type === 'UMLInteractionOperand'; });
        var kw = ['alt', 'opt', 'loop', 'par', 'break', 'critical', 'group'].indexOf(op) >= 0 ? op : 'group';
        var guard = ops[0] && (ops[0].guard || ops[0].name) ? ' ' + (ops[0].guard || ops[0].name) : '';
        out.push(kw + (kw === 'group' ? ' ' + op : '') + guard);
      } else if (ev.kind === 'fragEnd') {
        out.push('end');
      } else {
        var m = ev.el;
        var s = aliases.get(m.source), t = aliases.get(m.target);
        if (!s || !t) return;
        var text = model.formatMessage(m) || (m.name || '');
        var arrow;
        switch (m.messageSort) {
          case 'asynchCall': case 'asynchSignal': arrow = '->>'; break;
          case 'replyMessage': arrow = '-->'; break;
          case 'createMessage': arrow = '->'; out.push('create ' + t); break;
          case 'deleteMessage': arrow = '->'; break;
          default: arrow = '->';
        }
        out.push(s + ' ' + arrow + ' ' + t + (text ? ' : ' + text : ''));
        if (m.messageSort === 'deleteMessage') out.push('destroy ' + t);
      }
    });
    return out;
  }

  /* ============================ state / activity ============================ */

  function genState(project, diagram) {
    var out = [];
    var models = collectScope(project, diagram);
    var taken = new Set();
    var aliases = new Map();
    var inScope = new Set(models);
    models.forEach(function (m) {
      if (m._type === 'UMLState' || m._type === 'UMLCompositeState') aliases.set(m, alias(m, taken));
      else if (m._type === 'UMLPseudostate' || m._type === 'UMLFinalState') aliases.set(m, alias(m, taken));
      else if (m._type === 'UMLAction' || /^UML.*Node$/.test(m._type)) aliases.set(m, alias(m, taken));
    });
    models.forEach(function (m) {
      var a = aliases.get(m);
      if (!a) return;
      switch (m._type) {
        case 'UMLState': case 'UMLCompositeState':
          out.push('state ' + quoted(m.name || a) + ' as ' + a);
          break;
        case 'UMLPseudostate': {
          var k = m.kind;
          if (k === 'initial') { /* emitted via transitions */ }
          else if (k === 'fork' || k === 'join') out.push('state ' + a + ' <<' + (k === 'fork' ? 'fork' : 'join') + '>>');
          else if (k === 'choice' || k === 'junction') out.push('state ' + a + ' <<choice>>');
          else if (k === 'shallowHistory') out.push('state ' + a + ' <<history>>');
          else if (k === 'deepHistory') out.push('state ' + a + ' <<H*>>');
          else if (k === 'entryPoint') out.push('state ' + a + ' <<entryPoint>>');
          else if (k === 'exitPoint') out.push('state ' + a + ' <<exitPoint>>');
          else if (k === 'terminate') out.push('state ' + a + ' <<end>>');
          break;
        }
        case 'UMLFinalState': case 'UMLActivityFinalNode':
          break; // rendered as [*]
        case 'UMLInitialNode':
          break; // rendered as [*]
        case 'UMLFlowFinalNode':
          out.push('state ' + quoted(m.name || 'FlowFinal') + ' as ' + a + ' <<end>>');
          break;
        case 'UMLAction': case 'UMLObjectNode':
        case 'UMLDecisionNode': case 'UMLMergeNode': case 'UMLForkNode': case 'UMLJoinNode':
          out.push('state ' + quoted(m.name || a) + ' as ' + a);
          break;
      }
    });
    // composite containment
    models.forEach(function (m) {
      if (m._type === 'UMLState' || m._type === 'UMLCompositeState') {
        var kids = (m.ownedElements || []).filter(function (c) { return aliases.has(c); });
        if (kids.length) {
          out.push('state ' + quoted(m.name || aliases.get(m)) + ' as ' + aliases.get(m) + ' {');
          kids.forEach(function (kid) {
            out.push('  state ' + quoted(kid.name || aliases.get(kid)) + ' as ' + aliases.get(kid));
          });
          out.push('}');
        }
      }
    });
    function endToken(m) {
      if (!m) return null;
      if (m._type === 'UMLPseudostate' && m.kind === 'initial') return '[*]';
      if (m._type === 'UMLInitialNode') return '[*]';
      if (m._type === 'UMLFinalState' || m._type === 'UMLActivityFinalNode') return '[*]';
      if (m._type === 'UMLFlowFinalNode') return aliases.get(m) || null;
      return aliases.get(m) || null;
    }
    models.forEach(function (m) {
      if (m._type !== 'UMLTransition' && m._type !== 'UMLControlFlow' && m._type !== 'UMLObjectFlow') return;
      var s = endToken(m.source), t = endToken(m.target);
      if (!s || !t) return;
      var label = m._type === 'UMLTransition' ? model.formatTransition(m) : model.formatControlFlow(m);
      out.push(s + ' --> ' + t + (label ? ' : ' + label : ''));
    });
    return out;
  }

  /* ============================ deployment / component ============================ */

  function genDeployment(project, diagram) {
    var out = [];
    var models = collectScope(project, diagram);
    var taken = new Set();
    var aliases = new Map();
    models.forEach(function (m) {
      if (/^UML(Node|Component|Artifact|Instance|Interface)$/.test(m._type)) aliases.set(m, alias(m, taken));
    });
    function inside(el, type) {
      var p = el._parent;
      while (p && p._type !== 'Project') { if (p._type === type && aliases.has(p)) return p; p = p._parent; }
      return null;
    }
    function emit(parent) {
      models.forEach(function (m) {
        if (inside(m, 'UMLNode') !== parent) return;
        var a = aliases.get(m);
        if (!a) return;
        if (m._type === 'UMLNode') {
          var kids = models.filter(function (c) { return inside(c, 'UMLNode') === m; });
          out.push('node ' + quoted(m.name || a) + ' as ' + a + (kids.length ? ' {' : ''));
          if (kids.length) { emit(m); out.push('}'); }
        } else if (m._type === 'UMLComponent') {
          out.push('component ' + quoted(m.name || a) + ' as ' + a);
        } else if (m._type === 'UMLArtifact') {
          out.push('artifact ' + quoted(m.name || a) + ' as ' + a);
        } else if (m._type === 'UMLInterface') {
          out.push('interface ' + quoted(m.name || a) + ' as ' + a);
        } else if (m._type === 'UMLInstance') {
          out.push('component ' + quoted((m.name || a) + (m.classifier ? ' : ' + model.typeName(m.classifier) : '')) + ' as ' + a);
        }
      });
    }
    emit(null);
    models.forEach(function (m) {
      var rel = relationshipLine(m, aliases, null);
      if (rel) out.push(rel);
    });
    return out;
  }

  /* ============================ notes (all kinds) ============================ */

  function appendNotes(out, project, diagram) {
    var models = collectScope(project, diagram);
    models.forEach(function (m) {
      if (m._type !== 'UMLNote') return;
      var txt = (m.documentation || '').replace(/"/g, '');
      if (txt) out.push('note left\n  ' + txt.split('\n').join('\n  ') + '\nend note');
    });
  }

  /* ============================ entry ============================ */

  function generate(project, diagram) {
    var t = diagram ? diagram._type : 'UMLClassDiagram';
    var lines = ['@startuml', "' Generated by OpenStar UML", ''];
    var body;
    switch (t) {
      case 'UMLSequenceDiagram': body = genSequence(project, diagram); break;
      case 'UMLStatechartDiagram': body = genState(project, diagram); break;
      case 'UMLActivityDiagram': body = genState(project, diagram); break; // activity → equivalent flow syntax
      case 'UMLUseCaseDiagram': body = genClassLike(project, diagram, 'usecase'); break;
      case 'UMLDeploymentDiagram': body = genDeployment(project, diagram); break;
      case 'UMLComponentDiagram': body = genClassLike(project, diagram, 'component'); break;
      default: body = genClassLike(project, diagram, 'class');
    }
    appendNotes(lines, project, diagram);
    lines = lines.concat(body, ['', '@enduml', '']);
    return lines.join('\n');
  }

  function generateAll(project) {
    var out = [];
    project.eachDiagram(function (d) {
      out.push("' ===== Diagram: " + d.name + " (" + (meta.DIAGRAMS[d._type] ? meta.DIAGRAMS[d._type].label : d._type) + ") =====");
      out.push(generate(project, d));
    });
    return out.join('\n');
  }

  OS.PlantUML = {
    generate: generate,
    generateAll: generateAll
  };
})(typeof window !== 'undefined' ? window : globalThis);
