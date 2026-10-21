/*
 * OpenStar UML — minimal XML parser & serializer (for XMI import/export).
 * Handles well-formed XML: elements, attributes, text, CDATA, comments,
 * processing instructions, doctype, and namespaces-as-attributes.
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};

  /**
   * Parse an XML string into a tree:
   * { name, attrs: {}, children: [node...], text: 'concatenated text' }
   * Text nodes are stored as { name: '#text', text }.
   * Throws Error with line info on malformed input.
   */
  function parse(str) {
    var pos = 0;
    var root = { name: '#document', attrs: {}, children: [] };
    var stack = [root];

    function top() { return stack[stack.length - 1]; }
    function fail(msg) {
      var upto = str.slice(0, pos);
      var line = upto.split('\n').length;
      throw new Error('XML parse error at line ' + line + ': ' + msg);
    }

    function skipWs() { while (pos < str.length && /\s/.test(str[pos])) pos++; }

    function parseAttrs(tag) {
      var attrs = {};
      var re = /([\w:.\-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
      var m;
      while ((m = re.exec(tag)) !== null) {
        attrs[m[1]] = decodeEntities(m[3] !== undefined ? m[3] : m[4]);
      }
      return attrs;
    }

    function parseName() {
      var m = /^([\w:.\-]+)/.exec(str.slice(pos));
      if (!m) fail('expected tag name');
      pos += m[1].length;
      return m[1];
    }

    while (pos < str.length) {
      if (str[pos] === '<') {
        if (str.startsWith('<!--', pos)) {
          var endC = str.indexOf('-->', pos);
          if (endC < 0) fail('unterminated comment');
          pos = endC + 3;
          continue;
        }
        if (str.startsWith('<![CDATA[', pos)) {
          var endD = str.indexOf(']]>', pos);
          if (endD < 0) fail('unterminated CDATA');
          var cdata = str.slice(pos + 9, endD);
          top().children.push({ name: '#text', text: cdata });
          pos = endD + 3;
          continue;
        }
        if (str.startsWith('<?', pos)) {
          var endP = str.indexOf('?>', pos);
          if (endP < 0) fail('unterminated processing instruction');
          pos = endP + 2;
          continue;
        }
        if (str.startsWith('<!', pos)) {
          // DOCTYPE or other declaration: skip, handling internal subset
          var depth = 0, i = pos;
          while (i < str.length) {
            if (str[i] === '[') depth++;
            else if (str[i] === ']') depth--;
            else if (str[i] === '>' && depth <= 0) break;
            i++;
          }
          if (i >= str.length) fail('unterminated declaration');
          pos = i + 1;
          continue;
        }
        if (str[pos + 1] === '/') {
          var endClose = str.indexOf('>', pos);
          if (endClose < 0) fail('unterminated close tag');
          var closeName = str.slice(pos + 2, endClose).trim();
          if (stack.length <= 1) fail('unexpected closing tag </' + closeName + '>');
          var openName = top().name;
          if (openName !== closeName) fail('mismatched tag: <' + openName + '> closed by </' + closeName + '>');
          stack.pop();
          pos = endClose + 1;
          continue;
        }
        // open tag
        var gt = str.indexOf('>', pos);
        if (gt < 0) fail('unterminated open tag');
        var tagSrc = str.slice(pos + 1, gt);
        var selfClosing = /\/\s*$/.test(tagSrc);
        if (selfClosing) tagSrc = tagSrc.replace(/\/\s*$/, '');
        pos = gt + 1;
        var nameMatch = /^([\w:.\-]+)/.exec(tagSrc);
        if (!nameMatch) fail('invalid tag: <' + tagSrc.slice(0, 20) + '>');
        var el = {
          name: nameMatch[1],
          attrs: parseAttrs(tagSrc.slice(nameMatch[1].length)),
          children: [],
          text: ''
        };
        top().children.push(el);
        if (!selfClosing) stack.push(el);
      } else {
        var next = str.indexOf('<', pos);
        if (next < 0) next = str.length;
        var txt = str.slice(pos, next);
        pos = next;
        if (txt.trim().length > 0) {
          top().children.push({ name: '#text', text: decodeEntities(txt) });
        }
      }
    }
    if (stack.length !== 1) fail('unclosed tag <' + top().name + '>');

    // fill concatenated text on elements
    (function fill(node) {
      if (!node.children) return;
      var t = '';
      for (var i = 0; i < node.children.length; i++) {
        var c = node.children[i];
        if (c.name === '#text') t += c.text;
        else fill(c);
      }
      node.text = t;
    })(root);
    return root;
  }

  function decodeEntities(s) {
    return String(s)
      .replace(/&#x([0-9a-fA-F]+);/g, function (_, h) { return String.fromCodePoint(parseInt(h, 16)); })
      .replace(/&#(\d+);/g, function (_, d) { return String.fromCodePoint(parseInt(d, 10)); })
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  }

  function escapeText(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/\n/g, '&#10;').replace(/\r/g, '&#13;').replace(/\t/g, '&#9;');
  }

  /** Find first descendant element whose name matches (ignoring ns prefix if bare given). */
  function findChild(node, name) {
    if (!node || !node.children) return null;
    for (var i = 0; i < node.children.length; i++) {
      var c = node.children[i];
      if (c.name === name || stripNs(c.name) === name) return c;
    }
    return null;
  }
  function findChildren(node, name) {
    var out = [];
    if (!node || !node.children) return out;
    for (var i = 0; i < node.children.length; i++) {
      var c = node.children[i];
      if (c.name === name || stripNs(c.name) === name) out.push(c);
    }
    return out;
  }
  function descendants(node, name, out) {
    out = out || [];
    if (!node || !node.children) return out;
    for (var i = 0; i < node.children.length; i++) {
      var c = node.children[i];
      if (name === undefined || c.name === name || stripNs(c.name) === name) out.push(c);
      descendants(c, name, out);
    }
    return out;
  }
  function stripNs(name) {
    var i = name.indexOf(':');
    return i >= 0 ? name.slice(i + 1) : name;
  }

  /** Serialize a simple node tree ({name, attrs, children:[node|string]}) to XML string. */
  function serialize(root, opts) {
    opts = opts || {};
    var indent = opts.indent === undefined ? '  ' : opts.indent;
    var lines = [];
    if (opts.header !== false) {
      lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    }
    (function walk(node, depth) {
      var pad = indent ? new Array(depth + 1).join(indent) : '';
      var attrs = '';
      if (node.attrs) {
        for (var k in node.attrs) {
          if (node.attrs[k] !== undefined && node.attrs[k] !== null && node.attrs[k] !== '') {
            attrs += ' ' + k + '="' + escapeAttr(node.attrs[k]) + '"';
          }
        }
      }
      var kids = (node.children || []).filter(function (c) {
        return typeof c === 'string' ? c.length > 0 : !!c;
      });
      if (kids.length === 0 && !node.text) {
        lines.push(pad + '<' + node.name + attrs + '/>');
        return;
      }
      if (node.text && kids.length === 0) {
        lines.push(pad + '<' + node.name + attrs + '>' + escapeText(node.text) + '</' + node.name + '>');
        return;
      }
      // pure-text children: emit inline (no extra whitespace inside the element)
      if (kids.every(function (c) { return typeof c === 'string'; })) {
        lines.push(pad + '<' + node.name + attrs + '>' + kids.map(escapeText).join('') + '</' + node.name + '>');
        return;
      }
      lines.push(pad + '<' + node.name + attrs + '>');
      for (var i = 0; i < kids.length; i++) {
        if (typeof kids[i] === 'string') {
          lines.push(pad + indent + escapeText(kids[i]));
        } else {
          walk(kids[i], depth + 1);
        }
      }
      lines.push(pad + '</' + node.name + '>');
    })(root, 0);
    return lines.join('\n');
  }

  function el(name, attrs, children) {
    return { name: name, attrs: attrs || {}, children: children || [] };
  }

  OS.xml = {
    parse: parse,
    serialize: serialize,
    el: el,
    findChild: findChild,
    findChildren: findChildren,
    descendants: descendants,
    stripNs: stripNs,
    decodeEntities: decodeEntities,
    escapeText: escapeText,
    escapeAttr: escapeAttr
  };
})(typeof window !== 'undefined' ? window : globalThis);
