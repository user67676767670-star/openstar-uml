/*
 * OpenStar UML — font parsing and text measurement.
 * StarUML font strings look like "Arial;13;0" → family;size;style
 * style bits: 1 = bold, 2 = italic, 4 = underline.
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};

  var DEFAULT_FONT = 'Arial;13;0';
  var measureCanvas = null;
  var measureCtx = null;

  function getCtx() {
    if (measureCtx) return measureCtx;
    if (typeof document !== 'undefined') {
      measureCanvas = document.createElement('canvas');
      measureCtx = measureCanvas.getContext('2d');
    }
    return measureCtx;
  }

  /** Parse a StarUML font string. Accepts objects too (idempotent). */
  function parseFont(spec) {
    if (spec && typeof spec === 'object' && spec.family) return spec;
    var parts = String(spec || DEFAULT_FONT).split(';');
    var family = parts[0] || 'Arial';
    var size = parseFloat(parts[1]) || 13;
    var style = parseInt(parts[2], 10) || 0;
    return {
      family: family,
      size: size,
      bold: !!(style & 1),
      italic: !!(style & 2),
      underline: !!(style & 4),
      raw: String(spec || DEFAULT_FONT)
    };
  }

  function fontToCss(f) {
    if (typeof f === 'string') f = parseFont(f);
    return (f.italic ? 'italic ' : '') + (f.bold ? 'bold ' : '') + f.size + 'px "' + f.family + '", Arial, sans-serif';
  }

  function fontToMdj(f) {
    if (typeof f === 'string') return f;
    var style = (f.bold ? 1 : 0) | (f.italic ? 2 : 0) | (f.underline ? 4 : 0);
    return f.family + ';' + f.size + ';' + style;
  }

  function cssFontToSpec(css) {
    // "italic bold 13px Arial" style parse — best effort
    var m = /(\d+(?:\.\d+)?)px/.exec(css || '');
    var size = m ? parseFloat(m[1]) : 13;
    var bold = /\bbold\b/.test(css);
    var italic = /\bitalic\b/.test(css);
    var fam = /px\s+([^;]+)$/.exec(css);
    var family = fam ? fam[1].replace(/["']/g, '').split(',')[0].trim() : 'Arial';
    return fontToMdj({ family: family, size: size, bold: bold, italic: italic, underline: false });
  }

  /** Measure text width in px for a font spec. */
  function measureText(text, font) {
    var f = parseFont(font);
    var ctx = getCtx();
    if (ctx) {
      ctx.font = fontToCss(f);
      return ctx.measureText(String(text)).width;
    }
    // Node fallback: heuristic average char width
    var avg = 0.55;
    var s = String(text);
    var w = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c > 0x2e80) w += f.size * 1.0; // CJK-ish
      else if ('iljtfrI.,:;\'"|![](){} '.indexOf(s[i]) >= 0) w += f.size * 0.33;
      else if ('mwMW@'.indexOf(s[i]) >= 0) w += f.size * 0.82;
      else w += f.size * avg;
    }
    if (f.bold) w *= 1.06;
    return w;
  }

  function lineHeight(font) {
    var f = parseFont(font);
    return Math.round(f.size * 1.4);
  }

  /** Word-wrap text into lines fitting maxWidth. Honors explicit \n. */
  function wrapText(text, font, maxWidth) {
    var f = parseFont(font);
    var result = [];
    var paragraphs = String(text == null ? '' : text).split('\n');
    for (var p = 0; p < paragraphs.length; p++) {
      var para = paragraphs[p];
      if (!maxWidth || measureText(para, f) <= maxWidth || para.indexOf(' ') < 0) {
        result.push(para);
        continue;
      }
      var words = para.split(' ');
      var line = '';
      for (var i = 0; i < words.length; i++) {
        var test = line ? line + ' ' + words[i] : words[i];
        if (measureText(test, f) <= maxWidth || !line) line = test;
        else { result.push(line); line = words[i]; }
      }
      if (line) result.push(line);
    }
    return result;
  }

  function textWidth(text, font) { return measureText(text, font); }

  OS.text = {
    DEFAULT_FONT: DEFAULT_FONT,
    parseFont: parseFont,
    fontToCss: fontToCss,
    fontToMdj: fontToMdj,
    cssFontToSpec: cssFontToSpec,
    measureText: measureText,
    textWidth: textWidth,
    lineHeight: lineHeight,
    wrapText: wrapText
  };
})(typeof window !== 'undefined' ? window : globalThis);
