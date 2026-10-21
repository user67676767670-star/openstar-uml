/* model runtime + project transactions tests */
'use strict';
const OS = globalThis.OS;
const { makeDemoProject } = require('./helpers.js');

t.suite('model runtime');

{
  const { project, m, person, student, assoc } = makeDemoProject();
  t.eq(project.root.name, 'Untitled', 'project name default');
  t.eq(project.root.ownedElements.length, 1, 'one root model');
  t.eq(m.ownedElements.filter((e) => e._type === 'UMLClass').length, 2, 'two classes in model');

  // registry lookups
  t.ok(project.get(person._id) === person, 'registry resolves by id');
  t.eq(project.diagrams().length, 7, 'seven diagrams registered');

  // unique naming
  const dup = project.createElement(m, 'UMLClass', {});
  t.eq(dup.name, 'Class1', 'auto name Class1');
  const dup2 = project.createElement(m, 'UMLClass', {});
  t.eq(dup2.name, 'Class2', 'auto name Class2 increments');

  // display formatting
  const attr = person.ownedAttributes[0];
  t.eq(OS.model.formatAttribute(attr, {}), '-id : int = 0', 'attribute formatting (private, type, default)');
  const op = person.ownedOperations[0];
  t.eq(OS.model.formatOperation(op, {}), '+getName() : String', 'operation formatting with return param');

  const p1 = OS.model.createElement(project, 'UMLParameter', { name: 'x', type: 'int', direction: 'in' });
  const p2 = OS.model.createElement(project, 'UMLParameter', { name: 'out', type: 'bool', direction: 'out' });
  const op2 = OS.model.createElement(project, 'UMLOperation', { name: 'f' });
  OS.model.addOwned(project, op2, p1, 'parameters');
  OS.model.addOwned(project, op2, p2, 'parameters');
  t.eq(OS.model.formatOperation(op2, {}), '+f(x : int, out out : bool)', 'parameter directions');

  t.eq(OS.model.formatTransition({ name: '', trigger: 'pay', guard: 'amount>0', effect: 'ship' }), 'pay [amount>0] / ship', 'transition label');
  t.eq(OS.model.formatMessage({ name: 'submitOrder', arguments: 'cart' }), 'submitOrder(cart)', 'message label');
  t.eq(OS.model.visibilityMark('protected'), '#', 'visibility marks');
}

t.suite('deletion cascade');
{
  const { project, m, person, student, assoc, classDiagram } = makeDemoProject();
  const before = classDiagram.ownedViews.length;
  // delete Person → generalization + association models gone, their views gone
  project.transact('delete person', () => OS.model.deleteModel(project, person));
  t.ok(!project.get(person._id), 'person unregistered');
  t.ok(!project.get(assoc._id), 'association (touching person) removed');
  t.ok(!project.get(student._id) === false, 'student survives');
  const dangling = classDiagram.ownedViews.filter((v) => v.model && !project.get(v.model._id));
  t.eq(dangling.length, 0, 'no views reference deleted models');
  t.ok(classDiagram.ownedViews.length < before, 'views removed from diagram');
}

t.suite('view deletion');
{
  const { project, classDiagram, person } = makeDemoProject();
  const vPerson = classDiagram.ownedViews.find((v) => v.model === person);
  const assocView = classDiagram.ownedViews.find((v) => v._type === 'UMLAssociationView');
  project.transact('delete view', () => OS.model.deleteView(project, vPerson));
  t.ok(classDiagram.ownedViews.indexOf(vPerson) < 0, 'view removed');
  t.ok(classDiagram.ownedViews.indexOf(assocView) < 0, 'attached edge views removed');
  t.ok(!project.get(assocView.model._id), 'edge model deleted with its view');
  t.ok(project.get(person._id), 'node model survives view deletion');
}

t.suite('transactions / undo / redo');
{
  const { project } = makeDemoProject();
  let person = project.models().find((m) => m.name === 'Person');
  const pid = person._id;
  const P = () => project.get(pid); // always resolve the CURRENT object
  t.ok(!project.canUndo(), 'clean project: nothing to undo');
  project.transact('Rename', () => { P().name = 'Human'; });
  t.eq(P().name, 'Human', 'transact applied');
  t.ok(project.canUndo(), 'undo available');
  t.ok(project.dirty, 'project dirty after change');
  project.undo();
  t.eq(P().name, 'Person', 'undo restored name');
  t.ok(project.canRedo(), 'redo available');
  project.redo();
  t.eq(P().name, 'Human', 'redo re-applied');

  // nested transactions merge
  project.transact('outer', () => {
    P().name = 'A';
    project.transact('inner', () => { P().name = 'B'; });
  });
  t.eq(P().name, 'B', 'nested transaction applied');
  project.undo();
  t.eq(P().name, 'Human', 'nested transactions undo as one');

  // failed transaction rolls back
  let threw = false;
  try {
    project.transact('boom', () => { P().name = 'CORRUPT'; throw new Error('fail'); });
  } catch (e) { threw = true; }
  t.ok(threw, 'transaction error propagates');
  t.eq(P().name, 'Human', 'failed transaction rolled back');
}
