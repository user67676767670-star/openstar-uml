/*
 * Renders every diagram of samples/demo.mdj to SVG files in samples/
 * using the exact same drawing code the app uses (headless, via SvgGfx).
 * Run: node scripts/export-sample-svgs.js
 */
'use strict';
const path = require('path');
const fs = require('fs');

const R = (p) => require(path.join(__dirname, '..', 'renderer', 'js', p));
['lib/util.js', 'lib/textmetrics.js', 'lib/xml.js', 'core/metamodel.js', 'core/model.js',
  'core/project.js', 'core/clipboard.js', 'gfx/gfx.js', 'diagrams/views.js',
  'formats/mdj.js', 'formats/image.js'].forEach(R);

const project = new OS.Project();
OS.Mdj.load(project, fs.readFileSync(path.join(__dirname, '..', 'samples', 'demo.mdj'), 'utf8'));

const outDir = path.join(__dirname, '..', 'samples');
project.diagrams().forEach((d) => {
  const svg = OS.Image.toSVG(d);
  // sanity: must be parseable XML
  OS.xml.parse(svg);
  const name = (d.name || 'diagram').replace(/[^\w\-]+/g, '_') + '.svg';
  fs.writeFileSync(path.join(outDir, name), svg);
  console.log('  ✓ ' + name + ' (' + (d.ownedViews || []).length + ' views)');
});
console.log('Sample SVGs written to samples/');
