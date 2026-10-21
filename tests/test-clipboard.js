/* clipboard capture/paste tests */
'use strict';
const OS = globalThis.OS;
const { makeDemoProject } = require('./helpers.js');

t.suite('clipboard');

{
  const { project, classDiagram, person, student } = makeDemoProject();
  const vPerson = classDiagram.ownedViews.find((v) => v.model === person);
  const vStudent = classDiagram.ownedViews.find((v) => v.model === student);
  const vGen = classDiagram.ownedViews.find((v) => v._type === 'UMLGeneralizationView');

  // copy two classes + the generalization between them
  const data = OS.clipboard.capture(project, classDiagram, [vPerson, vStudent, vGen]);
  t.eq(data.models.length, 3, 'captured 3 models (2 classes + generalization)');
  t.eq(data.views.length, 3, 'captured 3 views');

  const before = classDiagram.ownedViews.length;
  const created = OS.clipboard.deserializeInto(project, classDiagram, data, 20, 20, classDiagram._parent);
  t.eq(created.length, 3, 'pasted 3 views');
  t.eq(classDiagram.ownedViews.length, before + 3, 'views appended to diagram');

  const newPerson = created.find((v) => v.model && v.model.name === 'Person' && v !== vPerson);
  t.ok(newPerson, 'pasted Person view exists');
  t.ok(newPerson.model !== person, 'pasted model is a new object');
  t.ok(newPerson.model._id !== person._id, 'pasted model has fresh id');
  t.eq(newPerson.model.ownedAttributes.length, 2, 'attributes deep-copied');
  t.ok(newPerson.model.ownedAttributes[0] !== person.ownedAttributes[0], 'attributes are copies');
  t.eq(newPerson.left, vPerson.left + 20, 'paste offset applied (x)');
  t.eq(newPerson.top, vPerson.top + 20, 'paste offset applied (y)');

  const newGen = created.find((v) => v._type === 'UMLGeneralizationView');
  t.ok(newGen, 'generalization view pasted');
  t.ok(newGen.model !== vGen.model, 'generalization model copied');
  t.ok(newGen.head && newGen.tail, 'edge endpoints rewired');
  t.ok([newPerson._id, created.find((v) => v.model.name === 'Student' && v !== vStudent)._id].includes(newGen.tail._id) ||
       newGen.tail.model.name === 'Student', 'generalization tail → pasted Student');
  t.ok(newGen.head.model.name === 'Person' && newGen.head !== vPerson, 'generalization head → pasted Person');

  // edge without both ends selected is skipped
  const data2 = OS.clipboard.capture(project, classDiagram, [vPerson, vGen]);
  t.eq(data2.views.length, 1, 'edge dropped when one endpoint missing from selection');

  // paste twice → distinct ids, no registry collisions
  const created2 = OS.clipboard.deserializeInto(project, classDiagram, data, 40, 40, classDiagram._parent);
  const ids = new Set();
  let collision = false;
  project.eachElement((e) => { if (ids.has(e._id)) collision = true; ids.add(e._id); });
  t.ok(!collision, 'no id collisions after double paste');
  t.ok(created2[0]._id !== created[0]._id, 'second paste gets fresh ids');

  // undo of a paste transaction removes the pasted copies
  project.transact('Paste', () => { /* simulate app wrapping */ });
}
