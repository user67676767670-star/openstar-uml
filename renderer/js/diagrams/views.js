/*
 * OpenStar UML — view rendering engine.
 * Pure functions over view data objects; all drawing goes through the Gfx
 * abstraction so the same code renders to screen (Canvas), PNG and SVG.
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};
  var util = OS.util, meta = OS.meta, model = OS.model, text = OS.text;

  var C = {
    line: '#000000',
    text: '#000000',
    dimText: '#444444',
    fill: '#ffffff',
    select: '#2f80c3',
    selectFill: 'rgba(47,128,195,0.10)'
  };

  var PAD = 6;            // text padding inside boxes
  var NAME_H = 25;        // name compartment height (no stereotype)
  var STEREO_H = 14;      // extra height for stereotype line
  var LINE_H = 16;        // member line height

  function viewRect(v) { return { x: v.left || 0, y: v.top || 0, width: v.width || 0, height: v.height || 0 }; }

  function isClassifierView(t) {
    return t === 'UMLClassView' || t === 'UMLInterfaceView' || t === 'UMLEnumerationView' ||
      t === 'UMLDataTypeView' || t === 'UMLComponentView' || t === 'UMLArtifactView' ||
      t === 'UMLNodeView' || t === 'UMLActorView' || t === 'UMLUseCaseView' ||
      t === 'UMLSubsystemView' || t === 'UMLInstanceView';
  }

  var CONTAINERS = {
    'UMLPackageView': true, 'UMLModelView': true, 'UMLSubsystemView': true,
    'UMLStateView': true, 'UMLCompositeStateView': true, 'UMLCombinedFragmentView': true,
    'UMLComponentView': true, 'UMLArtifactView': true, 'UMLNodeView': true, 'UMLInstanceView': true
  };
  function isContainerType(t) { return !!CONTAINERS[t]; }

  function forcedStereotype(v) {
    var t = v._type;
    if (t === 'UMLInterfaceView') return 'interface';
    if (t === 'UMLDataTypeView') return 'dataType';
    if (t === 'UMLSubsystemView') return 'subsystem';
    return '';
  }

  function stereoOf(v) {
    var s = model.stereotypeText(v.model);
    return s || forcedStereotype(v);
  }

  function nsOf(v) {
    if (!v.showNamespace || !v.model) return '';
    var p = v.model._parent;
    var names = [];
    while (p && p._type !== 'Project') { names.unshift(p.name || ''); p = p._parent; }
    return names.join('::');
  }

  function boldFont(font) {
    var f = text.parseFont(font);
    return text.fontToMdj({ family: f.family, size: f.size, bold: true, italic: f.italic, underline: f.underline });
  }
  function italicFont(font) {
    var f = text.parseFont(font);
    return text.fontToMdj({ family: f.family, size: f.size, bold: f.bold, italic: true, underline: f.underline });
  }

  /* ============================ layout ============================ */

  function memberLines(v) {
    var m = v.model;
    var out = { attributes: [], operations: [], literals: [] };
    if (!m) return out;
    var opts = {
      showVisibility: v.showVisibility, showType: v.showType,
      showProperty: v.showProperty, showMultiplicity: v.showMultiplicity
    };
    if (!v.suppressAttributes && m.ownedAttributes) {
      out.attributes = m.ownedAttributes.map(function (a) {
        return { text: model.formatAttribute(a, opts), italic: false };
      });
    }
    if (!v.suppressOperations && m.ownedOperations) {
      out.operations = m.ownedOperations.map(function (o) {
        return { text: model.formatOperation(o, opts), italic: false };
      });
    }
    if (!v.suppressLiterals && m.ownedLiterals) {
      out.literals = m.ownedLiterals.map(function (l) { return { text: model.formatLiteral(l) }; });
    }
    return out;
  }

  /**
   * Compute layout for a node view. Returns:
   * { nameCompartment:{rect,text,namespace}, compartments:[{id,rect,lines,visible}],
   *   classifierStyle:bool, minHeight }
   */
  function computeLayout(v) {
    var r = viewRect(v);
    var font = v.font || text.DEFAULT_FONT;
    var stereo = stereoOf(v);
    var ns = nsOf(v);
    var res = { classifierStyle: false, compartments: [] };
    var nameH = NAME_H + (stereo ? STEREO_H : 0);
    res.nameCompartment = {
      rect: { x: r.x, y: r.y, width: r.width, height: nameH },
      text: v.model ? (v.model.name || '') : '',
      namespace: ns,
      stereo: stereo
    };
    if (v._type === 'UMLClassView' || v._type === 'UMLInterfaceView' ||
        v._type === 'UMLEnumerationView' || v._type === 'UMLDataTypeView' ||
        v._type === 'UMLComponentView' || v._type === 'UMLArtifactView' ||
        v._type === 'UMLNodeView' || v._type === 'UMLSubsystemView') {
      res.classifierStyle = true;
      var lines = memberLines(v);
      var y = r.y + nameH;
      ['attributes', 'operations', 'literals'].forEach(function (id) {
        var arr = lines[id];
        if (!arr) return;
        if (arr.length === 0 && id !== 'attributes' && id !== 'operations') return;
        if (arr.length === 0) return; // StarUML hides empty compartments
        var h = arr.length * LINE_H + 4;
        arr.forEach(function (ln, i) { ln.y = y + 2 + i * LINE_H; });
        res.compartments.push({ id: id, rect: { x: r.x, y: y, width: r.width, height: h }, lines: arr, visible: true });
        y += h;
      });
    }
    return res;
  }

  /** Needed content size for a node view (used by autoLayout). */
  function neededSize(v) {
    var font = v.font || text.DEFAULT_FONT;
    var stereo = stereoOf(v);
    var m = v.model || {};
    var name = m.name || '';
    var nameW = text.measureText(name, boldFont(font));
    if (stereo) nameW = Math.max(nameW, text.measureText('«' + stereo + '»', font));
    if (v.showNamespace && nsOf(v)) nameW = Math.max(nameW, text.measureText('(' + nsOf(v) + ')', font));

    switch (v._type) {
      case 'UMLClassView': case 'UMLInterfaceView': case 'UMLEnumerationView':
      case 'UMLDataTypeView': case 'UMLComponentView': case 'UMLArtifactView':
      case 'UMLNodeView': case 'UMLSubsystemView': {
        var lines = memberLines(v);
        var w = nameW + 24, h = NAME_H + (stereo ? STEREO_H : 0);
        ['attributes', 'operations', 'literals'].forEach(function (id) {
          var arr = lines[id] || [];
          if (!arr.length) return;
          arr.forEach(function (ln) { w = Math.max(w, text.measureText(ln.text, font) + 16); });
          h += arr.length * LINE_H + 4;
        });
        w = Math.max(w, 60);
        h = Math.max(h, NAME_H + (stereo ? STEREO_H : 0) + 4);
        return { w: w, h: h };
      }
      case 'UMLActorView': {
        var label = name;
        return { w: Math.max(48, text.measureText(label, font) + 8), h: 70 };
      }
      case 'UMLUseCaseView':
        return { w: Math.max(90, nameW + 40), h: Math.max(45, 45 + (stereo ? 10 : 0)) };
      case 'UMLPackageView': case 'UMLModelView': {
        var tabW = Math.max(50, nameW + 16);
        return { w: Math.max(tabW + 20, 80), h: Math.max(v.height || 80, 60) };
      }
      case 'UMLStateView': case 'UMLCompositeStateView': {
        var extra = 0;
        if (m.entryActivity) extra += LINE_H;
        if (m.doActivity) extra += LINE_H;
        if (m.exitActivity) extra += LINE_H;
        if (v._type === 'UMLCompositeStateView') {
          return { w: Math.max(120, nameW + 30), h: Math.max(80, 30 + extra + 50) };
        }
        return { w: Math.max(70, nameW + 30), h: Math.max(40, 26 + extra + 10) };
      }
      case 'UMLActionView': case 'UMLObjectNodeView':
        return { w: Math.max(70, nameW + 30), h: Math.max(34, 34) };
      case 'UMLInstanceView': {
        var lab = name + (m.classifier ? ' : ' + model.typeName(m.classifier) : '');
        return { w: Math.max(80, text.measureText(lab, font) + 24), h: 50 };
      }
      case 'UMLNoteView': {
        var txt = (m.documentation != null ? m.documentation : (v.text || ''));
        var wrapW = Math.max(v.width || 0, 80) - 16;
        var ls = text.wrapText(txt, font, v.wordWrap === false ? 0 : wrapW);
        var wmax = 60;
        ls.forEach(function (l) { wmax = Math.max(wmax, text.measureText(l, font)); });
        if (!v.wordWrap) ls.forEach(function (l) { wmax = Math.max(wmax, text.measureText(l, font)); });
        return { w: Math.max(60, wmax + 24), h: Math.max(40, ls.length * LINE_H + 16) };
      }
      case 'UMLSeqLifelineView': {
        var ln = name + (m.represent ? ' : ' + (typeof m.represent === 'string' ? m.represent : model.typeName(m.represent)) : '');
        return { w: Math.max(90, text.measureText(ln, font) + 20), h: 40 + (stereo ? STEREO_H : 0) };
      }
      case 'UMLStateMachineView': case 'UMLActivityView':
        return { w: Math.max(100, nameW + 30), h: 50 };
      case 'UMLCombinedFragmentView':
        return { w: Math.max(120, v.width || 120), h: Math.max(80, v.height || 80) };
      default: {
        var pn = v.model && v.model.kind ? '' : name;
        if (!pn && !v.width) return { w: 40, h: 40 };
        return { w: Math.max(v.width || 20, pn ? text.measureText(pn, font) + 16 : 20), h: v.height || 20 };
      }
    }
  }

  /** Resize view to fit content. growOnly: never shrink width (creation default). */
  function autoLayout(v, opts) {
    opts = opts || {};
    if (meta.isEdgeView(v._type) || v._type === 'UMLSeqMessageView') return;
    var need = neededSize(v);
    if (!need) return;
    if (opts.growOnly) {
      v.width = Math.max(v.width || 0, need.w);
      v.height = Math.max(v.height || 0, need.h);
    } else if (opts.fitHeight) {
      // width only grows (respect user sizing); height always fits content
      v.width = Math.max(v.width || 0, need.w);
      v.height = need.h;
    } else {
      v.width = Math.max(need.w, opts.minWidth || 0);
      v.height = Math.max(need.h, opts.minHeight || 0);
    }
  }

  /* ============================ containers ============================ */

  function assignContainers(diagram) {
    var views = (diagram.ownedViews || []).filter(function (v) { return !meta.isEdgeView(v._type) && v._type !== 'UMLSeqMessageView'; });
    views.forEach(function (v) { v.containerView = null; });
    views.slice().sort(function (a, b) { return area(b) - area(a); }).forEach(function (child) {
      if (!isContainerType(child._type) && !CONTAINERS[child._type]) { /* any node view can be contained */ }
      var best = null, bestArea = Infinity;
      views.forEach(function (cand) {
        if (cand === child || !isContainerType(cand._type)) return;
        if (containsChain(cand, child)) return;
        var cr = viewRect(cand), hr = viewRect(child);
        if (util.containsRect(cr, hr) && area(cand) < bestArea && area(cand) > area(child)) {
          best = cand; bestArea = area(cand);
        }
      });
      child.containerView = best;
    });
  }

  function containsChain(maybeAncestor, v) {
    var p = v.containerView;
    while (p) { if (p === maybeAncestor) return true; p = p.containerView; }
    return false;
  }

  function area(v) { return (v.width || 0) * (v.height || 0); }

  function childrenOf(diagram, view) {
    return (diagram.ownedViews || []).filter(function (v) { return v.containerView === view; });
  }

  /* ============================ z-order ============================ */

  function drawOrder(diagram) {
    var views = (diagram.ownedViews || []).slice();
    // stable topological: containers before contained
    var out = [], placed = new Set();
    // O(1) membership test instead of views.indexOf() inside the recursion
    // (the old version was O(n²) per call, and viewAt() calls this on every mousemove)
    var viewSet = new Set(views);
    function place(v) {
      if (placed.has(v)) return;
      if (v.containerView && viewSet.has(v.containerView)) place(v.containerView);
      placed.add(v);
      out.push(v);
    }
    views.forEach(place);
    return out;
  }

  /* ============================ anchors & routing ============================ */

  function anchorOf(v, fromPt) {
    var r = viewRect(v);
    var c = util.center(r);
    if (!isFinite(fromPt.x)) fromPt = { x: c.x + 1, y: c.y };
    var t = v._type;
    if (t === 'UMLUseCaseView' || t === 'UMLActorView') {
      return util.ellipseAnchor(r, fromPt);
    }
    if (t === 'UMLStateView' || t === 'UMLActionView' || t === 'UMLCompositeStateView') {
      return util.roundRectAnchor(r, fromPt, 12);
    }
    if (t === 'UMLPseudostateView' || t === 'UMLFinalStateView' || t === 'UMLInitialNodeView' ||
        t === 'UMLActivityFinalNodeView' || t === 'UMLFlowFinalNodeView' || t === 'UMLDecisionNodeView' ||
        t === 'UMLMergeNodeView') {
      return util.ellipseAnchor(r, fromPt);
    }
    if (t === 'UMLSeqLifelineView') {
      // attach to the vertical lifeline (x = center), y clamped to line extent
      return { x: r.x + r.width / 2, y: Math.max(fromPt.y, r.y + r.height) };
    }
    var hit = util.rectLineIntersection(r, c, fromPt);
    return hit || c;
  }

  function routedPoints(v) {
    if (v._type === 'UMLSeqMessageView') return seqPoints(v);
    var pts = (v.points || []).map(function (p) { return { x: p.x, y: p.y }; });
    if (pts.length < 2) pts = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
    var head = v.head, tail = v.tail;
    if (head && tail) {
      var bends = pts.slice(1, -1);
      var tailRef = bends.length ? bends[0] : util.center(viewRect(head));
      var headRef = bends.length ? bends[bends.length - 1] : util.center(viewRect(tail));
      var ta = anchorOf(tail, tailRef);
      var ha = anchorOf(head, headRef);
      if (v.lineStyle === 'ortho' && bends.length === 0) {
        bends = orthoBends(ta, ha);
      }
      return [ta].concat(bends, [ha]);
    }
    return pts;
  }

  function orthoBends(a, b) {
    var dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
    if (dx < 2 || dy < 2) return [];
    if (dx >= dy) {
      var mx = (a.x + b.x) / 2;
      return [{ x: mx, y: a.y }, { x: mx, y: b.y }];
    } else {
      var my = (a.y + b.y) / 2;
      return [{ x: a.x, y: my }, { x: b.x, y: my }];
    }
  }

  function seqPoints(v) {
    var pts = (v.points || []).map(function (p) { return { x: p.x, y: p.y }; });
    if (pts.length < 2) pts = [{ x: 0, y: 0 }, { x: 50, y: 0 }];
    var head = v.head, tail = v.tail;
    if (head && tail && head === tail) {
      var r = viewRect(head);
      var x = r.x + r.width / 2;
      var y = pts[0].y;
      return [{ x: x, y: y }, { x: x + 45, y: y }, { x: x + 45, y: y + 28 }, { x: x, y: y + 28 }];
    }
    if (head && tail) {
      var xr = viewRect(head), tr = viewRect(tail);
      var hx = xr.x + xr.width / 2, tx = tr.x + tr.width / 2;
      var y = pts[0].y;
      return [{ x: tx, y: y }, { x: hx, y: y }];
    }
    return pts;
  }

  /* ============================ arrowheads ============================ */

  function drawArrowhead(gfx, tip, angle, kind) {
    var s = 12, w = 6;
    var cos = Math.cos(angle), sin = Math.sin(angle);
    function rot(px, py) { return { x: tip.x + px * cos - py * sin, y: tip.y + px * sin + py * cos }; }
    if (kind === 'filled') {
      gfx.polygon([tip, rot(-s, -w / 1.2), rot(-s, w / 1.2)], { fill: true, stroke: false });
    } else if (kind === 'open') {
      gfx.polyline([rot(-s, -w), tip, rot(-s, w)], { fill: false });
    } else if (kind === 'triangle') { // hollow generalization
      gfx.setFill(C.fill);
      gfx.polygon([tip, rot(-s - 2, -w), rot(-s - 2, w)], { fill: true, stroke: true });
      gfx.setFill(null);
    } else if (kind === 'diamondFilled' || kind === 'diamondHollow') {
      var pts = [tip, rot(-s / 1.4, -w / 1.1), rot(-s * 1.5, 0), rot(-s / 1.4, w / 1.1)];
      if (kind === 'diamondHollow') {
        gfx.setFill(C.fill);
        gfx.polygon(pts, { fill: true, stroke: true });
        gfx.setFill(null);
      } else {
        gfx.setFill(C.line);
        gfx.polygon(pts, { fill: true, stroke: true });
        gfx.setFill(null);
      }
    } else if (kind === 'cross') {
      var p1 = rot(-4, -6), p2 = rot(-4, 6), p3 = rot(-16, -6), p4 = rot(-16, 6);
      gfx.line(p1.x, p1.y, p2.x, p2.y);
      gfx.line(p3.x, p3.y, p4.x, p4.y);
    }
  }

  function shorten(pts, headLen, tailLen) {
    // trim segment ends so arrowheads sit on boundaries
    var out = pts.map(function (p) { return { x: p.x, y: p.y }; });
    if (tailLen > 0 && out.length >= 2) {
      var a = out[0], b = out[1];
      var d = util.dist(a, b);
      if (d > tailLen * 2) {
        out[0] = { x: a.x + (b.x - a.x) * (tailLen / d), y: a.y + (b.y - a.y) * (tailLen / d) };
      }
    }
    if (headLen > 0 && out.length >= 2) {
      var c2 = out[out.length - 1], b2 = out[out.length - 2];
      var d2 = util.dist(b2, c2);
      if (d2 > headLen * 2) {
        out[out.length - 1] = { x: c2.x + (b2.x - c2.x) * (headLen / d2), y: c2.y + (b2.y - c2.y) * (headLen / d2) };
      }
    }
    return out;
  }

  /* ============================ edge labels ============================ */

  function edgeLabelRect(gfx, str, pt, align) {
    var w = gfx.measure(str);
    var h = 14;
    var x = align === 'center' ? pt.x - w / 2 : align === 'right' ? pt.x - w : pt.x;
    return { x: x, y: pt.y - h / 2, width: w, height: h };
  }

  function labelPointNear(pts, fromTail, distPx) {
    if (fromTail) {
      var a = pts[0], b = pts[1] || pts[0];
      var d = util.dist(a, b) || 1;
      var t = Math.min(distPx / d, 0.9);
      var p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      p.nx = -(b.y - a.y) / d; p.ny = (b.x - a.x) / d;
      return p;
    } else {
      var n = pts.length;
      var c = pts[n - 1], b3 = pts[n - 2] || pts[n - 1];
      var d3 = util.dist(b3, c) || 1;
      var t3 = Math.min(distPx / d3, 0.9);
      var p3 = { x: c.x + (b3.x - c.x) * t3, y: c.y + (b3.y - c.y) * t3 };
      p3.nx = -(b3.y - c.y) / d3; p3.ny = (b3.x - c.x) / d3;
      return p3;
    }
  }

  /* ============================ association end mapping ============================ */

  function assocEnds(v) {
    var m = v.model;
    var ends = (m && m.ownedEnds) || [];
    // StarUML invariant: ownedEnds[0] is the end on the *head* side of the
    // association view, ownedEnds[1] is on the *tail* side. Verify each end's
    // `reference` against both endpoint models so mislabelled role names /
    // multiplicities cannot occur even when only one end has a reference.
    var e0 = ends[0] || null, e1 = ends[1] || null;
    var headModel = v.head && v.head.model, tailModel = v.tail && v.tail.model;
    var headSide = e0;
    if (e0 && e1 && headModel && tailModel) {
      var e0IsHead = e0.reference === headModel;
      var e1IsHead = e1.reference === headModel;
      if (e0IsHead && !e1IsHead) headSide = e0;          // default order OK
      else if (!e0IsHead && e1IsHead) headSide = e1;     // swapped order
      // if neither/both match, keep the documented default (ends[0] = head)
    }
    var tailSide = (headSide === e0) ? e1 : e0;
    return { tail: tailSide, head: headSide };
  }

  /* ============================ draw functions ============================ */

  function setupStrokeFill(gfx, v) {
    gfx.setStroke(v.lineColor || C.line);
    gfx.setFill(v.fillColor || null);
    gfx.setLineWidth(1);
    gfx.setLineDash(null);
  }

  function drawLabelLines(gfx, v, x, y, w, stereo, name, ns, opts) {
    opts = opts || {};
    var font = v.font || text.DEFAULT_FONT;
    var cy = y;
    if (stereo) {
      gfx.text('«' + stereo + '»', x + w / 2, cy + 1, { align: 'center', font: font, fill: C.text });
      cy += STEREO_H;
    }
    var nf = opts.underline ? underline(font) : boldFont(font);
    gfx.text(name, x + w / 2, cy + 3, { align: 'center', font: nf, fill: C.text });
    if (ns) {
      gfx.text('(' + ns + ')', x + w / 2, cy + 3 + LINE_H, { align: 'center', font: font, fill: C.dimText });
    }
  }

  function underline(font) {
    var f = text.parseFont(font);
    return text.fontToMdj({ family: f.family, size: f.size, bold: f.bold, italic: f.italic, underline: true });
  }

  function drawClassifierBody(gfx, v) {
    var r = viewRect(v);
    var layout = computeLayout(v);
    var font = v.font || text.DEFAULT_FONT;
    setupStrokeFill(gfx, v);
    gfx.rect(r.x, r.y, r.width, r.height, { fill: v.fillColor ? true : false, stroke: true });
    // name compartment
    var nc = layout.nameCompartment;
    drawLabelLines(gfx, v, nc.rect.x, nc.rect.y + 1, nc.rect.width, nc.stereo, nc.text, nc.namespace,
      { italic: v._type === 'UMLInterfaceView' });
    var y = nc.rect.y + nc.rect.height;
    if (v._type !== 'UMLComponentView' && v._type !== 'UMLArtifactView' && v._type !== 'UMLNodeView') {
      gfx.line(r.x, y, r.x + r.width, y);
    }
    layout.compartments.forEach(function (comp, i) {
      if (i > 0 || comp.rect.y > y + 0.5) gfx.line(r.x, comp.rect.y, r.x + comp.rect.width, comp.rect.y);
      comp.lines.forEach(function (ln) {
        gfx.text(ln.text, comp.rect.x + PAD, ln.y - 1, { font: font, fill: C.text });
      });
    });
    // decorations
    if (v._type === 'UMLComponentView') drawComponentIcon(gfx, r.x, r.y + 8);
    if (v._type === 'UMLArtifactView') drawArtifactIcon(gfx, r.x + r.width - 18, r.y + 6);
    if (v._type === 'UMLSubsystemView') drawComponentIcon(gfx, r.x + 8, r.y + 8);
    if (v.model && v.model.isAbstract && (v._type === 'UMLClassView' || v._type === 'UMLInterfaceView')) {
      // abstract classes: italic name (UML convention)
      var nc2 = layout.nameCompartment;
      gfx.setFill(v.fillColor || C.fill);
      gfx.rect(nc2.rect.x + 1, nc2.rect.y + 1, nc2.rect.width - 2, nc2.rect.height - 2, { fill: true, stroke: false });
      gfx.setStroke(v.lineColor || C.line);
      drawLabelLines(gfx, v, nc2.rect.x, nc2.rect.y + 1, nc2.rect.width, nc2.stereo, nc2.text, nc2.namespace, { italic: true });
    }
  }

  function drawComponentIcon(gfx, x, y) {
    gfx.setFill(C.fill);
    gfx.rect(x - 4, y + 2, 16, 8, { fill: true, stroke: true });
    gfx.rect(x - 4, y + 14, 16, 8, { fill: true, stroke: true });
    gfx.setFill(null);
  }

  function drawArtifactIcon(gfx, x, y) {
    gfx.setFill(C.fill);
    gfx.polygon([
      { x: x, y: y }, { x: x + 8, y: y }, { x: x + 12, y: y + 4 }, { x: x + 12, y: y + 14 }, { x: x, y: y + 14 }
    ], { fill: true, stroke: true });
    gfx.polyline([{ x: x + 8, y: y }, { x: x + 8, y: y + 4 }, { x: x + 12, y: y + 4 }]);
    gfx.setFill(null);
  }

  function drawActor(gfx, v) {
    var r = viewRect(v);
    setupStrokeFill(gfx, v);
    var cx = r.x + r.width / 2;
    var headR = Math.min(9, r.height * 0.14);
    var top = r.y + 4;
    var headCY = top + headR;
    gfx.circle(cx, headCY, headR, { fill: false, stroke: true });
    var neck = headCY + headR;
    var hip = r.y + r.height - 32;
    var armY = neck + (hip - neck) * 0.3;
    gfx.line(cx, neck, cx, hip);                       // body
    gfx.line(cx - headR * 1.6, armY, cx + headR * 1.6, armY); // arms
    gfx.line(cx, hip, cx - headR * 1.4, r.y + r.height - 18); // left leg
    gfx.line(cx, hip, cx + headR * 1.4, r.y + r.height - 18); // right leg
    var font = v.font || text.DEFAULT_FONT;
    var stereo = stereoOf(v);
    var labelY = r.y + r.height - 15;
    if (stereo) {
      gfx.text('«' + stereo + '»', cx, labelY - 13, { align: 'center', font: font, fill: C.text });
    }
    gfx.text(v.model ? v.model.name || '' : '', cx, labelY, { align: 'center', font: font, fill: C.text });
  }

  function drawUseCase(gfx, v) {
    var r = viewRect(v);
    setupStrokeFill(gfx, v);
    gfx.ellipse(r.x + r.width / 2, r.y + r.height / 2, r.width / 2, r.height / 2,
      { fill: v.fillColor ? true : false, stroke: true });
    var font = v.font || text.DEFAULT_FONT;
    var stereo = stereoOf(v);
    var cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    var name = v.model ? v.model.name || '' : '';
    if (v.model && v.model.isAbstract) {
      gfx.text(name, cx, stereo ? cy - 2 : cy - 7, { align: 'center', font: underline ? italicFont(font) : font, fill: C.text, baseline: 'top' });
    } else {
      gfx.text(name, cx, stereo ? cy - 2 : cy - 7, { align: 'center', font: font, fill: C.text, baseline: 'top' });
    }
    if (stereo) gfx.text('«' + stereo + '»', cx, cy - 17, { align: 'center', font: font, fill: C.text });
  }

  function drawPackage(gfx, v) {
    var r = viewRect(v);
    setupStrokeFill(gfx, v);
    var font = v.font || text.DEFAULT_FONT;
    var name = v.model ? v.model.name || '' : '';
    var tabW = Math.max(50, gfx.measure(name) + 20);
    tabW = Math.min(tabW, r.width - 10);
    var tabH = 20;
    var stereo = stereoOf(v);
    if (stereo) tabH += STEREO_H;
    var pts = [
      { x: r.x, y: r.y + tabH }, { x: r.x, y: r.y }, { x: r.x + tabW, y: r.y },
      { x: r.x + tabW, y: r.y + tabH }, { x: r.x + r.width, y: r.y + tabH },
      { x: r.x + r.width, y: r.y + r.height }, { x: r.x, y: r.y + r.height }
    ];
    if (v.fillColor) { gfx.setFill(v.fillColor); gfx.polygon(pts, { fill: true, stroke: true }); gfx.setFill(null); }
    else gfx.polygon(pts, { fill: false, stroke: true });
    var ty = r.y + 2;
    if (stereo) {
      gfx.text('«' + stereo + '»', r.x + tabW / 2, ty, { align: 'center', font: font, fill: C.text });
      ty += STEREO_H;
    }
    gfx.text(name, r.x + tabW / 2, ty, { align: 'center', font: font, fill: C.text });
  }

  function drawNode3D(gfx, v) {
    var r = viewRect(v);
    setupStrokeFill(gfx, v);
    var d = Math.min(14, r.width * 0.15, r.height * 0.15);
    var front = [
      { x: r.x, y: r.y + d }, { x: r.x + r.width - d, y: r.y + d },
      { x: r.x + r.width - d, y: r.y + r.height }, { x: r.x, y: r.y + r.height }
    ];
    var top = [
      { x: r.x, y: r.y + d }, { x: r.x + d, y: r.y },
      { x: r.x + r.width, y: r.y }, { x: r.x + r.width - d, y: r.y + d }
    ];
    var side = [
      { x: r.x + r.width - d, y: r.y + d }, { x: r.x + r.width, y: r.y },
      { x: r.x + r.width, y: r.y + r.height - d }, { x: r.x + r.width - d, y: r.y + r.height }
    ];
    var fillIt = v.fillColor ? true : false;
    if (fillIt) gfx.setFill(v.fillColor);
    gfx.polygon(front, { fill: fillIt, stroke: true });
    gfx.polygon(top, { fill: fillIt, stroke: true });
    gfx.polygon(side, { fill: fillIt, stroke: true });
    gfx.setFill(null);
    var font = v.font || text.DEFAULT_FONT;
    var stereo = stereoOf(v);
    var name = v.model ? v.model.name || '' : '';
    var tx = r.x + 8, ty = r.y + d + 5;
    if (stereo) { gfx.text('«' + stereo + '»', tx, ty, { font: font, fill: C.text }); ty += STEREO_H; }
    gfx.text(name, tx, ty, { font: font, fill: C.text });
  }

  function drawInstance(gfx, v) {
    var r = viewRect(v);
    setupStrokeFill(gfx, v);
    gfx.rect(r.x, r.y, r.width, r.height, { fill: v.fillColor ? true : false, stroke: true });
    var font = v.font || text.DEFAULT_FONT;
    var m = v.model || {};
    var label = (m.name || '') + (m.classifier ? ' : ' + model.typeName(m.classifier) : '');
    var stereo = stereoOf(v);
    var cx = r.x + r.width / 2;
    var y = r.y + (r.height - (stereo ? 30 : 16)) / 2;
    if (stereo) { gfx.text('«' + stereo + '»', cx, y, { align: 'center', font: font, fill: C.text }); y += STEREO_H; }
    gfx.text(label, cx, y, { align: 'center', font: underline(font), fill: C.text });
  }

  function drawSimpleBox(gfx, v, opts) {
    opts = opts || {};
    var r = viewRect(v);
    setupStrokeFill(gfx, v);
    if (opts.rounded) gfx.roundRect(r.x, r.y, r.width, r.height, opts.radius || 12, { fill: v.fillColor ? true : false, stroke: true });
    else gfx.rect(r.x, r.y, r.width, r.height, { fill: v.fillColor ? true : false, stroke: true });
    var font = v.font || text.DEFAULT_FONT;
    var stereo = stereoOf(v);
    var name = v.model ? v.model.name || '' : '';
    var m = v.model || {};
    var cx = r.x + r.width / 2;
    var lines = [];
    if (stereo) lines.push('«' + stereo + '»');
    lines.push(name);
    if (m.entryActivity) lines.push('entry / ' + m.entryActivity);
    if (m.doActivity) lines.push('do / ' + m.doActivity);
    if (m.exitActivity) lines.push('exit / ' + m.exitActivity);
    var totalH = lines.length * LINE_H;
    var y = r.y + (r.height - totalH) / 2;
    lines.forEach(function (ln, i) {
      var f = (i === (stereo ? 1 : 0) && !opts.plainName) ? font : font;
      gfx.text(ln, cx, y, { align: 'center', font: f, fill: i === 0 && stereo ? C.text : C.text });
      y += LINE_H;
    });
    if (opts.titleBar) {
      gfx.line(r.x, r.y + 24, r.x + r.width, r.y + 24);
    }
  }

  function drawCompositeState(gfx, v, diagram) {
    var r = viewRect(v);
    setupStrokeFill(gfx, v);
    gfx.roundRect(r.x, r.y, r.width, r.height, 14, { fill: v.fillColor ? true : false, stroke: true });
    var font = v.font || text.DEFAULT_FONT;
    var stereo = stereoOf(v);
    var name = v.model ? v.model.name || '' : '';
    var titleH = 24 + (stereo ? STEREO_H : 0);
    var cx = r.x + r.width / 2;
    var ty = r.y + 4;
    if (stereo) { gfx.text('«' + stereo + '»', cx, ty, { align: 'center', font: font, fill: C.text }); ty += STEREO_H; }
    gfx.text(name, cx, ty, { align: 'center', font: font, fill: C.text });
    gfx.line(r.x, r.y + titleH, r.x + r.width, r.y + titleH);
  }

  function drawPseudostate(gfx, v) {
    var r = viewRect(v);
    setupStrokeFill(gfx, v);
    var m = v.model || {};
    var kind = m.kind || 'initial';
    var cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    var rx = r.width / 2, ry = r.height / 2;
    gfx.setFill(C.line);
    switch (kind) {
      case 'initial':
        gfx.circle(cx, cy, Math.min(rx, ry), { fill: true, stroke: false });
        break;
      case 'junction':
        gfx.circle(cx, cy, Math.min(rx, ry), { fill: true, stroke: false });
        break;
      case 'choice':
        gfx.setFill(null);
        gfx.polygon([{ x: cx, y: r.y }, { x: r.x + r.width, y: cy }, { x: cx, y: r.y + r.height }, { x: r.x, y: cy }],
          { fill: false, stroke: true });
        break;
      case 'fork': case 'join':
        gfx.rect(r.x, r.y, Math.max(r.width, 4), Math.max(r.height, 4), { fill: true, stroke: false });
        break;
      case 'shallowHistory': case 'deepHistory':
        gfx.setFill(null);
        gfx.circle(cx, cy, Math.min(rx, ry), { fill: false, stroke: true });
        var font = v.font || text.DEFAULT_FONT;
        gfx.text(kind === 'deepHistory' ? 'H*' : 'H', cx, cy, { align: 'center', baseline: 'middle', font: font, fill: C.text });
        break;
      case 'entryPoint':
        gfx.setFill(null);
        gfx.circle(cx, cy, Math.min(rx, ry), { fill: false, stroke: true });
        break;
      case 'exitPoint':
        gfx.setFill(null);
        gfx.circle(cx, cy, Math.min(rx, ry), { fill: false, stroke: true });
        gfx.setFill(C.line);
        gfx.circle(cx, cy, Math.min(rx, ry) * 0.45, { fill: true, stroke: false });
        break;
      case 'terminate':
        gfx.setFill(null);
        gfx.circle(cx, cy, Math.min(rx, ry), { fill: false, stroke: true });
        var rr = Math.min(rx, ry) * 0.7;
        gfx.line(cx - rr, cy - rr, cx + rr, cy + rr);
        gfx.line(cx - rr, cy + rr, cx + rr, cy - rr);
        break;
      default:
        gfx.setFill(null);
        gfx.circle(cx, cy, Math.min(rx, ry), { fill: false, stroke: true });
    }
    gfx.setFill(null);
    // optional name label to the right/below
    if (m.name && kind !== 'initial' && kind !== 'junction') {
      var f = v.font || text.DEFAULT_FONT;
      gfx.text(m.name, r.x + r.width + 4, cy, { baseline: 'middle', font: f, fill: C.text });
    }
  }

  function drawFinalState(gfx, v) {
    var r = viewRect(v);
    setupStrokeFill(gfx, v);
    var cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    var rr = Math.min(r.width, r.height) / 2;
    gfx.circle(cx, cy, rr, { fill: false, stroke: true });
    gfx.setFill(C.line);
    gfx.circle(cx, cy, rr * 0.55, { fill: true, stroke: false });
    gfx.setFill(null);
  }

  function drawFlowFinal(gfx, v) {
    var r = viewRect(v);
    setupStrokeFill(gfx, v);
    var cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    var rr = Math.min(r.width, r.height) / 2;
    gfx.circle(cx, cy, rr, { fill: false, stroke: true });
    var k = rr * 0.7;
    gfx.line(cx - k, cy - k, cx + k, cy + k);
    gfx.line(cx - k, cy + k, cx + k, cy - k);
  }

  function drawDiamondNode(gfx, v) {
    var r = viewRect(v);
    setupStrokeFill(gfx, v);
    var cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    gfx.setFill(v.fillColor || C.fill);
    gfx.polygon([{ x: cx, y: r.y }, { x: r.x + r.width, y: cy }, { x: cx, y: r.y + r.height }, { x: r.x, y: cy }],
      { fill: true, stroke: true });
    gfx.setFill(null);
    if (v.model && v.model.name) {
      var f = v.font || text.DEFAULT_FONT;
      gfx.text(v.model.name, r.x + r.width + 4, cy, { baseline: 'middle', font: f, fill: C.text });
    }
  }

  function drawBarNode(gfx, v) {
    var r = viewRect(v);
    setupStrokeFill(gfx, v);
    gfx.setFill(C.line);
    if (r.width >= r.height) gfx.rect(r.x, r.y + r.height / 2 - 3, r.width, 6, { fill: true, stroke: false });
    else gfx.rect(r.x + r.width / 2 - 3, r.y, 6, r.height, { fill: true, stroke: false });
    gfx.setFill(null);
  }

  function drawSmallCircle(gfx, v, filled) {
    var r = viewRect(v);
    setupStrokeFill(gfx, v);
    var cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    var rr = Math.min(r.width, r.height) / 2;
    if (filled) { gfx.setFill(C.line); gfx.circle(cx, cy, rr, { fill: true, stroke: false }); gfx.setFill(null); }
    else gfx.circle(cx, cy, rr, { fill: false, stroke: true });
  }

  function drawNote(gfx, v) {
    var r = viewRect(v);
    setupStrokeFill(gfx, v);
    var fold = 12;
    var pts = [
      { x: r.x, y: r.y }, { x: r.x + r.width - fold, y: r.y },
      { x: r.x + r.width, y: r.y + fold }, { x: r.x + r.width, y: r.y + r.height },
      { x: r.x, y: r.y + r.height }
    ];
    gfx.setFill(v.fillColor || '#ffffe0');
    gfx.polygon(pts, { fill: true, stroke: true });
    gfx.polyline([{ x: r.x + r.width - fold, y: r.y }, { x: r.x + r.width - fold, y: r.y + fold }, { x: r.x + r.width, y: r.y + fold }]);
    gfx.setFill(null);
    var font = v.font || text.DEFAULT_FONT;
    var txt = (v.model && v.model.documentation != null && v.model.documentation !== '') ? v.model.documentation : (v.text || '');
    var lines = text.wrapText(txt, font, r.width - 16);
    var y = r.y + 6;
    lines.forEach(function (ln) {
      if (y + LINE_H > r.y + r.height + 2) return;
      gfx.text(ln, r.x + 8, y, { font: font, fill: C.text });
      y += LINE_H;
    });
  }

  /* ---- lifelines & messages ---- */

  function lifelineBottom(diagram, v) {
    var maxY = (v.top || 0) + (v.height || 0) + 100;
    // horizontal extent of this lifeline's centre line (for overlap checks)
    var lx = (v.left || 0) + (v.width || 0) / 2;
    var lHalf = Math.max((v.width || 0) / 2, 40);
    (diagram.ownedViews || []).forEach(function (o) {
      if (o._type === 'UMLSeqMessageView' && (o.head === v || o.tail === v)) {
        var ys = (o.points || []).map(function (p) { return p.y; });
        maxY = Math.max(maxY, Math.max.apply(null, ys.concat([0])) + 60);
      }
      if (o._type === 'UMLCombinedFragmentView') {
        // only extend past fragments that actually span this lifeline's X
        var fx = o.left || 0, fw = o.width || 0;
        if (fx - lHalf <= lx && lx <= fx + fw + lHalf) {
          maxY = Math.max(maxY, (o.top || 0) + (o.height || 0) + 40);
        }
      }
    });
    return maxY;
  }

  function drawLifeline(gfx, v, ctx) {
    var r = viewRect(v);
    setupStrokeFill(gfx, v);
    var font = v.font || text.DEFAULT_FONT;
    var m = v.model || {};
    var stereo = stereoOf(v);
    var rep = m.represent ? (typeof m.represent === 'string' ? m.represent : model.typeName(m.represent)) : '';
    var label = (m.name || '') + (rep ? ' : ' + rep : '');
    var headH = 26 + (stereo ? STEREO_H : 0);
    gfx.setFill(v.fillColor || C.fill);
    gfx.rect(r.x, r.y, r.width, headH, { fill: true, stroke: true });
    gfx.setFill(null);
    var cx = r.x + r.width / 2;
    var y = r.y + 3;
    if (stereo) { gfx.text('«' + stereo + '»', cx, y, { align: 'center', font: font, fill: C.text }); y += STEREO_H; }
    gfx.text(label, cx, y + 2, { align: 'center', font: underline(font), fill: C.text });
    // dashed lifeline
    var bottom = ctx && ctx.diagram ? lifelineBottom(ctx.diagram, v) : r.y + headH + (v._lineHeight || 300);
    v._lineHeight = bottom - (r.y + headH);
    gfx.setLineDash([4, 4]);
    gfx.line(cx, r.y + headH, cx, bottom);
    gfx.setLineDash(null);
    // destruction X
    if (ctx && ctx.diagram) {
      (ctx.diagram.ownedViews || []).forEach(function (o) {
        if (o._type === 'UMLSeqMessageView' && o.head === v && o.model && o.model.messageSort === 'deleteMessage') {
          var pts = routedPoints(o);
          var tip = pts[pts.length - 1];
          gfx.setLineWidth(2);
          gfx.line(tip.x - 7, tip.y - 7, tip.x + 7, tip.y + 7);
          gfx.line(tip.x - 7, tip.y + 7, tip.x + 7, tip.y - 7);
          gfx.setLineWidth(1);
        }
      });
    }
  }

  function drawMessage(gfx, v, ctx) {
    var m = v.model || {};
    var sort = m.messageSort || 'synchCall';
    var pts = routedPoints(v);
    setupStrokeFill(gfx, v);
    var dashed = sort === 'replyMessage' || sort === 'createMessage';
    if (dashed) gfx.setLineDash([6, 4]);
    gfx.polyline(pts);
    gfx.setLineDash(null);
    var tip = pts[pts.length - 1];
    var prev = pts[pts.length - 2] || pts[0];
    var angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
    if (sort === 'synchCall' || sort === 'deleteMessage' || sort === 'createMessage') drawArrowhead(gfx, tip, angle, sort === 'createMessage' ? 'open' : 'filled');
    else drawArrowhead(gfx, tip, angle, 'open');
    // activation bar at target
    if (sort === 'synchCall' || sort === 'asynchCall' || sort === 'createMessage') {
      var tx = tip.x, ty = tip.y;
      gfx.setFill(v.fillColor || C.fill);
      if (v.head === v.tail) {
        gfx.rect(tx - 1, ty - 2, 8, 30, { fill: true, stroke: true });
      } else {
        gfx.rect(tx - 4, ty - 2, 8, 26, { fill: true, stroke: true });
      }
      gfx.setFill(null);
      // sender activation stub
      var s = pts[0];
      gfx.setFill(v.fillColor || C.fill);
      gfx.rect(s.x - 4, s.y - 2, 8, 12, { fill: true, stroke: true });
      gfx.setFill(null);
    }
    // label
    var font = v.font || text.DEFAULT_FONT;
    var label = model.formatMessage(m);
    var stereo = model.stereotypeText(m);
    var mid = pts.length > 2 ? pts[1] : { x: (pts[0].x + pts[pts.length - 1].x) / 2, y: pts[0].y };
    if (v.head === v.tail) {
      gfx.text(label, pts[1].x + 6, pts[1].y - 4, { font: font, fill: C.text });
      if (stereo) gfx.text('«' + stereo + '»', pts[1].x + 6, pts[1].y - 18, { font: font, fill: C.text });
    } else {
      var lx = (pts[0].x + pts[pts.length - 1].x) / 2;
      var ly = pts[0].y - 5;
      if (label) gfx.text(label, lx, ly, { align: 'center', baseline: 'bottom', font: font, fill: C.text });
      if (stereo) gfx.text('«' + stereo + '»', lx, ly - 15, { align: 'center', baseline: 'bottom', font: font, fill: C.text });
    }
  }

  function drawFragment(gfx, v) {
    var r = viewRect(v);
    setupStrokeFill(gfx, v);
    var m = v.model || {};
    gfx.setFill(v.fillColor || null);
    gfx.rect(r.x, r.y, r.width, r.height, { fill: v.fillColor ? true : false, stroke: true });
    gfx.setFill(null);
    var font = v.font || text.DEFAULT_FONT;
    var op = m.operator || 'seq';
    var tabW = Math.max(46, gfx.measure(op) + 18), tabH = 20;
    gfx.polygon([
      { x: r.x, y: r.y }, { x: r.x + tabW, y: r.y },
      { x: r.x + tabW, y: r.y + tabH - 6 }, { x: r.x + tabW - 6, y: r.y + tabH }, { x: r.x, y: r.y + tabH }
    ], { fill: true, stroke: true });
    gfx.text(op, r.x + tabW / 2, r.y + 3, { align: 'center', font: font, fill: C.text });
    // operands
    var operands = (m.ownedElements || []).filter(function (o) { return o._type === 'UMLInteractionOperand'; });
    var n = Math.max(operands.length, 1);
    var bodyTop = r.y + tabH;
    var bodyH = r.y + r.height - bodyTop;
    gfx.setLineDash([5, 3]);
    for (var i = 1; i < n; i++) {
      var yy = bodyTop + (bodyH / n) * i;
      gfx.line(r.x, yy, r.x + r.width, yy);
    }
    gfx.setLineDash(null);
    operands.forEach(function (opd, i) {
      var yy = bodyTop + (bodyH / n) * i;
      var g = opd.guard || opd.name;
      if (g) gfx.text('[' + g + ']', r.x + 6, yy + 3, { font: font, fill: C.text });
    });
  }

  /* ---- edges ---- */

  function drawEdgeBase(gfx, v, opts) {
    opts = opts || {};
    var pts = routedPoints(v);
    if (pts.length < 2) return pts;
    var headTrim = opts.headKind ? 11 : 0;
    var tailTrim = (opts.tailKind && opts.tailKind.indexOf('diamond') === 0) ? 16 : 0;
    var drawPts = shorten(pts, headTrim, tailTrim);
    setupStrokeFill(gfx, v);
    if (opts.dash) gfx.setLineDash(opts.dash);
    gfx.polyline(drawPts);
    gfx.setLineDash(null);
    var tip = pts[pts.length - 1];
    var prev = pts[pts.length - 2] || pts[0];
    var angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
    if (opts.headKind) drawArrowhead(gfx, tip, angle, opts.headKind);
    if (opts.tailKind) {
      var start = pts[0];
      var next = pts[1] || pts[pts.length - 1];
      var tAngle = Math.atan2(next.y - start.y, next.x - start.x) + Math.PI;
      drawArrowhead(gfx, start, tAngle, opts.tailKind);
    }
    return pts;
  }

  function drawEdgeLabel(gfx, v, str, pt, align, yOffset, font) {
    if (!str) return;
    gfx.text(str, pt.x, (pt.y || 0) + (yOffset || 0), { align: align || 'center', baseline: 'middle', font: font || v.font || text.DEFAULT_FONT, fill: C.text });
  }

  function drawAssociation(gfx, v) {
    var ends = assocEnds(v);
    var tailAggr = ends.tail ? ends.tail.aggregation : 'none';
    var headAggr = ends.head ? ends.head.aggregation : 'none';
    var tailKind = tailAggr === 'composite' ? 'diamondFilled' : tailAggr === 'shared' ? 'diamondHollow' : null;
    var headKind = headAggr === 'composite' ? 'diamondFilled' : headAggr === 'shared' ? 'diamondHollow' : null;
    // navigability arrows: draw arrow at an end when the OTHER end is non-navigable
    var tailNav = ends.tail ? ends.tail.navigable !== false : true;
    var headNav = ends.head ? ends.head.navigable !== false : true;
    var headArrow = !tailNav && headNav ? 'open' : null;
    var tailArrow = !headNav && tailNav ? 'open' : null;
    var pts = routedPoints(v);
    setupStrokeFill(gfx, v);
    var drawPts = shorten(pts, (headArrow || headKind) ? 11 : 0, (tailKind ? 16 : tailArrow ? 11 : 0));
    gfx.polyline(drawPts);
    var tip = pts[pts.length - 1], prev = pts[pts.length - 2] || pts[0];
    if (headArrow) drawArrowhead(gfx, tip, Math.atan2(tip.y - prev.y, tip.x - prev.x), headArrow);
    if (headKind) drawArrowhead(gfx, tip, Math.atan2(tip.y - prev.y, tip.x - prev.x), headKind);
    var start = pts[0], next = pts[1] || tip;
    if (tailArrow) drawArrowhead(gfx, start, Math.atan2(next.y - start.y, next.x - start.x) + Math.PI, tailArrow);
    if (tailKind) drawArrowhead(gfx, start, Math.atan2(next.y - start.y, next.x - start.x) + Math.PI, tailKind);
    // labels
    var font = v.font || text.DEFAULT_FONT;
    var m = v.model || {};
    var mid = util.pointOnPolyline(pts, 0.5);
    var stereo = model.stereotypeText(m);
    if (m.name) drawEdgeLabel(gfx, v, m.name, mid, 'center', -8, font);
    if (stereo) drawEdgeLabel(gfx, v, '«' + stereo + '»', mid, 'center', m.name ? -22 : -8, font);
    if (v.showProperty !== false) {
      [
        { end: ends.tail, fromTail: true }, { end: ends.head, fromTail: false }
      ].forEach(function (side) {
        if (!side.end) return;
        var role = side.end.name || '';
        var mult = side.end.multiplicity && side.end.multiplicity !== '' ? side.end.multiplicity : '';
        if (side.end.visibility && side.end.visibility !== 'public' && v.showVisibility !== false) {
          role = model.visibilityMark(side.end.visibility) + role;
        }
        var p = labelPointNear(pts, side.fromTail, 34);
        var offX = p.nx * 10, offY = p.ny * 10;
        if (role) drawEdgeLabel(gfx, v, role, { x: p.x + offX, y: p.y + offY - 7 }, 'center', 0, font);
        if (mult) drawEdgeLabel(gfx, v, mult, { x: p.x + offX, y: p.y + offY + 7 }, 'center', 0, font);
      });
    }
  }

  function drawGenericEdge(gfx, v, opts) {
    var pts = drawEdgeBase(gfx, v, opts);
    var m = v.model || {};
    var font = v.font || text.DEFAULT_FONT;
    var mid = util.pointOnPolyline(pts, 0.5);
    var stereo = model.stereotypeText(m);
    var label = opts.labelFn ? opts.labelFn(m) : (m.name || '');
    if (opts.forcedStereotype && !stereo) stereo = opts.forcedStereotype;
    if (label) drawEdgeLabel(gfx, v, label, mid, 'center', -8, font);
    if (stereo) drawEdgeLabel(gfx, v, '«' + stereo + '»', mid, 'center', label ? -22 : -8, font);
  }

  /* ---- placeholder for unknown view types ---- */

  function drawPlaceholder(gfx, v) {
    var r = viewRect(v);
    gfx.setStroke('#888888');
    gfx.setLineDash([4, 3]);
    gfx.setFill('#f0f0f0');
    gfx.rect(r.x, r.y, Math.max(r.width, 40), Math.max(r.height, 24), { fill: true, stroke: true });
    gfx.setLineDash(null);
    gfx.setFill(null);
    var font = v.font || text.DEFAULT_FONT;
    var label = (v.model && v.model.name) || v._type;
    gfx.text(label, r.x + 6, r.y + 5, { font: font, fill: '#555555' });
  }

  /* ============================ master draw ============================ */

  function draw(gfx, v, ctx) {
    ctx = ctx || {};
    var t = v._type;
    switch (t) {
      case 'UMLClassView': case 'UMLInterfaceView': case 'UMLEnumerationView':
      case 'UMLDataTypeView': case 'UMLComponentView': case 'UMLArtifactView':
      case 'UMLSubsystemView':
        drawClassifierBody(gfx, v); break;
      case 'UMLNodeView': drawNode3D(gfx, v); break;
      case 'UMLActorView': drawActor(gfx, v); break;
      case 'UMLUseCaseView': drawUseCase(gfx, v); break;
      case 'UMLPackageView': case 'UMLModelView': drawPackage(gfx, v); break;
      case 'UMLInstanceView': drawInstance(gfx, v); break;
      case 'UMLStateMachineView': case 'UMLActivityView':
        drawSimpleBox(gfx, v, {}); break;
      case 'UMLStateView':
        if (v.model && (v.model.ownedElements || []).length) drawCompositeState(gfx, v, ctx.diagram);
        else drawSimpleBox(gfx, v, { rounded: true, radius: 14 });
        break;
      case 'UMLCompositeStateView': drawCompositeState(gfx, v, ctx.diagram); break;
      case 'UMLPseudostateView': drawPseudostate(gfx, v); break;
      case 'UMLFinalStateView': drawFinalState(gfx, v); break;
      case 'UMLActionView': drawSimpleBox(gfx, v, { rounded: true, radius: 12 }); break;
      case 'UMLObjectNodeView': drawSimpleBox(gfx, v, {}); break;
      case 'UMLInitialNodeView': drawSmallCircle(gfx, v, true); break;
      case 'UMLActivityFinalNodeView': drawFinalState(gfx, v); break;
      case 'UMLFlowFinalNodeView': drawFlowFinal(gfx, v); break;
      case 'UMLDecisionNodeView': case 'UMLMergeNodeView': drawDiamondNode(gfx, v); break;
      case 'UMLForkNodeView': case 'UMLJoinNodeView': drawBarNode(gfx, v); break;
      case 'UMLNoteView': drawNote(gfx, v); break;
      case 'UMLSeqLifelineView': drawLifeline(gfx, v, ctx); break;
      case 'UMLSeqMessageView': drawMessage(gfx, v, ctx); break;
      case 'UMLCombinedFragmentView': drawFragment(gfx, v); break;
      case 'UMLAssociationView': drawAssociation(gfx, v); break;
      case 'UMLGeneralizationView':
        drawGenericEdge(gfx, v, { headKind: 'triangle' }); break;
      case 'UMLRealizationView': case 'UMLInterfaceRealizationView':
        drawGenericEdge(gfx, v, { headKind: 'triangle', dash: [6, 4] }); break;
      case 'UMLDependencyView':
        drawGenericEdge(gfx, v, { headKind: 'open', dash: [6, 4] }); break;
      case 'UMLIncludeView':
        drawGenericEdge(gfx, v, { headKind: 'open', dash: [6, 4], forcedStereotype: 'include' }); break;
      case 'UMLExtendView':
        drawGenericEdge(gfx, v, { headKind: 'open', dash: [6, 4], forcedStereotype: 'extend' }); break;
      case 'UMLTransitionView':
        drawGenericEdge(gfx, v, { headKind: 'open', labelFn: model.formatTransition }); break;
      case 'UMLControlFlowView': case 'UMLObjectFlowView':
        drawGenericEdge(gfx, v, { headKind: 'open', labelFn: model.formatControlFlow }); break;
      case 'UMLConnectorView': case 'UMLCommunicationPathView': case 'UMLNoteLinkView':
        drawGenericEdge(gfx, v, {}); break;
      case 'UMLConstraintView':
        drawNote(gfx, v); break;
      default:
        if (meta.isEdgeView(t)) drawGenericEdge(gfx, v, { headKind: 'open' });
        else if (v.model) drawPlaceholder(gfx, v);
        else drawPlaceholder(gfx, v);
    }
  }

  /* ============================ hit testing ============================ */

  function hit(v, pt) {
    if (v._type === 'UMLSeqMessageView' || meta.isEdgeView(v._type)) {
      var pts = routedPoints(v);
      for (var i = 1; i < pts.length; i++) {
        if (util.distToSegment(pt, pts[i - 1], pts[i]) < 6) return true;
      }
      return false;
    }
    if (v._type === 'UMLSeqLifelineView') {
      var r = viewRect(v);
      if (util.containsPoint({ x: r.x, y: r.y, width: r.width, height: r.height }, pt)) return true;
      var cx = r.x + r.width / 2;
      return Math.abs(pt.x - cx) < 5 && pt.y >= r.y + r.height;
    }
    return util.containsPoint(viewRect(v), pt);
  }

  /* ============================ bounds ============================ */

  function diagramBounds(diagram, pad) {
    pad = pad === undefined ? 20 : pad;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var any = false;
    (diagram.ownedViews || []).forEach(function (v) {
      if (v.visible === false) return;
      any = true;
      if (meta.isEdgeView(v._type)) {
        routedPoints(v).forEach(function (p) {
          minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        });
      } else if (v._type === 'UMLSeqLifelineView') {
        var r = viewRect(v);
        minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x + r.width);
        minY = Math.min(minY, r.y);
        maxY = Math.max(maxY, lifelineBottom(diagram, v));
      } else if (v._type === 'UMLSeqMessageView') {
        routedPoints(v).forEach(function (p) {
          minX = Math.min(minX, p.x); minY = Math.min(minY, p.y - 24);
          maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y + 40);
        });
      } else {
        var r2 = viewRect(v);
        minX = Math.min(minX, r2.x); minY = Math.min(minY, r2.y);
        maxX = Math.max(maxX, r2.x + r2.width); maxY = Math.max(maxY, r2.y + r2.height);
      }
    });
    if (!any) return { x: 0, y: 0, width: 800, height: 600 };
    return {
      x: minX - pad, y: minY - pad,
      width: (maxX - minX) + pad * 2, height: (maxY - minY) + pad * 2
    };
  }

  function prepareDiagram(diagram) {
    // refresh computed caches (lifeline lengths etc.) before serialize/export
    (diagram.ownedViews || []).forEach(function (v) {
      if (v._type === 'UMLSeqLifelineView') {
        v._lineHeight = lifelineBottom(diagram, v) - (v.top + 26);
      }
    });
  }

  OS.views = {
    COLORS: C,
    PAD: PAD, NAME_H: NAME_H, STEREO_H: STEREO_H, LINE_H: LINE_H,
    viewRect: viewRect,
    computeLayout: computeLayout,
    neededSize: neededSize,
    autoLayout: autoLayout,
    memberLines: memberLines,
    assignContainers: assignContainers,
    childrenOf: childrenOf,
    isContainerType: isContainerType,
    drawOrder: drawOrder,
    anchorOf: anchorOf,
    routedPoints: routedPoints,
    lifelineBottom: lifelineBottom,
    draw: draw,
    hit: hit,
    diagramBounds: diagramBounds,
    prepareDiagram: prepareDiagram,
    stereoOf: stereoOf,
    assocEnds: assocEnds,
    shorten: shorten
  };
})(typeof window !== 'undefined' ? window : globalThis);
