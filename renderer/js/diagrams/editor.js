/*
 * OpenStar UML — interactive diagram editor (canvas engine).
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};
  var util = OS.util, meta = OS.meta, model = OS.model, text = OS.text, views = OS.views;

  var HANDLE = 7;          // selection handle size (screen px)
  var MIN_W = 16, MIN_H = 16;

  var CLASSIFIERS = ['UMLClass', 'UMLInterface', 'UMLEnumeration', 'UMLDataType', 'UMLComponent',
    'UMLNode', 'UMLArtifact', 'UMLActor', 'UMLUseCase', 'UMLSubsystem', 'UMLInstance'];
  var STATE_NODES = ['UMLState', 'UMLCompositeState', 'UMLPseudostate', 'UMLFinalState', 'UMLStateMachine'];
  var ACTIVITY_NODES = ['UMLAction', 'UMLObjectNode', 'UMLInitialNode', 'UMLActivityFinalNode',
    'UMLFlowFinalNode', 'UMLDecisionNode', 'UMLMergeNode', 'UMLForkNode', 'UMLJoinNode', 'UMLActivity'];

  var EDGE_RULES = {
    'UMLAssociation': { targets: CLASSIFIERS, both: true },
    'UMLGeneralization': { targets: CLASSIFIERS.concat(STATE_NODES), both: true },
    'UMLRealization': { targets: CLASSIFIERS, both: true },
    'UMLInterfaceRealization': { targets: CLASSIFIERS, both: true },
    'UMLDependency': { targets: null },
    'UMLInclude': { targets: ['UMLUseCase'], both: true },
    'UMLExtend': { targets: ['UMLUseCase'], both: true },
    'UMLConnector': { targets: ['UMLComponent', 'UMLArtifact', 'UMLInterface'], both: true },
    'UMLCommunicationPath': { targets: ['UMLNode', 'UMLComponent', 'UMLInstance'], both: true },
    'UMLNoteLink': { targets: null },
    'UMLTransition': { targets: STATE_NODES, both: true },
    'UMLControlFlow': { targets: ACTIVITY_NODES, both: true },
    'UMLObjectFlow': { targets: ACTIVITY_NODES, both: true },
    'UMLMessage': { targets: ['UMLLifeline'], both: true }
  };

  function Editor(container, opts) {
    OS.Emitter.call(this);
    this.opts = opts || {};
    this.project = opts.project;
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'diagram-canvas';
    this.canvas.tabIndex = 0;
    container.appendChild(this.canvas);
    this.ctx2d = this.canvas.getContext('2d');
    this.gfx = new OS.gfx.CanvasGfx(this.ctx2d);

    this.diagram = null;
    this.diagramId = null;
    this.selection = [];          // array of views
    this.selectionIds = [];
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.viewports = new Map();   // diagramId -> {zoom, pan}
    this.showGrid = true;
    this.snapToGrid = false;
    this.gridSize = 8;

    this.tool = null;             // active toolbox tool
    this.hover = null;
    this._drag = null;            // active gesture state
    this._spaceDown = false;
    this._editInput = null;

    this._bindEvents();
    this._resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      var self = this;
      this._resizeObserver = new ResizeObserver(function () { self.resize(); });
      this._resizeObserver.observe(container);
    }
  }
  Editor.prototype = Object.create(OS.Emitter.prototype);
  Editor.prototype.constructor = Editor;

  /* ============================ viewport ============================ */

  Editor.prototype.resize = function () {
    var dpr = global.devicePixelRatio || 1;
    var w = this.container.clientWidth, h = this.container.clientHeight;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.dpr = dpr;
    this.render();
  };

  Editor.prototype.screenToWorld = function (sx, sy) {
    return { x: (sx - this.pan.x) / this.zoom, y: (sy - this.pan.y) / this.zoom };
  };
  Editor.prototype.worldToScreen = function (wx, wy) {
    return { x: wx * this.zoom + this.pan.x, y: wy * this.zoom + this.pan.y };
  };

  Editor.prototype.setZoom = function (z, focusScreen) {
    z = Math.max(0.1, Math.min(4, z));
    if (focusScreen) {
      var w = this.screenToWorld(focusScreen.x, focusScreen.y);
      this.zoom = z;
      this.pan.x = focusScreen.x - w.x * z;
      this.pan.y = focusScreen.y - w.y * z;
    } else {
      var c = { x: this.container.clientWidth / 2, y: this.container.clientHeight / 2 };
      var wc = this.screenToWorld(c.x, c.y);
      this.zoom = z;
      this.pan.x = c.x - wc.x * z;
      this.pan.y = c.y - wc.y * z;
    }
    this.render();
    this.emit('zoom', this.zoom);
  };
  Editor.prototype.zoomIn = function () { this.setZoom(Math.min(4, this.zoom * 1.2)); };
  Editor.prototype.zoomOut = function () { this.setZoom(Math.max(0.1, this.zoom / 1.2)); };
  Editor.prototype.zoomActual = function () { this.setZoom(1); };
  Editor.prototype.zoomFit = function () {
    if (!this.diagram) return;
    var b = views.diagramBounds(this.diagram);
    var cw = this.container.clientWidth, ch = this.container.clientHeight;
    var z = Math.min(cw / b.width, ch / b.height, 2);
    z = Math.max(0.1, Math.min(4, z * 0.95));
    this.zoom = z;
    this.pan.x = (cw - b.width * z) / 2 - b.x * z;
    this.pan.y = (ch - b.height * z) / 2 - b.y * z;
    this.render();
    this.emit('zoom', this.zoom);
  };

  /* ============================ diagram binding ============================ */

  Editor.prototype.saveViewport = function () {
    if (this.diagramId) this.viewports.set(this.diagramId, { zoom: this.zoom, pan: { x: this.pan.x, y: this.pan.y } });
  };

  Editor.prototype.setDiagram = function (diagram) {
    this.saveViewport();
    this.commitInlineEdit(true);
    this.diagram = diagram || null;
    this.diagramId = diagram ? diagram._id : null;
    this.selection = [];
    this.tool = null;
    if (diagram && this.viewports.has(diagram._id)) {
      var vp = this.viewports.get(diagram._id);
      this.zoom = vp.zoom; this.pan = vp.pan;
    } else if (diagram) {
      this.zoom = 1;
      this.pan = { x: 60, y: 60 };
    }
    this.resize();
    this.emit('selection', this.selection);
  };

  /** Re-resolve diagram & selection by id after undo/redo/load. */
  Editor.prototype.rebind = function () {
    var d = this.diagramId ? this.project.get(this.diagramId) : null;
    if (!d || !meta.isDiagramLike(d._type)) {
      this.diagram = null; this.diagramId = null; this.selection = [];
      return false;
    }
    this.diagram = d;
    var newSel = [];
    this.selectionIds.forEach(function (id) {
      var v = this.project.get(id);
      if (v && d.ownedViews && d.ownedViews.indexOf(v) >= 0) newSel.push(v);
    }, this);
    this.selection = newSel;
    this.selectionIds = newSel.map(function (v) { return v._id; });
    return true;
  };

  Editor.prototype.syncSelectionIds = function () {
    this.selectionIds = this.selection.map(function (v) { return v._id; });
  };

  /* ============================ rendering ============================ */

  Editor.prototype.render = function () {
    var gfx = this.gfx, ctx = this.ctx2d;
    var w = this.container.clientWidth, h = this.container.clientHeight;
    ctx.setTransform(this.dpr || 1, 0, 0, this.dpr || 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // white canvas background (StarUML style)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    if (!this.diagram) return;
    ctx.save();
    ctx.translate(this.pan.x, this.pan.y);
    ctx.scale(this.zoom, this.zoom);
    this._drawGrid(ctx, w, h);
    var drawCtx = { project: this.project, diagram: this.diagram, editor: this };
    views.prepareDiagram(this.diagram);
    var order = views.drawOrder(this.diagram);
    for (var i = 0; i < order.length; i++) {
      var v = order[i];
      if (v.visible === false) continue;
      gfx.save();
      try {
        views.draw(gfx, v, drawCtx);
      } catch (e) {
        console.error('view draw error', v, e);
      }
      gfx.restore();
    }
    ctx.restore();
    this._drawDecorations(ctx);
  };

  Editor.prototype._drawGrid = function (ctx, w, h) {
    if (!this.showGrid) return;
    var g = this.gridSize;
    var z = this.zoom;
    if (z * g < 5) return; // too dense
    var tl = this.screenToWorld(0, 0), br = this.screenToWorld(w, h);
    var x0 = Math.floor(tl.x / g) * g, y0 = Math.floor(tl.y / g) * g;
    var count = ((br.x - x0) / g) * ((br.y - y0) / g);
    if (count > 40000) return;
    ctx.fillStyle = '#dcdcdc';
    var s = 1 / z;
    for (var x = x0; x <= br.x; x += g) {
      for (var y = y0; y <= br.y; y += g) {
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
  };

  Editor.prototype._drawDecorations = function (ctx) {
    var self = this;
    var z = this.zoom;
    ctx.save();
    ctx.translate(this.pan.x, this.pan.y);
    ctx.scale(z, z);
    // selection outlines
    this.selection.forEach(function (v) {
      ctx.strokeStyle = '#2f80c3';
      ctx.lineWidth = 1.2 / z;
      if (meta.isEdgeView(v._type) || v._type === 'UMLSeqMessageView') {
        var pts = views.routedPoints(v);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      } else if (v._type === 'UMLSeqLifelineView') {
        var r = views.viewRect(v);
        var bottom = views.lifelineBottom(self.diagram, v);
        ctx.strokeRect(r.x, r.y, r.width, bottom - r.y);
      } else {
        var r2 = views.viewRect(v);
        ctx.strokeRect(r2.x - 1 / z, r2.y - 1 / z, r2.width + 2 / z, r2.height + 2 / z);
      }
    });
    ctx.restore();

    // handles (screen space)
    ctx.save();
    var hs = HANDLE;
    this.selection.forEach(function (v) {
      var handles = self.handlesFor(v);
      handles.forEach(function (hd) {
        var p = self.worldToScreen(hd.x, hd.y);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#2f80c3';
        ctx.lineWidth = 1;
        if (hd.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, hs / 2 + 1, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
        } else {
          ctx.fillRect(p.x - hs / 2, p.y - hs / 2, hs, hs);
          ctx.strokeRect(p.x - hs / 2, p.y - hs / 2, hs, hs);
        }
      });
    });
    // marquee
    if (this._drag && this._drag.kind === 'marquee') {
      var m = this._drag;
      var p1 = this.worldToScreen(m.start.x, m.start.y);
      var p2 = this.worldToScreen(m.current.x, m.current.y);
      ctx.strokeStyle = '#2f80c3';
      ctx.fillStyle = 'rgba(47,128,195,0.08)';
      ctx.setLineDash([4, 3]);
      ctx.fillRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
      ctx.strokeRect(Math.min(p1.x, p2.x), Math.min(p1.y, p2.y), Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
      ctx.setLineDash([]);
    }
    // pending edge rubber band
    if (this._drag && this._drag.kind === 'edge-create') {
      var e = this._drag;
      var a = this.worldToScreen(e.from.x, e.from.y);
      var b = this.worldToScreen(e.current.x, e.current.y);
      ctx.strokeStyle = '#2f80c3';
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  };

  Editor.prototype.handlesFor = function (v) {
    var out = [];
    if (meta.isEdgeView(v._type) || v._type === 'UMLSeqMessageView') {
      var pts = v.points || [];
      if (v.head && v.tail) {
        var rp = views.routedPoints(v);
        out.push({ x: rp[0].x, y: rp[0].y, shape: 'circle', role: 'tail' });
        out.push({ x: rp[rp.length - 1].x, y: rp[rp.length - 1].y, shape: 'circle', role: 'head' });
        var bends = pts.slice(1, -1);
        bends.forEach(function (p, i) { out.push({ x: p.x, y: p.y, role: 'bend', index: i + 1 }); });
      }
      if (v._type === 'UMLSeqMessageView') {
        var y = (v.points && v.points[0]) ? v.points[0].y : 0;
        out.push({ x: (v.points && v.points[0] ? v.points[0].x : 0), y: y, role: 'msgy' });
      }
      return out;
    }
    if (v._type === 'UMLSeqLifelineView') {
      var r0 = views.viewRect(v);
      return [
        { x: r0.x, y: r0.y, role: 'nw' }, { x: r0.x + r0.width, y: r0.y, role: 'ne' },
        { x: r0.x, y: r0.y + r0.height, role: 'sw' }, { x: r0.x + r0.width, y: r0.y + r0.height, role: 'se' },
        { x: r0.x + r0.width / 2, y: r0.y, role: 'n' }, { x: r0.x + r0.width / 2, y: r0.y + r0.height, role: 's' },
        { x: r0.x, y: r0.y + r0.height / 2, role: 'w' }, { x: r0.x + r0.width, y: r0.y + r0.height / 2, role: 'e' }
      ];
    }
    var r = views.viewRect(v);
    return [
      { x: r.x, y: r.y, role: 'nw' }, { x: r.x + r.width / 2, y: r.y, role: 'n' },
      { x: r.x + r.width, y: r.y, role: 'ne' }, { x: r.x + r.width, y: r.y + r.height / 2, role: 'e' },
      { x: r.x + r.width, y: r.y + r.height, role: 'se' }, { x: r.x + r.width / 2, y: r.y + r.height, role: 's' },
      { x: r.x, y: r.y + r.height, role: 'sw' }, { x: r.x, y: r.y + r.height / 2, role: 'w' }
    ];
  };

  var CURSORS = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };

  /* ============================ hit testing ============================ */

  Editor.prototype.viewAt = function (worldPt) {
    if (!this.diagram) return null;
    var order = views.drawOrder(this.diagram);
    for (var i = order.length - 1; i >= 0; i--) {
      var v = order[i];
      if (v.visible === false) continue;
      if (views.hit(v, worldPt)) return v;
    }
    return null;
  };

  Editor.prototype.handleAt = function (screenPt) {
    var hs = HANDLE + 3;
    for (var i = this.selection.length - 1; i >= 0; i--) {
      var handles = this.handlesFor(this.selection[i]);
      for (var j = 0; j < handles.length; j++) {
        var p = this.worldToScreen(handles[j].x, handles[j].y);
        if (Math.abs(p.x - screenPt.x) <= hs / 2 && Math.abs(p.y - screenPt.y) <= hs / 2) {
          return { view: this.selection[i], handle: handles[j] };
        }
      }
    }
    return null;
  };

  /* ============================ selection ============================ */

  Editor.prototype.setSelection = function (arr) {
    this.selection = arr.slice();
    this.syncSelectionIds();
    this.render();
    this.emit('selection', this.selection);
  };
  Editor.prototype.select = function (v, additive) {
    if (additive) {
      if (this.selection.indexOf(v) >= 0) util.removeItem(this.selection, v);
      else this.selection.push(v);
    } else {
      this.selection = [v];
    }
    this.syncSelectionIds();
    this.render();
    this.emit('selection', this.selection);
  };
  Editor.prototype.clearSelection = function () { this.setSelection([]); };
  Editor.prototype.selectAll = function () {
    if (!this.diagram) return;
    this.setSelection((this.diagram.ownedViews || []).slice());
  };
  Editor.prototype.getSelectedModel = function () {
    return this.selection.length ? this.selection[0].model : null;
  };

  /* ============================ tools ============================ */

  Editor.prototype.setTool = function (tool) {
    this.tool = tool;
    this.canvas.style.cursor = tool ? 'crosshair' : 'default';
    this.render();
  };

  /* ============================ events ============================ */

  Editor.prototype._bindEvents = function () {
    var self = this;
    var cv = this.canvas;

    function localPt(ev) {
      var r = cv.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    }

    cv.addEventListener('mousedown', function (ev) { self._onMouseDown(ev, localPt(ev)); });
    cv.addEventListener('mousemove', function (ev) { self._onMouseMove(ev, localPt(ev)); });
    global.addEventListener('mouseup', function (ev) {
      if (self._drag) self._onMouseUp(ev, localPt(ev));
    });
    cv.addEventListener('dblclick', function (ev) { self._onDblClick(ev, localPt(ev)); });
    cv.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      if (ev.ctrlKey || ev.metaKey) {
        var factor = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
        self.setZoom(self.zoom * factor, localPt(ev));
      } else {
        self.pan.x -= ev.deltaX;
        self.pan.y -= ev.deltaY;
        self.render();
      }
    }, { passive: false });
    cv.addEventListener('contextmenu', function (ev) {
      ev.preventDefault();
      var sp = localPt(ev);
      var wp = self.screenToWorld(sp.x, sp.y);
      var v = self.viewAt(wp);
      if (v && self.selection.indexOf(v) < 0) self.select(v, false);
      self.emit('contextmenu', { view: v, world: wp, screen: sp, nativeEvent: ev });
    });
    cv.addEventListener('keydown', function (ev) { self._onKeyDown(ev); });
    global.addEventListener('keydown', function (ev) {
      if (ev.code === 'Space' && !self._typing()) { self._spaceDown = true; }
    });
    global.addEventListener('keyup', function (ev) {
      if (ev.code === 'Space') self._spaceDown = false;
    });
  };

  Editor.prototype._typing = function () {
    var ae = document.activeElement;
    return ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
  };

  Editor.prototype._onMouseDown = function (ev, sp) {
    if (!this.diagram) return;
    this.canvas.focus();
    this.commitInlineEdit(false);
    var wp = this.screenToWorld(sp.x, sp.y);

    // middle button or space → pan
    if (ev.button === 1 || (ev.button === 0 && this._spaceDown)) {
      this._drag = { kind: 'pan', startScreen: sp, startPan: { x: this.pan.x, y: this.pan.y } };
      ev.preventDefault();
      return;
    }
    if (ev.button !== 0) return;

    // toolbox tool active
    if (this.tool) {
      this._handleToolDown(wp, sp, ev);
      return;
    }

    // handle grab?
    var hg = this.handleAt(sp);
    if (hg) {
      this._startHandleDrag(hg, wp);
      return;
    }

    var v = this.viewAt(wp);
    if (v) {
      if (ev.shiftKey) {
        this.select(v, true);
      } else if (this.selection.indexOf(v) < 0) {
        this.select(v, false);
      }
      this._startMoveDrag(wp);
    } else {
      if (!ev.shiftKey && this.selection.length) this.clearSelection();
      this._drag = { kind: 'marquee', start: wp, current: wp, additive: ev.shiftKey, baseSel: this.selection.slice() };
    }
  };

  Editor.prototype._onMouseMove = function (ev, sp) {
    if (!this.diagram) return;
    var wp = this.screenToWorld(sp.x, sp.y);
    this.emit('status', { x: Math.round(wp.x), y: Math.round(wp.y) });

    if (!this._drag) {
      // hover cursor
      var hg = this.handleAt(sp);
      if (hg && CURSORS[hg.handle.role]) this.canvas.style.cursor = CURSORS[hg.handle.role];
      else if (hg) this.canvas.style.cursor = 'pointer';
      else {
        var hv = this.viewAt(wp);
        this.canvas.style.cursor = this.tool ? 'crosshair' : hv ? 'move' : (this._spaceDown ? 'grab' : 'default');
        if (hv !== this.hover) { this.hover = hv; }
      }
      return;
    }

    var d = this._drag;
    if (d.kind === 'pan') {
      this.pan.x = d.startPan.x + (sp.x - d.startScreen.x);
      this.pan.y = d.startPan.y + (sp.y - d.startScreen.y);
      this.canvas.style.cursor = 'grabbing';
      this.render();
    } else if (d.kind === 'marquee') {
      d.current = wp;
      var r = util.normalizeRect(d.start, wp);
      var sel = d.additive ? d.baseSel.slice() : [];
      (this.diagram.ownedViews || []).forEach(function (v) {
        var vr = views.viewRect(v);
        if (util.intersects(r, vr) && sel.indexOf(v) < 0) sel.push(v);
      });
      this.selection = sel;
      this.syncSelectionIds();
      this.render();
    } else if (d.kind === 'move') {
      var dx = wp.x - d.last.x, dy = wp.y - d.last.y;
      if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      d.moved = d.moved || Math.abs(wp.x - d.start.x) > 2 || Math.abs(wp.y - d.start.y) > 2;
      d.targets.forEach(function (t) {
        if (t.edge) {
          // move bends only (attached endpoints re-anchor automatically)
          (t.view.points || []).forEach(function (p, i) {
            if (i > 0 && i < t.view.points.length - 1 && t.view.head && t.view.tail) { p.x += dx; p.y += dy; }
            else if (!(t.view.head && t.view.tail)) { p.x += dx; p.y += dy; }
          });
        } else if (t.view._type === 'UMLSeqMessageView') {
          var oy = t.orig.points && t.orig.points[0] ? t.orig.points[0].y : 0;
          var ny = oy + dy;
          (t.view.points || []).forEach(function (p) { p.y = ny; });
        } else if (t.view._type === 'UMLSeqLifelineView') {
          // lifelines slide horizontally only
          t.view.left = t.orig.left + dx;
        } else {
          t.view.left = t.orig.left + dx;
          t.view.top = t.orig.top + dy;
        }
      });
      d.last = wp;
      this.render();
    } else if (d.kind === 'resize') {
      this._applyResize(d, wp, ev);
    } else if (d.kind === 'endpoint') {
      d.current = wp;
      var over = this.viewAt(wp);
      d.overView = (over && over !== d.view && !meta.isEdgeView(over._type)) ? over : null;
      this.render();
    } else if (d.kind === 'edge-create') {
      d.current = wp;
      d.overView = this.viewAt(wp);
      this.render();
    }
  };

  Editor.prototype._onMouseUp = function (ev, sp) {
    var d = this._drag;
    this._drag = null;
    this.canvas.style.cursor = this.tool ? 'crosshair' : 'default';
    if (!d) return;
    var wp = this.screenToWorld(sp.x, sp.y);

    if (d.kind === 'move' && d.moved) {
      var self = this;
      if (this.snapToGrid) {
        d.targets.forEach(function (t) {
          if (!t.edge && t.view._type !== 'UMLSeqMessageView') {
            t.view.left = util.snap(t.view.left, self.gridSize, true);
            t.view.top = util.snap(t.view.top, self.gridSize, true);
          }
        });
      }
      views.assignContainers(this.diagram);
      this.project._pushStateUndo(d.label, d.beforeState);
    } else if (d.kind === 'resize' && d.moved) {
      views.assignContainers(this.diagram);
      this.project._pushStateUndo(d.label, d.beforeState);
    } else if (d.kind === 'endpoint') {
      this._finishEndpoint(d);
    } else if (d.kind === 'edge-create') {
      this._finishEdgeCreate(d);
    }
    this.emit('selection', this.selection);
    this.render();
  };

  /* ---------- move / resize machinery ---------- */

  Editor.prototype._collectMoveTargets = function (primary) {
    var targets = [];
    var seen = new Set();
    function addView(v, orig) {
      if (seen.has(v)) return;
      seen.add(v);
      targets.push({ view: v, orig: orig, edge: false });
    }
    var self = this;
    this.selection.forEach(function (v) {
      var orig = { left: v.left, top: v.top };
      if ((v.points || []).length) orig.points = v.points.map(function (p) { return { x: p.x, y: p.y }; });
      if (meta.isEdgeView(v._type)) targets.push({ view: v, orig: orig, edge: true });
      else addView(v, orig);
    });
    // children of selected containers move along
    this.selection.forEach(function (v) {
      if (views.isContainerType(v._type)) {
        (function walkChildren(parent) {
          views.childrenOf(self.diagram, parent).forEach(function (child) {
            if (!seen.has(child)) addView(child, { left: child.left, top: child.top });
            walkChildren(child);
          });
        })(v);
      }
    });
    return targets;
  };

  Editor.prototype._startMoveDrag = function (wp) {
    var targets = this._collectMoveTargets();
    this._drag = {
      kind: 'move', start: wp, last: wp, targets: targets, moved: false,
      beforeState: OS.Mdj.stateJSON(this.project), label: 'Move'
    };
  };

  Editor.prototype._startHandleDrag = function (hg, wp) {
    var v = hg.view, role = hg.handle.role;
    if (role === 'head' || role === 'tail') {
      var pts = views.routedPoints(v);
      var startPt = role === 'head' ? pts[pts.length - 1] : pts[0];
      this._drag = { kind: 'endpoint', view: v, role: role, from: startPt, current: wp, overView: null };
      return;
    }
    if (role === 'bend') {
      this._drag = {
        kind: 'resize', view: v, role: 'bend', index: hg.handle.index, start: wp, moved: false,
        beforeState: OS.Mdj.stateJSON(this.project), label: 'Bend'
      };
      return;
    }
    if (role === 'msgy') {
      this._drag = {
        kind: 'resize', view: v, role: 'msgy', start: wp, moved: false,
        beforeState: OS.Mdj.stateJSON(this.project), label: 'Move Message',
        origY: v.points && v.points[0] ? v.points[0].y : wp.y
      };
      return;
    }
    this._drag = {
      kind: 'resize', view: v, role: role, start: wp, moved: false,
      beforeState: OS.Mdj.stateJSON(this.project), label: 'Resize',
      orig: { left: v.left, top: v.top, width: v.width, height: v.height }
    };
  };

  Editor.prototype._applyResize = function (d, wp, ev) {
    var v = d.view;
    d.moved = true;
    if (d.role === 'bend') {
      if (v.points && v.points[d.index]) {
        v.points[d.index].x = this.snapToGrid ? util.snap(wp.x, this.gridSize, true) : wp.x;
        v.points[d.index].y = this.snapToGrid ? util.snap(wp.y, this.gridSize, true) : wp.y;
      }
      this.render();
      return;
    }
    if (d.role === 'msgy') {
      var ny = this.snapToGrid ? util.snap(d.origY + (wp.y - d.start.y), this.gridSize, true) : d.origY + (wp.y - d.start.y);
      (v.points || []).forEach(function (p) { p.y = ny; });
      this.render();
      return;
    }
    var o = d.orig;
    var nx = this.snapToGrid ? util.snap(wp.x, this.gridSize, true) : wp.x;
    var ny2 = this.snapToGrid ? util.snap(wp.y, this.gridSize, true) : wp.y;
    var left = o.left, top = o.top, width = o.width, height = o.height;
    if (d.role.indexOf('w') >= 0) { width = o.left + o.width - nx; left = nx; }
    if (d.role.indexOf('e') >= 0) { width = nx - o.left; }
    if (d.role.indexOf('n') >= 0) { height = o.top + o.height - ny2; top = ny2; }
    if (d.role.indexOf('s') >= 0) { height = ny2 - o.top; }
    var isSeqHead = v._type === 'UMLSeqLifelineView';
    if (width < MIN_W) { if (d.role.indexOf('w') >= 0) left = o.left + o.width - MIN_W; width = MIN_W; }
    if (height < MIN_H) { if (d.role.indexOf('n') >= 0 && !isSeqHead) top = o.top + o.height - MIN_H; height = isSeqHead ? Math.max(height, MIN_H) : MIN_H; }
    if (isSeqHead && d.role.indexOf('n') >= 0) { top = o.top; height = o.height; }
    v.left = left; v.top = top; v.width = width; v.height = height;
    this.render();
  };

  Editor.prototype._finishEndpoint = function (d) {
    var v = d.view;
    var target = d.overView;
    var self = this;
    if (!target) {
      // free endpoint: store raw point
      this.project.transact('Detach Endpoint', function () {
        if (d.role === 'head') { v.head = null; } else { v.tail = null; }
        var pts = v.points && v.points.length >= 2 ? v.points : [{ x: d.from.x, y: d.from.y }, { x: d.from.x + 10, y: d.from.y + 10 }];
        if (d.role === 'head') pts[pts.length - 1] = { x: d.current.x, y: d.current.y };
        else pts[0] = { x: d.current.x, y: d.current.y };
        v.points = pts;
      });
      return;
    }
    this.project.transact('Reconnect', function () {
      var m = v.model;
      if (d.role === 'head') v.head = target; else v.tail = target;
      if (m) {
        if (v._type === 'UMLAssociationView' && m.ownedEnds && m.ownedEnds.length === 2) {
          var ends = views.assocEnds(v);
          if (d.role === 'head' && ends.head) ends.head.reference = target.model;
          if (d.role === 'tail' && ends.tail) ends.tail.reference = target.model;
        } else {
          if (d.role === 'head') m.target = target.model; else m.source = target.model;
        }
      }
      // ensure points array exists with 2 entries
      if (!v.points || v.points.length < 2) v.points = [{ x: d.from.x, y: d.from.y }, { x: d.current.x, y: d.current.y }];
    });
  };

  /* ---------- tool-based creation ---------- */

  Editor.prototype._handleToolDown = function (wp, sp, ev) {
    var tool = this.tool;
    if (tool.kind === 'node') {
      this._createNodeAt(tool, wp);
      if (!ev.shiftKey) this.setTool(null);
      this.emit('tool-used', tool);
      return;
    }
    // edge tools
    var startView = this.viewAt(wp);
    if (!startView || meta.isEdgeView(startView._type)) {
      this.emit('status-message', 'Drag from a source element to a target element.');
      return;
    }
    this._drag = {
      kind: 'edge-create', tool: tool, fromView: startView,
      from: views.anchorOf(startView, wp), current: wp, overView: null
    };
  };

  Editor.prototype._finishEdgeCreate = function (d) {
    var tool = d.tool;
    var targetView = d.overView;
    if (!targetView || meta.isEdgeView(targetView._type)) {
      if (!(tool.preset && tool.preset.self && targetView === d.fromView)) {
        this.emit('status-message', 'Cancelled — drop on a valid target element.');
        return;
      }
    }
    var self = this;
    var tailView = d.fromView, headView = targetView || d.fromView;
    // validate
    var rule = EDGE_RULES[tool.modelType];
    if (rule && rule.targets) {
      var okT = rule.targets.indexOf(tailView.model._type) >= 0;
      var okH = rule.targets.indexOf(headView.model._type) >= 0;
      if (!okT || !okH) {
        this.emit('status-message', meta.label(tool.modelType) + ' cannot connect ' +
          meta.label(tailView.model._type) + ' and ' + meta.label(headView.model._type) + '.');
        return;
      }
    }
    if (tool.preset && tool.preset.self) headView = tailView;
    this.createEdge(tool, tailView, headView, d.current);
    this.emit('tool-used', tool);
  };

  Editor.prototype.createEdge = function (tool, tailView, headView, pt) {
    var self = this;
    var project = this.project;
    var diagram = this.diagram;
    var created = null;
    project.transact('Create ' + meta.label(tool.modelType), function () {
      var owner = self._elementOwner(diagram, tool.modelType);
      var m = project.createElement(owner, tool.modelType);
      if (tool.modelType === 'UMLAssociation') {
        m.ownedEnds = [];
        var e1 = model.createElement(project, 'UMLAssociationEnd');
        var e2 = model.createElement(project, 'UMLAssociationEnd');
        e1._parent = m; e2._parent = m;
        e1.reference = tailView.model;
        e2.reference = headView.model;
        m.ownedEnds.push(e1, e2);
        project._register(e1); project._register(e2);
        if (tool.preset && tool.preset.navigable) { e1.navigable = tool.preset.navigable[0]; e2.navigable = tool.preset.navigable[1]; }
        if (tool.preset && tool.preset.aggregation) {
          // Diamond sits at the drag origin (tail = the whole), like StarUML:
          // drag Composition/Aggregation from the whole toward the part.
          e1.aggregation = tool.preset.aggregation[1] || 'none';
          e2.aggregation = 'none';
        }
      } else {
        m.source = tailView.model;
        m.target = headView.model;
      }
      if (tool.modelType === 'UMLMessage') {
        m.messageSort = (tool.preset && tool.preset.messageSort) || 'synchCall';
        m.name = '';
      }
      if (tool.modelType === 'UMLInterfaceRealization') { /* source implements target */ }
      var v = project.createView(diagram, m, {});
      if (v) {
        v.tail = tailView;
        v.head = headView;
        if (tool.modelType === 'UMLMessage') {
          var tr = views.viewRect(tailView), hr = views.viewRect(headView);
          var y = pt ? Math.max(pt.y, tr.y + tr.height + 10) : tr.y + tr.height + 40;
          v.points = [{ x: tr.x + tr.width / 2, y: y }, { x: hr.x + hr.width / 2, y: y }];
        } else {
          var a = views.anchorOf(tailView, util.center(views.viewRect(headView)));
          var b = views.anchorOf(headView, util.center(views.viewRect(tailView)));
          v.points = [a, b];
        }
        v.lineStyle = tool.modelType === 'UMLMessage' ? 'straight' : 'ortho';
      }
      created = v;
    });
    if (created) {
      this.setSelection([created]);
      this.emit('structure');
    }
    return created;
  };

  Editor.prototype._createNodeAt = function (tool, wp) {
    var self = this;
    var project = this.project, diagram = this.diagram;
    var created = null;
    project.transact('Create ' + meta.label(tool.modelType), function () {
      var owner = self._elementOwner(diagram, tool.modelType);
      var props = {};
      if (tool.preset) for (var k in tool.preset) if (k !== 'self' && k !== 'boundary' && k !== 'navigable' && k !== 'aggregation' && k !== 'messageSort') props[k] = tool.preset[k];
      var m = project.createElement(owner, tool.modelType, props);
      if (tool.modelType === 'UMLAssociation') { /* not a node tool */ }
      if (tool.modelType === 'UMLNote') { m.name = project.uniqueName(owner, 'Note'); m.documentation = ''; }
      if (tool.modelType === 'UMLCombinedFragment') {
        var op1 = model.createElement(project, 'UMLInteractionOperand', { name: '', guard: '' });
        model.addOwned(project, m, op1);
      }
      var x = wp.x, y = wp.y;
      if (tool.modelType === 'UMLLifeline') {
        // align with existing lifelines
        var minTop = null;
        (diagram.ownedViews || []).forEach(function (v) {
          if (v._type === 'UMLSeqLifelineView' && (minTop === null || v.top < minTop)) minTop = v.top;
        });
        if (minTop !== null) y = minTop;
      }
      var size = model.DEFAULT_SIZES[meta.MODEL_TO_VIEW[tool.modelType]] || { w: 100, h: 60 };
      var v = project.createView(diagram, m, { x: self.snapToGrid ? util.snap(x - size.w / 2, self.gridSize, true) : x - size.w / 2, y: self.snapToGrid ? util.snap(y - size.h / 2, self.gridSize, true) : y - size.h / 2 });
      if (v) {
        // drop into container if applicable
        views.assignContainers(diagram);
      }
      created = v;
    });
    if (created) {
      this.setSelection([created]);
      this.emit('structure');
      if (tool.modelType === 'UMLNote' || tool.modelType === 'UMLClass' || tool.modelType === 'UMLInterface' ||
          tool.modelType === 'UMLEnumeration' || tool.modelType === 'UMLUseCase' || tool.modelType === 'UMLActor' ||
          tool.modelType === 'UMLState' || tool.modelType === 'UMLAction' || tool.modelType === 'UMLLifeline') {
        var self2 = this;
        setTimeout(function () { self2.startInlineEdit(created); }, 30);
      }
    }
    return created;
  };

  /** For statechart/activity diagrams the owner of created nodes is the behavior element. */
  Editor.prototype._behaviorOwner = function (diagram) {
    var owner = diagram._parent;
    if (owner && (owner._type === 'UMLStateMachine' || owner._type === 'UMLActivity')) return owner;
    return null;
  };

  /**
   * Correct owner for a new element created on `diagram`:
   * sequence interaction elements live ON the diagram (StarUML convention),
   * state/activity nodes live on the behavior element, everything else on
   * the diagram's owner namespace.
   */
  Editor.prototype._elementOwner = function (diagram, modelType) {
    if (diagram._type === 'UMLSequenceDiagram' &&
        ['UMLLifeline', 'UMLMessage', 'UMLCombinedFragment', 'UMLInteractionOperand'].indexOf(modelType) >= 0) {
      return diagram;
    }
    return this._behaviorOwner(diagram) || diagram._parent || this.project.firstModel();
  };

  /* ---------- double click / inline editing ---------- */

  Editor.prototype._onDblClick = function (ev, sp) {
    var wp = this.screenToWorld(sp.x, sp.y);
    var v = this.viewAt(wp);
    if (!v) return;
    this.startInlineEdit(v);
  };

  Editor.prototype.startInlineEdit = function (v) {
    if (!v || meta.isEdgeView(v._type)) {
      if (v && (meta.isEdgeView(v._type) || v._type === 'UMLSeqMessageView')) this.emit('edit-model', v.model);
      return;
    }
    var self = this;
    var isNote = v._type === 'UMLNoteView';
    var m = v.model;
    if (!m) return;
    var value = isNote ? (m.documentation || '') : (m.name || '');
    // position
    var r = views.viewRect(v);
    var screen = this.worldToScreen(r.x, r.y);
    var scale = this.zoom;
    var input;
    if (isNote) {
      input = document.createElement('textarea');
      input.style.left = screen.x + 'px';
      input.style.top = screen.y + 'px';
      input.style.width = (r.width * scale) + 'px';
      input.style.height = (r.height * scale) + 'px';
    } else {
      input = document.createElement('input');
      input.type = 'text';
      var layout = views.computeLayout(v);
      var ncr = layout.nameCompartment ? layout.nameCompartment.rect : r;
      var ns = this.worldToScreen(ncr.x, ncr.y);
      input.style.left = ns.x + 'px';
      input.style.top = ns.y + 'px';
      input.style.width = Math.max(60, r.width * scale) + 'px';
      input.style.height = Math.max(20, ncr.height * scale) + 'px';
      if (v._type === 'UMLSeqLifelineView') {
        input.style.height = '26px';
      }
    }
    input.className = 'inline-edit';
    input.value = value;
    this.container.appendChild(input);
    input.focus();
    input.select();
    this._editInput = { input: input, view: v, isNote: isNote };
    input.addEventListener('keydown', function (ev) {
      ev.stopPropagation();
      if (ev.key === 'Enter' && (!isNote || !ev.shiftKey)) { ev.preventDefault(); self.commitInlineEdit(false); }
      else if (ev.key === 'Escape') { self.commitInlineEdit(true); }
    });
    input.addEventListener('blur', function () { self.commitInlineEdit(false); });
  };

  Editor.prototype.commitInlineEdit = function (cancel) {
    var e = this._editInput;
    if (!e) return;
    this._editInput = null;
    var input = e.input;
    if (input.parentNode) input.parentNode.removeChild(input);
    if (cancel) return;
    var v = this.project.get(e.view._id);
    if (!v || !v.model) return;
    var m = v.model;
    var value = input.value;
    var isNote = e.isNote;
    var oldValue = isNote ? (m.documentation || '') : (m.name || '');
    if (value === oldValue) return;
    var project = this.project;
    var self = this;
    project.transact(isNote ? 'Edit Note Text' : 'Rename', function () {
      var m2 = self.project.get(v._id) && self.project.get(v._id).model;
      if (!m2) return;
      if (isNote) m2.documentation = value;
      else m2.name = value;
      if (!isNote) views.autoLayout(self.project.get(v._id), { growOnly: false, minWidth: 40 });
    });
    this.emit('structure');
  };

  /* ---------- keyboard ---------- */

  Editor.prototype._onKeyDown = function (ev) {
    if (this._typing()) return;
    var handled = true;
    switch (ev.key) {
      case 'Delete': case 'Backspace':
        this.deleteSelection(); break;
      case 'Escape':
        if (this.tool) this.setTool(null);
        else this.clearSelection();
        break;
      case 'ArrowLeft': this.nudge(ev.shiftKey ? -this.gridSize : -1, 0); break;
      case 'ArrowRight': this.nudge(ev.shiftKey ? this.gridSize : 1, 0); break;
      case 'ArrowUp': this.nudge(0, ev.shiftKey ? -this.gridSize : -1); break;
      case 'ArrowDown': this.nudge(0, ev.shiftKey ? this.gridSize : 1); break;
      default: handled = false;
    }
    if (handled) { ev.preventDefault(); ev.stopPropagation(); }
  };

  Editor.prototype.nudge = function (dx, dy) {
    if (!this.selection.length) return;
    var targets = this._collectMoveTargets();
    var self = this;
    this.project.transact('Nudge', function () {
      targets.forEach(function (t) {
        if (t.edge) {
          (t.view.points || []).forEach(function (p, i) {
            if (i > 0 && i < t.view.points.length - 1) { p.x += dx; p.y += dy; }
          });
        } else {
          t.view.left += dx; t.view.top += dy;
        }
      });
    });
    this.render();
    this.emit('structure');
  };

  /* ---------- editing ops ---------- */

  Editor.prototype.deleteSelection = function () {
    if (!this.selection.length) return;
    var self = this;
    var sel = this.selection.slice();
    this.project.transact('Delete', function () {
      sel.forEach(function (v) {
        var cur = self.project.get(v._id);
        if (cur) model.deleteView(self.project, cur);
      });
    });
    this.selection = [];
    this.syncSelectionIds();
    this.render();
    this.emit('structure');
  };

  Editor.prototype.duplicateSelection = function () {
    var data = this.copyData();
    if (!data) return;
    this.pasteData(data, 16, 16);
  };

  /* ---------- clipboard ---------- */

  Editor.prototype.copyData = function () {
    if (!this.selection.length || !this.diagram) return null;
    return OS.clipboard.capture(this.project, this.diagram, this.selection);
  };

  Editor.prototype.pasteData = function (data, offX, offY) {
    if (!data || !this.diagram) return;
    offX = offX === undefined ? 20 : offX;
    offY = offY === undefined ? 20 : offY;
    var self = this;
    var project = this.project;
    var diagram = this.diagram;
    var newViews = [];
    project.transact('Paste', function () {
      var ownerOverride = diagram._type === 'UMLSequenceDiagram' ? diagram : self._behaviorOwner(diagram);
      newViews = OS.clipboard.deserializeInto(project, diagram, data, offX, offY, ownerOverride);
    });
    if (newViews.length) {
      this.setSelection(newViews);
      this.emit('structure');
    }
  };

  /* ---------- alignment / distribution / z-order ---------- */

  Editor.prototype.align = function (mode) {
    var sel = this.selection.filter(function (v) { return !meta.isEdgeView(v._type) && v._type !== 'UMLSeqMessageView'; });
    if (sel.length < 2) { this.emit('status-message', 'Select at least two elements to align.'); return; }
    var rects = sel.map(function (v) { return { v: v, r: views.viewRect(v) }; });
    var minX = Math.min.apply(null, rects.map(function (a) { return a.r.x; }));
    var minY = Math.min.apply(null, rects.map(function (a) { return a.r.y; }));
    var maxX = Math.max.apply(null, rects.map(function (a) { return a.r.x + a.r.width; }));
    var maxY = Math.max.apply(null, rects.map(function (a) { return a.r.y + a.r.height; }));
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    var self = this;
    this.project.transact('Align ' + mode, function () {
      rects.forEach(function (a) {
        var v = self.project.get(a.v._id);
        if (!v) return;
        switch (mode) {
          case 'left': v.left = minX; break;
          case 'center': v.left = Math.round(cx - v.width / 2); break;
          case 'right': v.left = maxX - v.width; break;
          case 'top': v.top = minY; break;
          case 'middle': v.top = Math.round(cy - v.height / 2); break;
          case 'bottom': v.top = maxY - v.height; break;
        }
      });
    });
    this.render();
    this.emit('structure');
  };

  Editor.prototype.distribute = function (axis) {
    var sel = this.selection.filter(function (v) { return !meta.isEdgeView(v._type); });
    if (sel.length < 3) { this.emit('status-message', 'Select at least three elements to distribute.'); return; }
    var self = this;
    this.project.transact('Distribute', function () {
      var items = sel.map(function (v) { return self.project.get(v._id); }).filter(Boolean);
      if (axis === 'horizontal') {
        items.sort(function (a, b) { return a.left - b.left; });
        var min = items[0].left;
        var max = items[items.length - 1].left + items[items.length - 1].width;
        var totalW = items.reduce(function (s, v) { return s + v.width; }, 0);
        var gap = (max - min - totalW) / (items.length - 1);
        var x = min;
        items.forEach(function (v) { v.left = Math.round(x); x += v.width + gap; });
      } else {
        items.sort(function (a, b) { return a.top - b.top; });
        var min2 = items[0].top;
        var max2 = items[items.length - 1].top + items[items.length - 1].height;
        var totalH = items.reduce(function (s, v) { return s + v.height; }, 0);
        var gap2 = (max2 - min2 - totalH) / (items.length - 1);
        var y = min2;
        items.forEach(function (v) { v.top = Math.round(y); y += v.height + gap2; });
      }
    });
    this.render();
    this.emit('structure');
  };

  Editor.prototype.zOrder = function (mode) {
    if (!this.selection.length || !this.diagram) return;
    var list = this.diagram.ownedViews;
    var self = this;
    this.project.transact('Z-Order', function () {
      var sel = self.selection.map(function (v) { return self.project.get(v._id); }).filter(Boolean);
      sel.forEach(function (v) { util.removeItem(list, v); });
      if (mode === 'front') sel.forEach(function (v) { list.push(v); });
      else if (mode === 'back') sel.reverse().forEach(function (v) { list.unshift(v); });
      else if (mode === 'forward') {
        // insert after the last non-selected
        var idx = 0;
        for (var i = list.length - 1; i >= 0; i--) { if (sel.indexOf(list[i]) < 0) { idx = i + 1; break; } }
        sel.forEach(function (v, k) { list.splice(Math.min(idx + k, list.length), 0, v); });
      } else if (mode === 'backward') {
        var idx2 = list.length;
        for (var j = 0; j < list.length; j++) { if (sel.indexOf(list[j]) < 0) { idx2 = j; break; } }
        sel.forEach(function (v, k) { list.splice(idx2 + k, 0, v); });
      }
      views.assignContainers(self.diagram);
    });
    this.render();
    this.emit('structure');
  };

  /* ---------- model drop from explorer ---------- */

  Editor.prototype.dropModel = function (modelEl, wp) {
    var diagram = this.diagram;
    if (!diagram) return null;
    var allowed = meta.droppableTypes(diagram._type);
    if (allowed.indexOf(modelEl._type) < 0 && !meta.isDiagramLike(modelEl._type)) {
      this.emit('status-message', meta.label(modelEl._type) + ' cannot be placed on a ' +
        (meta.DIAGRAMS[diagram._type] ? meta.DIAGRAMS[diagram._type].label : 'diagram') + '.');
      return null;
    }
    // don't duplicate-view the same model twice? StarUML allows multiple views; allow it.
    var created = null;
    var self = this;
    this.project.transact('Add View', function () {
      var size = model.DEFAULT_SIZES[meta.MODEL_TO_VIEW[modelEl._type]] || { w: 100, h: 60 };
      var v = self.project.createView(diagram, modelEl, { x: wp.x - size.w / 2, y: wp.y - size.h / 2 });
      if (v) views.assignContainers(diagram);
      created = v;
    });
    if (created) {
      this.setSelection([created]);
      this.emit('structure');
    }
    return created;
  };

  /** Create a view for an existing model at a free spot (used by explorer double-click). */
  Editor.prototype.addModelView = function (modelEl) {
    var b = views.diagramBounds(this.diagram, 30);
    return this.dropModel(modelEl, { x: b.x + b.width / 2, y: b.y + b.height + 40 });
  };

  OS.Editor = Editor;
  OS.Editor.EDGE_RULES = EDGE_RULES;
})(typeof window !== 'undefined' ? window : globalThis);
