/*
 * OpenStar UML — test harness (pure Node, no Electron/DOM needed).
 * Loads the shared modules onto globalThis, then runs all test files.
 */
'use strict';
const path = require('path');

const R = (p) => require(path.join(__dirname, '..', 'renderer', 'js', p));

// load order matters (later files may use earlier ones at call time only,
// but keep a sane order anyway)
[
  'lib/util.js',
  'lib/textmetrics.js',
  'lib/xml.js',
  'core/metamodel.js',
  'core/model.js',
  'core/project.js',
  'core/clipboard.js',
  'gfx/gfx.js',
  'diagrams/views.js',
  'formats/mdj.js',
  'formats/xmi.js',
  'formats/plantuml.js',
  'formats/markdown.js',
  'formats/image.js'
].forEach(R);

/* -------- micro test framework -------- */
let passed = 0, failed = 0;
const failures = [];
let currentSuite = '';

global.t = {
  suite(name) { currentSuite = name; console.log('\n▸ ' + name); },
  ok(cond, msg) {
    if (cond) { passed++; console.log('  ✓ ' + msg); }
    else { failed++; failures.push(currentSuite + ': ' + msg); console.log('  ✗ ' + msg); }
  },
  eq(a, b, msg) {
    const ok = JSON.stringify(a) === JSON.stringify(b);
    if (ok) { passed++; console.log('  ✓ ' + msg); }
    else {
      failed++; failures.push(currentSuite + ': ' + msg);
      console.log('  ✗ ' + msg);
      console.log('      expected: ' + JSON.stringify(b));
      console.log('      actual:   ' + JSON.stringify(a));
    }
  },
  throws(fn, msg) {
    try { fn(); failed++; failures.push(currentSuite + ': ' + msg); console.log('  ✗ ' + msg + ' (did not throw)'); }
    catch (e) { passed++; console.log('  ✓ ' + msg); }
  },
  doesNotThrow(fn, msg) {
    try { fn(); passed++; console.log('  ✓ ' + msg); }
    catch (e) {
      failed++; failures.push(currentSuite + ': ' + msg + ' → ' + (e && e.stack || e));
      console.log('  ✗ ' + msg + ' → ' + (e && e.message || e));
    }
  }
};

const suites = [
  './test-util.js',
  './test-xml.js',
  './test-model.js',
  './test-views.js',
  './test-mdj.js',
  './test-xmi.js',
  './test-plantuml.js',
  './test-markdown.js',
  './test-clipboard.js',
  './test-main-menu.js',
  './test-ui.js'
];

console.log('OpenStar UML — test suite');
const pending = [];
for (const s of suites) {
  try {
    const m = require(path.join(__dirname, s));
    if (m && typeof m.then === 'function') pending.push(m);
  }
  catch (e) { failed++; failures.push(s + ' crashed: ' + (e && e.stack || e)); console.log('  ✗ SUITE CRASH ' + s + ': ' + (e && e.message || e)); }
}

Promise.all(pending).then(() => {
  console.log('\n────────────────────────────────');
  console.log(`Result: ${passed} passed, ${failed} failed`);
  if (failed) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log('  • ' + f));
    process.exit(1);
  } else {
    console.log('All tests passed ✓');
  }
});
