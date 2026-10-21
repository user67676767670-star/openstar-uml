/* geometry & utility tests */
'use strict';
const OS = globalThis.OS;
const u = OS.util;

t.suite('util / geometry');

t.ok(u.genId() !== u.genId(), 'genId produces unique ids');
t.ok(/^[A-Za-z0-9+/]+={1,2}$/.test(u.genId()), 'genId is base64-shaped like StarUML ids');

const c = u.clone({ a: 1, b: [1, 2, { c: 3 }] });
c.b[2].c = 9;
t.eq(c.b[2].c, 9, 'clone is deep (mutated copy)');

t.ok(u.deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), 'deepEqual structural');
t.ok(!u.deepEqual({ a: 1 }, { a: 2 }), 'deepEqual detects difference');

const r = { x: 0, y: 0, width: 10, height: 10 };
t.ok(u.containsPoint(r, { x: 5, y: 5 }), 'containsPoint inside');
t.ok(!u.containsPoint(r, { x: 15, y: 5 }), 'containsPoint outside');
t.ok(u.intersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }), 'intersects true');
t.ok(!u.intersects({ x: 0, y: 0, width: 10, height: 10 }, { x: 50, y: 50, width: 10, height: 10 }), 'intersects false');

// ray from center to the right hits the right edge at x=10
const hit = u.rectLineIntersection(r, { x: 5, y: 5 }, { x: 20, y: 5 });
t.ok(hit && Math.abs(hit.x - 10) < 1e-6 && Math.abs(hit.y - 5) < 1e-6, 'rectLineIntersection right edge');

const hit2 = u.rectLineIntersection(r, { x: 5, y: 5 }, { x: 5, y: -20 });
t.ok(hit2 && Math.abs(hit2.y - 0) < 1e-6, 'rectLineIntersection top edge');

const ea = u.ellipseAnchor({ x: 0, y: 0, width: 20, height: 10 }, { x: 100, y: 5 });
t.ok(Math.abs(ea.x - 20) < 1e-6 && Math.abs(ea.y - 5) < 1e-6, 'ellipseAnchor hits right boundary');
const ea2 = u.ellipseAnchor({ x: 0, y: 0, width: 20, height: 10 }, { x: 10, y: -100 });
t.ok(Math.abs(ea2.y - 0) < 1e-6 && Math.abs(ea2.x - 10) < 1e-6, 'ellipseAnchor hits top boundary');

t.ok(Math.abs(u.dist({ x: 0, y: 0 }, { x: 3, y: 4 }) - 5) < 1e-9, 'dist 3-4-5');

t.ok(Math.abs(u.distToSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 }) - 5) < 1e-9, 'distToSegment perpendicular');
t.ok(Math.abs(u.distToSegment({ x: -5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 }) - 5) < 1e-9, 'distToSegment clamps to endpoint');

const pp = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
t.ok(Math.abs(u.polyLength(pp) - 20) < 1e-9, 'polyLength');
const mid = u.pointOnPolyline(pp, 0.5);
t.ok(Math.abs(mid.x - 10) < 1e-9 && Math.abs(mid.y) < 1e-9, 'pointOnPolyline midpoint at corner');

const nr = u.normalizeRect({ x: 10, y: 10 }, { x: 2, y: 4 });
t.eq(nr, { x: 2, y: 4, width: 8, height: 6 }, 'normalizeRect');

t.eq(u.snap(13, 8, true), 16, 'snap to grid');
t.eq(u.snap(13, 8, false), 13, 'snap disabled passthrough');

t.eq(u.xmlEscape('<a & "b">'), '&lt;a &amp; &quot;b&quot;&gt;', 'xmlEscape');

const arr = [1, 2, 3];
t.ok(u.removeItem(arr, 2) && arr.length === 2, 'removeItem');
