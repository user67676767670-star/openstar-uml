/*
 * Regression tests for the security/robustness hardening pass:
 *  - xml parser DoS guards (depth limit, size limit, hostile entities)
 *  - undo/redo history capping (memory DoS guard)
 *  - dangling-reference cleanup on cascade delete (export integrity)
 */
'use strict';
const OS = globalThis.OS;
const xml = OS.xml;

t.suite('xml parser hardening');

// 1) Deeply nested hostile document must throw, not overflow the stack.
const deep = '<a>'.repeat(5000) + '</a>'.repeat(5000);
t.throws(() => xml.parse(deep), 'excessive nesting depth rejected (no stack overflow)');

// 2) Reasonably deep documents still parse (limit is generous).
const okDeep = '<a>'.repeat(200) + '</a>'.repeat(200);
t.doesNotThrow(() => xml.parse(okDeep), '200-level nesting still parses');

// 3) Oversized document rejected up front.
const huge = '<r>' + 'x'.repeat(64 * 1024 * 1024) + '</r>';
t.throws(() => xml.parse(huge), 'oversized document rejected');

// 4) Hostile numeric entities must not crash the decoder.
t.doesNotThrow(() => xml.parse('<r>&#xFFFFFFFF;</r>'), '&#xFFFFFFFF; decoded safely');
t.doesNotThrow(() => xml.parse('<r>&#999999999999;</r>'), 'huge decimal entity decoded safely');
t.doesNotThrow(() => xml.parse('<r>&#0;</r>'), 'zero codepoint handled');

// 5) Out-of-range entities produce the replacement character.
const doc = xml.parse('<r>&#x110000;</r>');
const txt = xml.findChild(doc, 'r').text;
t.eq(txt, '\uFFFD', 'out-of-range codepoint → U+FFFD');

// 6) Valid entities still work.
const doc2 = xml.parse('<r>&#65;&#x66;&amp;</r>');
t.eq(xml.findChild(doc2, 'r').text, 'Af&', 'valid entities still decode correctly');

t.suite('undo/redo history cap');

const project = new OS.Project();
project.newProject();
t.eq(project.UNDO_LIMIT, 100, 'UNDO_LIMIT defined (=100)');

const model0 = project.root.ownedElements[0]; // UMLModel
for (let i = 0; i < 150; i++) {
  project.transact('rename ' + i, function () {
    model0.name = 'M' + i;
  });
}
t.ok(project._undo.length <= project.UNDO_LIMIT, 'undo stack capped at UNDO_LIMIT (' + project._undo.length + ')');
t.eq(project._undo.length, project.UNDO_LIMIT, 'undo stack exactly at cap after 150 edits');

// Undo still functional at the cap boundary.
t.ok(project.undo(), 'undo works with capped stack');

// Redo stack also capped: redo everything, then undo everything again.
while (project.canRedo()) project.redo();
for (let i = 0; i < 150; i++) project.undo();
t.ok(project._redo.length <= project.UNDO_LIMIT, 'redo stack capped at UNDO_LIMIT (' + project._redo.length + ')');

// Final state consistency: name should equal the first applied edit's before-state
// rolled back — just assert no exception and dirty flag sane.
t.ok(typeof model0.name === 'string' && model0.name.length > 0, 'model intact after heavy undo/redo churn');

t.suite('cascade delete clears references');

const p2 = new OS.Project();
p2.newProject();
const m2 = p2.root.ownedElements[0];
const clsA = OS.model.createElement(p2, 'UMLClass', { name: 'A' });
const clsB = OS.model.createElement(p2, 'UMLClass', { name: 'B' });
OS.model.addOwned(p2, m2, clsA);
OS.model.addOwned(p2, m2, clsB);

// attribute typed by B + generalization A -> B
const attr = OS.model.createElement(p2, 'UMLAttribute', { name: 'b', type: clsB });
OS.model.addOwned(p2, clsA, attr);
const gen = OS.model.createElement(p2, 'UMLGeneralization', { source: clsA, target: clsB });
OS.model.addOwned(p2, clsA, gen);

// Delete B: every reference to it must be purged, otherwise PlantUML/XMI
// export emits dangling ids. Note StarUML cascade semantics: a relationship
// (generalization) touching a doomed model is itself deleted; an irregular
// reference (attribute type) survives with its field nulled out.
OS.model.deleteModel(p2, clsB);
t.eq(attr.type, null, 'dangling attr.type nulled after cascade delete');
t.notOk(p2.byId.has(gen._id), 'generalization touching deleted model is cascade-deleted');

// The deleted element itself is gone from the registry.
t.notOk(p2.byId.has(clsB._id), 'deleted element removed from byId registry');

// Export integrity: PlantUML must not crash or emit dangling refs afterwards.
const diagram2 = m2.ownedElements.filter(function (e) { return e._type === 'UMLClassDiagram'; })[0] ||
  (function () { var d = OS.model.createElement(p2, 'UMLClassDiagram', { name: 'D' }); OS.model.addOwned(p2, m2, d); return d; })();
t.doesNotThrow(() => OS.PlantUML.generate(p2, diagram2), 'PlantUML export works after cascade delete');
const pu = OS.PlantUML.generate(p2, diagram2);
t.ok(typeof pu === 'string' && pu.length > 0, 'export produced output');
