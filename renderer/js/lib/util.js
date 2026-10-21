/*
 * OpenStar UML — core utilities
 * Shared by browser renderer and Node (tests). Attaches to global OS namespace.
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};

  /* ---------- ID generation (StarUML-compatible looking base64 ids) ---------- */

  var ID_COUNTER = 0;
  function randomBytes(n) {
    var arr = new Uint8Array(n);
    if (global.crypto && global.crypto.getRandomValues) {
      global.crypto.getRandomValues(arr);
    } else {
      for (var i = 0; i < n; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }
  function bytesToBase64(bytes) {
    if (typeof btoa === 'function') {
      var s = '';
      for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return btoa(s);
    }
    return Buffer.from(bytes).toString('base64');
  }
  /** Generate a unique id in the same shape as StarUML ("AAAA...=" base64, 24 chars). */
  function genId() {
    ID_COUNTER++;
    var b = randomBytes(15);
    // mix counter so ids generated in the same millisecond still differ deterministically-ish
    b[0] = (b[0] + ID_COUNTER) & 0xff;
    return bytesToBase64(b) + '=';
  }

  /* ---------- cloning & equality ---------- */

  function clone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(clone);
    var out = {};
    for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = clone(obj[k]);
    return out;
  }

  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null) return false;
    if (typeof a !== 'object') return false;
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (var i = 0; i < ka.length; i++) if (!deepEqual(a[ka[i]], b[ka[i]])) return false;
    return true;
  }

  /* ---------- geometry ---------- */

  function Rect(x, y, w, h) { return { x: x, y: y, width: w, height: h }; }
  function rectOf(view) {
    return { x: view.left || 0, y: view.top || 0, width: view.width || 0, height: view.height || 0 };
  }
  function containsPoint(r, p, pad) {
    pad = pad || 0;
    return p.x >= r.x - pad && p.x <= r.x + r.width + pad &&
           p.y >= r.y - pad && p.y <= r.y + r.height + pad;
  }
  function containsRect(outer, inner) {
    return inner.x >= outer.x && inner.y >= outer.y &&
      inner.x + inner.width <= outer.x + outer.width &&
      inner.y + inner.height <= outer.y + outer.height;
  }
  function intersects(a, b) {
    return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
  }
  function center(r) { return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }

  /** Distance from point p to segment ab. */
  function distToSegment(p, a, b) {
    var vx = b.x - a.x, vy = b.y - a.y;
    var wx = p.x - a.x, wy = p.y - a.y;
    var len2 = vx * vx + vy * vy;
    var t = len2 > 0 ? (wx * vx + wy * vy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    var dx = a.x + t * vx - p.x, dy = a.y + t * vy - p.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Intersection of segment p1->p2 with rectangle r (from inside out). Returns point or null. */
  function rectLineIntersection(r, p1, p2) {
    var tmin = Infinity, hit = null;
    var edges = [
      [{ x: r.x, y: r.y }, { x: r.x + r.width, y: r.y }],
      [{ x: r.x + r.width, y: r.y }, { x: r.x + r.width, y: r.y + r.height }],
      [{ x: r.x, y: r.y + r.height }, { x: r.x + r.width, y: r.y + r.height }],
      [{ x: r.x, y: r.y }, { x: r.x, y: r.y + r.height }]
    ];
    for (var i = 0; i < edges.length; i++) {
      var t = segSegIntersection(p1, p2, edges[i][0], edges[i][1]);
      if (t !== null && t < tmin) { tmin = t; hit = { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t }; }
    }
    return hit;
  }

  /** Intersection parameter t along p1->p2 with segment q1->q2. Null if none. */
  function segSegIntersection(p1, p2, q1, q2) {
    var rx = p2.x - p1.x, ry = p2.y - p1.y;
    var sx = q2.x - q1.x, sy = q2.y - q1.y;
    var denom = rx * sy - ry * sx;
    if (Math.abs(denom) < 1e-9) return null;
    var t = ((q1.x - p1.x) * sy - (q1.y - p1.y) * sx) / denom;
    var u = ((q1.x - p1.x) * ry - (q1.y - p1.y) * rx) / denom;
    if (t >= -1e-6 && t <= 1 + 1e-6 && u >= -1e-6 && u <= 1 + 1e-6) return Math.max(0, Math.min(1, t));
    return null;
  }

  /** Ellipse boundary point from center toward p. */
  function ellipseAnchor(r, p) {
    var c = center(r);
    var dx = p.x - c.x, dy = p.y - c.y;
    var a = r.width / 2, b = r.height / 2;
    if (a <= 0 || b <= 0) return { x: c.x, y: c.y };
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return { x: c.x + a, y: c.y };
    var t = 1 / Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b));
    return { x: c.x + dx * t, y: c.y + dy * t };
  }

  /** Rounded-rectangle boundary point from center toward p. */
  function roundRectAnchor(r, p, radius) {
    // approximate with rect intersection; good enough visually
    var c = center(r);
    var hit = rectLineIntersection(r, c, p);
    return hit || { x: c.x, y: c.y };
  }

  function polyLength(pts) {
    var len = 0;
    for (var i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i]);
    return len;
  }

  /** Point at distance ratio [0..1] along polyline + tangent angle. */
  function pointOnPolyline(pts, ratio) {
    var total = polyLength(pts);
    var target = total * Math.max(0, Math.min(1, ratio));
    var acc = 0;
    for (var i = 1; i < pts.length; i++) {
      var seg = dist(pts[i - 1], pts[i]);
      if (acc + seg >= target || i === pts.length - 1) {
        var t = seg > 0 ? (target - acc) / seg : 0;
        return {
          x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
          y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
          angle: Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x)
        };
      }
      acc += seg;
    }
    return { x: pts[0].x, y: pts[0].y, angle: 0 };
  }

  /** Position a label using StarUML-style alpha (radians from segment) + distance. */
  function labelAnchor(pts, ratio, alpha, distance) {
    var base = pointOnPolyline(pts, ratio);
    var a = base.angle + (alpha || 0);
    var d = distance || 0;
    return { x: base.x + Math.cos(a) * d, y: base.y + Math.sin(a) * d };
  }

  function snap(v, grid, enabled) {
    if (!enabled || !grid) return v;
    return Math.round(v / grid) * grid;
  }

  function normalizeRect(a, b) {
    return {
      x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
      width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y)
    };
  }

  /* ---------- strings ---------- */

  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function xmlEscape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  function typeLabel(t) {
    if (!t) return '';
    if (typeof t === 'string') return t;
    if (t.$ref) return '«ref»';
    return '';
  }

  /* ---------- arrays ---------- */

  function removeItem(arr, item) {
    var i = arr.indexOf(item);
    if (i >= 0) { arr.splice(i, 1); return true; }
    return false;
  }

  function byId(arr, id) {
    for (var i = 0; i < arr.length; i++) if (arr[i]._id === id) return arr[i];
    return null;
  }

  OS.util = {
    genId: genId,
    clone: clone,
    deepEqual: deepEqual,
    Rect: Rect, rectOf: rectOf, center: center, dist: dist,
    containsPoint: containsPoint, containsRect: containsRect, intersects: intersects,
    rectLineIntersection: rectLineIntersection, segSegIntersection: segSegIntersection,
    ellipseAnchor: ellipseAnchor, roundRectAnchor: roundRectAnchor,
    polyLength: polyLength, pointOnPolyline: pointOnPolyline, labelAnchor: labelAnchor,
    snap: snap, normalizeRect: normalizeRect, distToSegment: distToSegment,
    capitalize: capitalize, xmlEscape: xmlEscape,
    removeItem: removeItem, byId: byId
  };
})(typeof window !== 'undefined' ? window : globalThis);
