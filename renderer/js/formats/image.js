/*
 * OpenStar UML — image export (PNG via canvas, SVG via SvgGfx).
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};
  var views = OS.views;

  function renderTo(gfx, diagram, bounds) {
    gfx.save();
    gfx.translate(-bounds.x, -bounds.y);
    var ctx = { diagram: diagram, project: null, exporting: true };
    views.prepareDiagram(diagram);
    views.drawOrder(diagram).forEach(function (v) {
      if (v.visible === false) return;
      gfx.save();
      views.draw(gfx, v, ctx);
      gfx.restore();
    });
    gfx.restore();
  }

  /** Render a diagram to an offscreen canvas at `scale`. Browser only. */
  function toCanvas(diagram, scale, opts) {
    scale = scale || 2;
    opts = opts || {};
    var b = views.diagramBounds(diagram, opts.padding === undefined ? 20 : opts.padding);
    var canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(b.width * scale));
    canvas.height = Math.max(1, Math.ceil(b.height * scale));
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = opts.background || '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    var gfx = new OS.gfx.CanvasGfx(ctx);
    renderTo(gfx, diagram, b);
    return { canvas: canvas, bounds: b };
  }

  function toPNGDataUrl(diagram, scale, opts) {
    return toCanvas(diagram, scale, opts).canvas.toDataURL('image/png');
  }

  function toSVG(diagram, opts) {
    opts = opts || {};
    var b = views.diagramBounds(diagram, opts.padding === undefined ? 20 : opts.padding);
    var gfx = new OS.gfx.SvgGfx();
    renderTo(gfx, diagram, b);
    return gfx.toSvg(Math.ceil(b.width), Math.ceil(b.height), {
      background: opts.background || '#ffffff'
    });
  }

  OS.Image = {
    toCanvas: toCanvas,
    toPNGDataUrl: toPNGDataUrl,
    toSVG: toSVG
  };
})(typeof window !== 'undefined' ? window : globalThis);
