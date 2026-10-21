/*
 * OpenStar UML — graphics backends.
 * One drawing API, two implementations:
 *   CanvasGfx — wraps a 2D canvas context (screen, PNG export)
 *   SvgGfx    — emits SVG markup (SVG export)
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};

  /* ============================ CanvasGfx ============================ */

  function CanvasGfx(ctx) {
    this.ctx = ctx;
    this._font = OS.text.parseFont(OS.text.DEFAULT_FONT);
    this._fill = '#000000';
    this._stroke = '#000000';
  }

  CanvasGfx.prototype.setFont = function (f) {
    this._font = OS.text.parseFont(f);
    this.ctx.font = OS.text.fontToCss(this._font);
  };
  CanvasGfx.prototype.getFont = function () { return this._font; };
  CanvasGfx.prototype.setFill = function (c) { this._fill = c || 'transparent'; this.ctx.fillStyle = c || 'rgba(0,0,0,0)'; };
  CanvasGfx.prototype.setStroke = function (c) { this._stroke = c || 'transparent'; this.ctx.strokeStyle = c || 'rgba(0,0,0,0)'; };
  CanvasGfx.prototype.setLineWidth = function (w) { this.ctx.lineWidth = w; };
  CanvasGfx.prototype.setLineDash = function (d) { this.ctx.setLineDash(d || []); };
  CanvasGfx.prototype.setAlpha = function (a) { this.ctx.globalAlpha = a; };

  CanvasGfx.prototype.save = function () { this.ctx.save(); };
  CanvasGfx.prototype.restore = function () { this.ctx.restore(); };
  CanvasGfx.prototype.translate = function (x, y) { this.ctx.translate(x, y); };
  CanvasGfx.prototype.clipRect = function (x, y, w, h) {
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.clip();
  };

  CanvasGfx.prototype._path = function (pts, close) {
    var c = this.ctx;
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    if (close) c.closePath();
  };

  CanvasGfx.prototype.rect = function (x, y, w, h, opts) {
    opts = opts || {};
    var c = this.ctx;
    if (opts.fill !== null && opts.fill !== undefined ? opts.fill : true) { c.beginPath(); c.rect(x, y, w, h); if (opts.fill !== false) c.fill(); }
    if (opts.stroke !== false) { c.beginPath(); c.rect(x, y, w, h); c.stroke(); }
  };

  CanvasGfx.prototype.roundRect = function (x, y, w, h, r, opts) {
    opts = opts || {};
    var c = this.ctx;
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r);
    else {
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }
    if (opts.fill !== false) c.fill();
    if (opts.stroke !== false) c.stroke();
  };

  CanvasGfx.prototype.ellipse = function (cx, cy, rx, ry, opts) {
    opts = opts || {};
    var c = this.ctx;
    c.beginPath();
    c.ellipse(cx, cy, Math.max(rx, 0.1), Math.max(ry, 0.1), 0, 0, Math.PI * 2);
    if (opts.fill !== false) c.fill();
    if (opts.stroke !== false) c.stroke();
  };

  CanvasGfx.prototype.circle = function (cx, cy, r, opts) { this.ellipse(cx, cy, r, r, opts); };

  CanvasGfx.prototype.polygon = function (pts, opts) {
    opts = opts || {};
    this._path(pts, true);
    if (opts.fill !== false) this.ctx.fill();
    if (opts.stroke !== false) this.ctx.stroke();
  };

  CanvasGfx.prototype.polyline = function (pts, opts) {
    opts = opts || {};
    if (pts.length < 2) return;
    this._path(pts, false);
    this.ctx.stroke();
  };

  CanvasGfx.prototype.line = function (x1, y1, x2, y2) {
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  };

  CanvasGfx.prototype.text = function (str, x, y, opts) {
    opts = opts || {};
    var c = this.ctx;
    var f = opts.font ? OS.text.parseFont(opts.font) : this._font;
    c.font = OS.text.fontToCss(f);
    if (opts.fill) c.fillStyle = opts.fill;
    c.textAlign = opts.align || 'left';
    c.textBaseline = opts.baseline || 'top';
    c.fillText(String(str), x, y);
    if (f.underline) {
      var w = c.measureText(String(str)).width;
      var lx = opts.align === 'center' ? x - w / 2 : opts.align === 'right' ? x - w : x;
      var ly = y + (opts.baseline === 'middle' ? f.size * 0.45 : f.size * 0.95);
      c.save();
      c.beginPath();
      c.moveTo(lx, ly);
      c.lineTo(lx + w, ly);
      c.lineWidth = Math.max(1, f.size / 13);
      c.strokeStyle = opts.fill || c.fillStyle;
      c.stroke();
      c.restore();
    }
  };

  CanvasGfx.prototype.measure = function (str, font) {
    return OS.text.measureText(str, font || this._font);
  };

  CanvasGfx.prototype.lineHeight = function (font) {
    return OS.text.lineHeight(font || this._font);
  };

  /* ============================ SvgGfx ============================ */

  function SvgGfx(opts) {
    opts = opts || {};
    this.parts = [];
    this._font = OS.text.parseFont(OS.text.DEFAULT_FONT);
    this._fill = '#000000';
    this._stroke = '#000000';
    this._lineWidth = 1;
    this._dash = null;
    this._alpha = 1;
    this._stack = [];
    this._groupOpen = false;
  }

  SvgGfx.prototype._esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  SvgGfx.prototype._styleAttrs = function (opts) {
    opts = opts || {};
    var a = '';
    var fill = opts.fill === false ? 'none' : (opts.fillColor || this._fill || 'none');
    var stroke = opts.stroke === false ? 'none' : (opts.strokeColor || this._stroke || 'none');
    a += ' fill="' + this._esc(fill === 'transparent' ? 'none' : fill) + '"';
    a += ' stroke="' + this._esc(stroke === 'transparent' ? 'none' : stroke) + '"';
    a += ' stroke-width="' + (opts.lineWidth !== undefined ? opts.lineWidth : this._lineWidth) + '"';
    var dash = opts.dash !== undefined ? opts.dash : this._dash;
    if (dash && dash.length) a += ' stroke-dasharray="' + dash.join(',') + '"';
    if (this._alpha < 1) a += ' opacity="' + this._alpha + '"';
    a += ' stroke-linejoin="round"';
    return a;
  };

  SvgGfx.prototype.setFont = function (f) { this._font = OS.text.parseFont(f); };
  SvgGfx.prototype.getFont = function () { return this._font; };
  SvgGfx.prototype.setFill = function (c) { this._fill = c || 'none'; };
  SvgGfx.prototype.setStroke = function (c) { this._stroke = c || 'none'; };
  SvgGfx.prototype.setLineWidth = function (w) { this._lineWidth = w; };
  SvgGfx.prototype.setLineDash = function (d) { this._dash = d && d.length ? d : null; };
  SvgGfx.prototype.setAlpha = function (a) { this._alpha = a; };

  SvgGfx.prototype.save = function () {
    this._stack.push({ font: this._font, fill: this._fill, stroke: this._stroke, lw: this._lineWidth, dash: this._dash, alpha: this._alpha, groups: 0 });
    this.parts.push('<g>');
  };
  SvgGfx.prototype.restore = function () {
    var s = this._stack.pop();
    if (s) { this._font = s.font; this._fill = s.fill; this._stroke = s.stroke; this._lineWidth = s.lw; this._dash = s.dash; this._alpha = s.alpha; }
    // close groups opened by translate()/clipRect() inside this save, plus the save's own <g>
    var n = (s ? s.groups : 0) + 1;
    for (var i = 0; i < n; i++) this.parts.push('</g>');
  };
  SvgGfx.prototype._openGroup = function (openTag) {
    this.parts.push(openTag);
    if (this._stack.length) this._stack[this._stack.length - 1].groups++;
    else this._looseGroups = (this._looseGroups || 0) + 1;
  };
  SvgGfx.prototype.translate = function (x, y) {
    this._openGroup('<g transform="translate(' + x + ',' + y + ')">');
  };
  SvgGfx.prototype.clipRect = function (x, y, w, h) {
    // approximate: SVG clip via clipPath
    var id = 'cp' + Math.random().toString(36).slice(2, 9);
    this.parts.push('<clipPath id="' + id + '"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"/></clipPath>');
    this._openGroup('<g clip-path="url(#' + id + ')">');
  };

  function ptsToStr(pts) {
    return pts.map(function (p) { return p.x + ',' + p.y; }).join(' ');
  }

  SvgGfx.prototype.rect = function (x, y, w, h, opts) {
    this.parts.push('<rect x="' + x + '" y="' + y + '" width="' + Math.max(w, 0) + '" height="' + Math.max(h, 0) + '"' + this._styleAttrs(opts) + '/>');
  };
  SvgGfx.prototype.roundRect = function (x, y, w, h, r, opts) {
    r = Math.min(r, w / 2, h / 2);
    this.parts.push('<rect x="' + x + '" y="' + y + '" width="' + Math.max(w, 0) + '" height="' + Math.max(h, 0) + '" rx="' + r + '" ry="' + r + '"' + this._styleAttrs(opts) + '/>');
  };
  SvgGfx.prototype.ellipse = function (cx, cy, rx, ry, opts) {
    this.parts.push('<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + Math.max(rx, 0.1) + '" ry="' + Math.max(ry, 0.1) + '"' + this._styleAttrs(opts) + '/>');
  };
  SvgGfx.prototype.circle = function (cx, cy, r, opts) { this.ellipse(cx, cy, r, r, opts); };
  SvgGfx.prototype.polygon = function (pts, opts) {
    this.parts.push('<polygon points="' + ptsToStr(pts) + '"' + this._styleAttrs(opts) + '/>');
  };
  SvgGfx.prototype.polyline = function (pts, opts) {
    if (pts.length < 2) return;
    var o = Object.assign({}, opts || {}, { fill: false });
    this.parts.push('<polyline points="' + ptsToStr(pts) + '"' + this._styleAttrs(o) + '/>');
  };
  SvgGfx.prototype.line = function (x1, y1, x2, y2) {
    this.polyline([{ x: x1, y: y1 }, { x: x2, y: y2 }]);
  };
  SvgGfx.prototype.text = function (str, x, y, opts) {
    opts = opts || {};
    var f = opts.font ? OS.text.parseFont(opts.font) : this._font;
    var anchor = opts.align === 'center' ? 'middle' : opts.align === 'right' ? 'end' : 'start';
    var baseline = opts.baseline === 'middle' ? 'central' : opts.baseline === 'bottom' ? 'text-after-edge' : 'text-before-edge';
    if (opts.baseline === 'alphabetic') baseline = 'auto';
    var attrs = ' x="' + x + '" y="' + y + '" font-family="' + this._esc(f.family) + ',Arial,sans-serif" font-size="' + f.size + '"';
    if (f.bold) attrs += ' font-weight="bold"';
    if (f.italic) attrs += ' font-style="italic"';
    attrs += ' text-anchor="' + anchor + '" dominant-baseline="' + baseline + '"';
    attrs += ' fill="' + this._esc(opts.fill || this._fill || '#000') + '"';
    if (this._alpha < 1) attrs += ' opacity="' + this._alpha + '"';
    var deco = f.underline ? ' text-decoration="underline"' : '';
    var lines = String(str).split('\n');
    if (lines.length === 1) {
      this.parts.push('<text' + attrs + deco + '>' + this._esc(str) + '</text>');
    } else {
      var lh = OS.text.lineHeight(f);
      var inner = lines.map(function (ln, i) {
        return '<tspan x="' + x + '" dy="' + (i === 0 ? 0 : lh) + '">' + this._esc(ln) + '</tspan>';
      }, this).join('');
      this.parts.push('<text' + attrs + deco + '>' + inner + '</text>');
    }
  };
  SvgGfx.prototype.measure = function (str, font) { return OS.text.measureText(str, font || this._font); };
  SvgGfx.prototype.lineHeight = function (font) { return OS.text.lineHeight(font || this._font); };

  SvgGfx.prototype.toSvg = function (width, height, opts) {
    opts = opts || {};
    // defensively close any groups left open without a save()
    var loose = this._looseGroups || 0;
    for (var i = 0; i < loose; i++) this.parts.push('</g>');
    this._looseGroups = 0;
    var body = this.parts.join('\n');
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="' +
      (opts.viewBox || ('0 0 ' + width + ' ' + height)) + '">' +
      (opts.background === false ? '' : '<rect x="0" y="0" width="' + width + '" height="' + height + '" fill="' + (opts.background || '#ffffff') + '"/>') +
      body + '</svg>';
  };

  OS.gfx = { CanvasGfx: CanvasGfx, SvgGfx: SvgGfx };
})(typeof window !== 'undefined' ? window : globalThis);
