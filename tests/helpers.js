/* shared test helpers: build a demo project covering all diagram types */
'use strict';
const OS = globalThis.OS;

function makeDemoProject() {
  const project = new OS.Project();
  project.newProject();
  const root = project.root;
  const m = root.ownedElements[0];
  const classDiagram = m.ownedElements[0]; // "Main" UMLClassDiagram

  // --- classes ---
  const person = project.createElement(m, 'UMLClass', { name: 'Person' });
  const attr1 = OS.model.createElement(project, 'UMLAttribute', { name: 'id', type: 'int', visibility: 'private', defaultValue: '0' });
  const attr2 = OS.model.createElement(project, 'UMLAttribute', { name: 'name', type: 'String', visibility: 'public', multiplicity: '1' });
  OS.model.addOwned(project, person, attr1, 'ownedAttributes');
  OS.model.addOwned(project, person, attr2, 'ownedAttributes');
  const op1 = OS.model.createElement(project, 'UMLOperation', { name: 'getName', visibility: 'public' });
  const ret = OS.model.createElement(project, 'UMLParameter', { name: '', direction: 'return', type: 'String' });
  OS.model.addOwned(project, op1, ret, 'parameters');
  OS.model.addOwned(project, person, op1, 'ownedOperations');

  const student = project.createElement(m, 'UMLClass', { name: 'Student' });
  const gen = project.createElement(m, 'UMLGeneralization', { source: student, target: person });

  const iface = project.createElement(m, 'UMLInterface', { name: 'Printable' });
  const real = project.createElement(m, 'UMLRealization', { source: student, target: iface });

  const assoc = project.createElement(m, 'UMLAssociation', { name: 'enrolls' });
  const e1 = OS.model.createElement(project, 'UMLAssociationEnd', { reference: student, multiplicity: '0..*', name: 'students' });
  const e2 = OS.model.createElement(project, 'UMLAssociationEnd', { reference: person, multiplicity: '1', aggregation: 'shared', name: 'mentor' });
  OS.model.addOwned(project, assoc, e1, 'ownedEnds');
  OS.model.addOwned(project, assoc, e2, 'ownedEnds');

  const en = project.createElement(m, 'UMLEnumeration', { name: 'Grade' });
  ['A', 'B', 'C'].forEach((n) => {
    const lit = OS.model.createElement(project, 'UMLEnumerationLiteral', { name: n });
    OS.model.addOwned(project, en, lit, 'ownedLiterals');
  });

  const note = project.createElement(m, 'UMLNote', { name: 'Note', documentation: 'Sample note text' });

  // views on the class diagram
  const vPerson = project.createView(classDiagram, person, { x: 80, y: 60 });
  const vStudent = project.createView(classDiagram, student, { x: 320, y: 60 });
  const vIface = project.createView(classDiagram, iface, { x: 320, y: 260 });
  const vGen = project.createView(classDiagram, gen, { head: vPerson, tail: vStudent });
  vGen.points = [{ x: 320, y: 78 }, { x: 210, y: 78 }];
  vGen.lineStyle = 'straight';
  const vReal = project.createView(classDiagram, real, { head: vIface, tail: vStudent });
  vReal.points = [{ x: 370, y: 140 }, { x: 370, y: 260 }];
  vReal.lineStyle = 'straight';
  const vAssoc = project.createView(classDiagram, assoc, { head: vPerson, tail: vStudent });
  vAssoc.points = [{ x: 320, y: 122 }, { x: 210, y: 122 }];
  vAssoc.lineStyle = 'straight';
  const vNote = project.createView(classDiagram, note, { x: 80, y: 300 });

  // --- use case diagram ---
  const ucDiagram = project.createElement(m, 'UMLUseCaseDiagram', { name: 'UseCases' });
  const actor = project.createElement(m, 'UMLActor', { name: 'Customer' });
  const uc1 = project.createElement(m, 'UMLUseCase', { name: 'Place Order' });
  const uc2 = project.createElement(m, 'UMLUseCase', { name: 'Pay' });
  const inc = project.createElement(m, 'UMLInclude', { source: uc1, target: uc2 });
  const vActor = project.createView(ucDiagram, actor, { x: 40, y: 80 });
  const vUc1 = project.createView(ucDiagram, uc1, { x: 200, y: 60 });
  const vUc2 = project.createView(ucDiagram, uc2, { x: 400, y: 60 });
  const vInc = project.createView(ucDiagram, inc, { head: vUc2, tail: vUc1 });
  vInc.points = [{ x: 320, y: 90 }, { x: 400, y: 90 }];

  // --- sequence diagram ---
  const seqDiagram = project.createElement(m, 'UMLSequenceDiagram', { name: 'Checkout' });
  const ll1 = project.createElement(seqDiagram, 'UMLLifeline', { name: 'ui' });
  const ll2 = project.createElement(seqDiagram, 'UMLLifeline', { name: 'controller', represent: 'OrderController' });
  const msg1 = project.createElement(seqDiagram, 'UMLMessage', { name: 'submitOrder', messageSort: 'synchCall', source: ll1, target: ll2, arguments: 'cart' });
  const msg2 = project.createElement(seqDiagram, 'UMLMessage', { name: 'ok', messageSort: 'replyMessage', source: ll2, target: ll1 });
  const vLl1 = project.createView(seqDiagram, ll1, { x: 60, y: 40 });
  const vLl2 = project.createView(seqDiagram, ll2, { x: 300, y: 40 });
  const vMsg1 = project.createView(seqDiagram, msg1, { head: vLl2, tail: vLl1 });
  vMsg1.points = [{ x: 100, y: 140 }, { x: 340, y: 140 }];
  const vMsg2 = project.createView(seqDiagram, msg2, { head: vLl1, tail: vLl2 });
  vMsg2.points = [{ x: 340, y: 200 }, { x: 100, y: 200 }];

  // --- statechart diagram ---
  const sm = project.createElement(m, 'UMLStateMachine', { name: 'OrderSM' });
  const smDiagram = project.createElement(sm, 'UMLStatechartDiagram', { name: 'OrderStates' });
  const init = project.createElement(sm, 'UMLPseudostate', { name: '', kind: 'initial' });
  const s1 = project.createElement(sm, 'UMLState', { name: 'Pending', entryActivity: 'notify' });
  const s2 = project.createElement(sm, 'UMLState', { name: 'Paid' });
  const fin = project.createElement(sm, 'UMLFinalState', { name: '' });
  const t1 = project.createElement(sm, 'UMLTransition', { source: init, target: s1 });
  const t2 = project.createElement(sm, 'UMLTransition', { source: s1, target: s2, trigger: 'pay', guard: 'amount>0', effect: 'ship' });
  const t3 = project.createElement(sm, 'UMLTransition', { source: s2, target: fin });
  const vInit = project.createView(smDiagram, init, { x: 40, y: 100 });
  const vS1 = project.createView(smDiagram, s1, { x: 140, y: 80 });
  const vS2 = project.createView(smDiagram, s2, { x: 320, y: 80 });
  const vFin = project.createView(smDiagram, fin, { x: 500, y: 92 });
  const vT1 = project.createView(smDiagram, t1, { head: vS1, tail: vInit });
  vT1.points = [{ x: 60, y: 100 }, { x: 140, y: 100 }];
  const vT2 = project.createView(smDiagram, t2, { head: vS2, tail: vS1 });
  vT2.points = [{ x: 230, y: 100 }, { x: 320, y: 100 }];
  const vT3 = project.createView(smDiagram, t3, { head: vFin, tail: vS2 });
  vT3.points = [{ x: 410, y: 100 }, { x: 500, y: 100 }];

  // --- activity diagram ---
  const act = project.createElement(m, 'UMLActivity', { name: 'OrderFlow' });
  const actDiagram = project.createElement(act, 'UMLActivityDiagram', { name: 'Flow' });
  const aInit = project.createElement(act, 'UMLInitialNode', {});
  const a1 = project.createElement(act, 'UMLAction', { name: 'Validate' });
  const dec = project.createElement(act, 'UMLDecisionNode', {});
  const a2 = project.createElement(act, 'UMLAction', { name: 'Ship' });
  const aFin = project.createElement(act, 'UMLActivityFinalNode', {});
  const f1 = project.createElement(act, 'UMLControlFlow', { source: aInit, target: a1 });
  const f2 = project.createElement(act, 'UMLControlFlow', { source: a1, target: dec });
  const f3 = project.createElement(act, 'UMLControlFlow', { source: dec, target: a2, guard: 'valid' });
  const f4 = project.createElement(act, 'UMLControlFlow', { source: a2, target: aFin });
  [aInit, a1, dec, a2, aFin].forEach((n, i) => project.createView(actDiagram, n, { x: 60 + i * 150, y: 100 }));
  const viewsAct = actDiagram.ownedViews;
  const cf = [[f1, 0, 1], [f2, 1, 2], [f3, 2, 3], [f4, 3, 4]];
  cf.forEach(([flow, i, j]) => {
    const v = project.createView(actDiagram, flow, { head: viewsAct[j], tail: viewsAct[i] });
    v.points = [{ x: 100 + i * 150, y: 120 }, { x: 60 + j * 150, y: 120 }];
  });

  // --- component diagram ---
  const compDiagram = project.createElement(m, 'UMLComponentDiagram', { name: 'Components' });
  const comp1 = project.createElement(m, 'UMLComponent', { name: 'OrderService' });
  const comp2 = project.createElement(m, 'UMLComponent', { name: 'PaymentGateway' });
  const conn = project.createElement(m, 'UMLConnector', { source: comp1, target: comp2 });
  const vC1 = project.createView(compDiagram, comp1, { x: 60, y: 80 });
  const vC2 = project.createView(compDiagram, comp2, { x: 320, y: 80 });
  const vConn = project.createView(compDiagram, conn, { head: vC2, tail: vC1 });
  vConn.points = [{ x: 180, y: 110 }, { x: 320, y: 110 }];

  // --- deployment diagram ---
  const depDiagram = project.createElement(m, 'UMLDeploymentDiagram', { name: 'Deployment' });
  const node1 = project.createElement(m, 'UMLNode', { name: 'AppServer' });
  const artifact = project.createElement(node1, 'UMLArtifact', { name: 'order.war', fileName: 'order.war' });
  const node2 = project.createElement(m, 'UMLNode', { name: 'DBServer' });
  const commPath = project.createElement(m, 'UMLCommunicationPath', { source: node1, target: node2, name: 'tcp' });
  const vN1 = project.createView(depDiagram, node1, { x: 60, y: 80 });
  const vN2 = project.createView(depDiagram, node2, { x: 360, y: 80 });
  const vArt = project.createView(depDiagram, artifact, { x: 90, y: 130 });
  const vComm = project.createView(depDiagram, commPath, { head: vN2, tail: vN1 });
  vComm.points = [{ x: 200, y: 120 }, { x: 360, y: 120 }];

  project.setDirty(false);
  project.clearHistory();
  return { project, m, classDiagram, person, student, iface, assoc, en, note, seqDiagram, sm, act };
}

module.exports = { makeDemoProject };
