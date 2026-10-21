/*
 * OpenStar UML — Markdown documentation generator.
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};
  var meta = OS.meta, model = OS.model;

  function esc(s) {
    return String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, '<br/>');
  }

  function vis(v) { return model.visibilityMark(v); }

  function typeName(t) { return model.typeName(t); }

  function table(headers, rows) {
    if (!rows.length) return '';
    var out = ['| ' + headers.join(' | ') + ' |',
      '|' + headers.map(function () { return ' --- '; }).join('|') + '|'];
    rows.forEach(function (r) { out.push('| ' + r.map(esc).join(' | ') + ' |'); });
    return out.join('\n') + '\n';
  }

  function relationshipsOf(el) {
    var rels = [];
    (el.ownedElements || []).forEach(function (c) {
      if (meta.isEdgeModel(c._type)) rels.push(c);
    });
    return rels;
  }

  function walk(el, depth, out) {
    var heading = '#'.repeat(Math.min(depth + 2, 6));
    var stereo = model.stereotypeText(el);
    var title = meta.label(el._type);
    var name = el.name || '(unnamed)';
    if (meta.isDiagramLike(el._type)) {
      out.push(heading + ' 📈 Diagram: ' + name + '  \n*(' + title + ')*\n');
      return;
    }
    out.push(heading + ' ' + title + ': ' + name + (stereo ? ' «' + stereo + '»' : ''));
    if (el.documentation) out.push('\n> ' + String(el.documentation).split('\n').join('\n> ') + '\n');

    var flags = [];
    if (el.visibility && el.visibility !== 'public') flags.push('visibility: ' + el.visibility);
    if (el.isAbstract) flags.push('abstract');
    if (el.isFinalSpecialization) flags.push('final');
    if (el.isStatic) flags.push('static');
    if (flags.length) out.push('\n*' + flags.join(', ') + '*\n');

    if (el.ownedAttributes && el.ownedAttributes.length) {
      out.push('\n**Attributes**\n');
      out.push(table(['Vis', 'Name', 'Type', 'Multiplicity', 'Default', 'Static'],
        el.ownedAttributes.map(function (a) {
          return [vis(a.visibility), a.name, typeName(a.type), a.multiplicity || '1', a.defaultValue || '', a.isStatic ? '✓' : ''];
        })));
    }
    if (el.ownedOperations && el.ownedOperations.length) {
      out.push('\n**Operations**\n');
      out.push(table(['Vis', 'Signature', 'Static', 'Abstract'],
        el.ownedOperations.map(function (o) {
          var params = (o.parameters || []).filter(function (p) { return p.direction !== 'return'; }).map(model.formatParameter).join(', ');
          var ret = (o.parameters || []).filter(function (p) { return p.direction === 'return'; })[0];
          var sig = o.name + '(' + params + ')' + (ret && ret.type ? ' : ' + typeName(ret.type) : '');
          return [vis(o.visibility), sig, o.isStatic ? '✓' : '', o.isAbstract ? '✓' : ''];
        })));
    }
    if (el.ownedLiterals && el.ownedLiterals.length) {
      out.push('\n**Literals**: ' + el.ownedLiterals.map(function (l) { return '`' + esc(l.name) + '`'; }).join(', ') + '\n');
    }
    if (el.ownedEnds && el.ownedEnds.length === 2 && el._type === 'UMLAssociation') {
      var e1 = el.ownedEnds[0], e2 = el.ownedEnds[1];
      out.push('\n**Association**: `' + (e1.reference ? e1.reference.name : '?') + '` ' +
        (e1.name ? '(' + e1.name + ')' : '') + ' [' + (e1.multiplicity || '1') + '] ' +
        (e1.aggregation === 'composite' ? '◆—' : e1.aggregation === 'shared' ? '◇—' : '—') + ' ' +
        '[' + (e2.multiplicity || '1') + '] ' + (e2.name ? '(' + e2.name + ')' : '') +
        ' `' + (e2.reference ? e2.reference.name : '?') + '`\n');
    }
    var rels = relationshipsOf(el);
    if (rels.length && el._type !== 'UMLAssociation') {
      out.push('\n**Relationships**\n');
      out.push(table(['Kind', 'Target', 'Name'],
        rels.map(function (r) {
          return [meta.label(r._type), r.target ? (r.target.name || meta.label(r.target._type)) : '—', r.name || ''];
        })));
    }
    if (el._type === 'UMLStateMachine' || el._type === 'UMLActivity' ||
        el._type === 'UMLState' || el._type === 'UMLCompositeState') {
      var states = (el.ownedElements || []).filter(function (c) {
        return /^UML(State|CompositeState|Pseudostate|FinalState|Action|.*Node)$/.test(c._type);
      });
      if (states.length) {
        out.push('\n**Nodes**\n');
        out.push(table(['Kind', 'Name', 'Details'], states.map(function (s) {
          var details = [];
          if (s.kind) details.push('kind: ' + s.kind);
          if (s.entryActivity) details.push('entry/' + s.entryActivity);
          if (s.doActivity) details.push('do/' + s.doActivity);
          if (s.exitActivity) details.push('exit/' + s.exitActivity);
          return [meta.label(s._type), s.name || '—', details.join(', ')];
        })));
      }
      var trans = (el.ownedElements || []).filter(function (c) {
        return c._type === 'UMLTransition' || c._type === 'UMLControlFlow' || c._type === 'UMLObjectFlow';
      });
      if (trans.length) {
        out.push('\n**Flows / Transitions**\n');
        out.push(table(['From', 'To', 'Label'], trans.map(function (t) {
          var label = t._type === 'UMLTransition' ? model.formatTransition(t) : model.formatControlFlow(t);
          return [t.source ? (t.source.name || meta.label(t.source._type)) : '—',
            t.target ? (t.target.name || meta.label(t.target._type)) : '—', label || ''];
        })));
      }
    }
    out.push('');
    (el.ownedElements || []).forEach(function (c) {
      if (c._type === 'UMLRegion') { (c.ownedElements || []).forEach(function (cc) { walk(cc, depth + 1, out); }); return; }
      if (meta.isEdgeModel(c._type) && c._type !== 'UMLAssociation') return; // shown in tables
      walk(c, depth + 1, out);
    });
  }

  function generate(project) {
    var out = [];
    out.push('# ' + (project.root.name || 'Untitled'));
    out.push('');
    out.push('*Generated by OpenStar UML — ' + new Date().toISOString().slice(0, 10) + '*');
    out.push('');
    var diagrams = project.diagrams();
    if (diagrams.length) {
      out.push('## Diagram Index');
      out.push('');
      diagrams.forEach(function (d) {
        out.push('- **' + (d.name || '(unnamed)') + '** — ' +
          (meta.DIAGRAMS[d._type] ? meta.DIAGRAMS[d._type].label : d._type));
      });
      out.push('');
    }
    (project.root.ownedElements || []).forEach(function (m) { walk(m, 0, out); });
    return out.join('\n');
  }

  OS.Markdown = { generate: generate };
})(typeof window !== 'undefined' ? window : globalThis);
