/*
 * Generates samples/demo.mdj — a demonstration project exercising every
 * diagram type. Run: node scripts/make-sample.js
 */
'use strict';
const path = require('path');
const fs = require('fs');

const R = (p) => require(path.join(__dirname, '..', 'renderer', 'js', p));
['lib/util.js', 'lib/textmetrics.js', 'lib/xml.js', 'core/metamodel.js', 'core/model.js',
  'core/project.js', 'core/clipboard.js', 'gfx/gfx.js', 'diagrams/views.js',
  'formats/mdj.js'].forEach(R);

const { makeDemoProject } = require(path.join(__dirname, '..', 'tests', 'helpers.js'));

const { project } = makeDemoProject();
project.root.name = 'OpenStar Demo';
project.setDirty(false);
project.clearHistory();

// lay the class views out a little more spaciously
const cd = project.diagrams().find((d) => d._type === 'UMLClassDiagram');
cd.ownedViews.forEach((v) => {
  if (v._type === 'UMLNoteView') { v.left = 80; v.top = 320; }
});

const out = OS.Mdj.serialize(project);
const file = path.join(__dirname, '..', 'samples', 'demo.mdj');
fs.writeFileSync(file, out);
console.log('Wrote ' + file + ' (' + out.length + ' bytes)');

// verify it loads back cleanly
const p2 = new OS.Project();
OS.Mdj.load(p2, out);
const out2 = OS.Mdj.serialize(p2);
if (out2 !== out) { console.error('ERROR: sample does not round-trip identically!'); process.exit(1); }
console.log('Round-trip verified ✓ (' + p2.diagrams().length + ' diagrams)');
