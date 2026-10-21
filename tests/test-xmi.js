/* XMI export/import tests */
'use strict';
const OS = globalThis.OS;
const { makeDemoProject } = require('./helpers.js');

t.suite('xmi: export');

const demo = makeDemoProject();
let xmi = '';
t.doesNotThrow(() => { xmi = OS.Xmi.exportProject(demo.project); }, 'export runs');

let doc = null;
t.doesNotThrow(() => { doc = OS.xml.parse(xmi); }, 'exported XMI is well-formed XML');
const xmiRoot = OS.xml.findChild(doc, 'XMI');
t.ok(xmiRoot, 'xmi:XMI root');
t.ok(xmiRoot.attrs['xmlns:uml'], 'uml namespace declared');

const all = OS.xml.descendants(xmiRoot);
function byType(type) {
  return all.filter((n) => n.attrs && n.attrs['xmi:type'] === type);
}
t.ok(byType('uml:Class').length >= 2, 'classes exported');
t.ok(byType('uml:Interface').length >= 1, 'interface exported');
t.ok(byType('uml:Enumeration').length >= 1, 'enumeration exported');
t.eq(byType('uml:EnumerationLiteral').length, 3, 'enum literals exported');
t.ok(byType('uml:Property').length >= 2, 'attributes exported as uml:Property');
t.ok(byType('uml:Operation').length >= 1, 'operations exported');
t.ok(byType('uml:Parameter').length >= 1, 'parameters exported');
t.ok(byType('uml:Generalization').length >= 1, 'generalization exported');
t.ok(byType('uml:Realization').length >= 1, 'realization exported');
t.ok(byType('uml:Association').length >= 1, 'association exported');
t.ok(byType('uml:Actor').length >= 1 && byType('uml:UseCase').length >= 2, 'use case elements exported');
t.ok(byType('uml:Include').length >= 1, 'include exported');
t.ok(byType('uml:StateMachine').length >= 1, 'state machine exported');
t.ok(byType('uml:State').length >= 2, 'states exported');
t.ok(byType('uml:Transition').length >= 3, 'transitions exported');
t.ok(byType('uml:Activity').length >= 1, 'activity exported');
t.ok(byType('uml:Action').length >= 2, 'actions exported');
t.ok(byType('uml:ControlFlow').length >= 4, 'control flows exported');
t.ok(byType('uml:Component').length >= 2, 'components exported');
t.ok(byType('uml:Node').length >= 2, 'nodes exported');
t.ok(byType('uml:Artifact').length >= 1, 'artifacts exported');
t.ok(byType('uml:Interaction').length >= 1, 'sequence interaction exported');
t.ok(byType('uml:Lifeline').length >= 2, 'lifelines exported');
t.ok(byType('uml:Message').length >= 2, 'messages exported');
t.ok(byType('uml:Comment').length >= 1, 'note exported as comment');

// attribute details
{
  const propNode = byType('uml:Property').find((n) => n.attrs.name === 'x' || n.attrs.name === 'id');
  t.ok(propNode, 'attribute id/x found');
  const idProp = byType('uml:Property').find((n) => n.attrs.name === 'id');
  t.eq(idProp.attrs.visibility, 'private', 'visibility exported');
  t.eq(idProp.attrs.defaultValue, '0', 'defaultValue exported');
  const typeChild = OS.xml.findChild(idProp, 'type');
  t.ok(typeChild && typeChild.attrs.name === 'int', 'primitive type nested');
}
// association end aggregation
{
  const assoc = byType('uml:Association').find((n) => n.attrs.name === 'enrolls');
  t.ok(assoc, 'named association found');
  const ends = OS.xml.findChildren(assoc, 'ownedEnd');
  t.eq(ends.length, 2, 'two ownedEnds');
  t.ok(ends.some((e) => e.attrs.aggregation === 'shared'), 'aggregation kind exported');
  t.ok(ends.some((e) => OS.xml.findChild(e, 'upperValue')), 'multiplicity values exported');
}

t.suite('xmi: import round-trip');
{
  const p2 = new OS.Project();
  p2.newProject();
  let result = null;
  t.doesNotThrow(() => { result = OS.Xmi.importInto(p2, xmi); }, 'import runs');
  const imported = result.model;
  t.ok(imported, 'import model returned');

  function findByName(type, name) {
    let found = null;
    p2.eachElement((e) => { if (!found && e._type === type && e.name === name) found = e; });
    return found;
  }

  const person = findByName('UMLClass', 'Person');
  t.ok(person, 'class Person imported');
  t.eq(person.ownedAttributes.length, 2, 'attributes imported');
  const idAttr = person.ownedAttributes.find((a) => a.name === 'id');
  t.eq(idAttr.type, 'int', 'primitive type imported as string');
  t.eq(idAttr.visibility, 'private', 'visibility imported');
  t.eq(idAttr.defaultValue, '0', 'default value imported');
  const op = person.ownedOperations[0];
  t.eq(op.name, 'getName', 'operation imported');
  t.ok(op.parameters.some((p) => p.direction === 'return' && p.type === 'String'), 'return parameter imported');

  const student = findByName('UMLClass', 'Student');
  t.ok(student, 'class Student imported');
  function findRel(type, srcName, tgtName) {
    let found = null;
    p2.eachElement((e) => {
      if (!found && e._type === type &&
          (!srcName || (e.source && e.source.name === srcName)) &&
          (!tgtName || (e.target && e.target.name === tgtName))) found = e;
    });
    return found;
  }
  const gen = findRel('UMLGeneralization', 'Student', 'Person');
  t.ok(gen, 'generalization imported & linked (sibling form)');

  const grade = findByName('UMLEnumeration', 'Grade');
  t.eq(grade.ownedLiterals.length, 3, 'enum literals imported');

  let assoc = null;
  p2.eachElement((e) => { if (e._type === 'UMLAssociation' && e.name === 'enrolls') assoc = e; });
  t.ok(assoc, 'association imported');
  t.eq(assoc.ownedEnds.length, 2, 'association ends imported');
  t.ok(assoc.ownedEnds.every((e) => e.reference), 'end references resolved');
  t.ok(assoc.ownedEnds.some((e) => e.aggregation === 'shared'), 'aggregation imported');
  const roleEnd = assoc.ownedEnds.find((e) => e.name === 'students');
  t.eq(roleEnd.multiplicity, '0..*', 'end multiplicity imported');

  const printable = findByName('UMLInterface', 'Printable');
  t.ok(printable, 'interface imported');
  const real = findRel('UMLRealization', 'Student', 'Printable');
  t.ok(real, 'realization imported & linked');

  const customer = findByName('UMLActor', 'Customer');
  t.ok(customer, 'actor imported');
  const placeOrder = findByName('UMLUseCase', 'Place Order');
  t.ok(placeOrder, 'use case imported');
  const inc = findRel('UMLInclude', 'Place Order', 'Pay');
  t.ok(inc, 'include imported & linked');

  const sm = findByName('UMLStateMachine', 'OrderSM');
  t.ok(sm, 'state machine imported');
  const pending = sm.ownedElements.find((e) => e.name === 'Pending');
  t.ok(pending && pending.entryActivity === 'notify', 'state entry activity imported');
  const tr = sm.ownedElements.find((e) => e._type === 'UMLTransition' && e.trigger === 'pay');
  t.ok(tr && tr.source === pending, 'transition linked to source state');
  t.eq(tr.guard, 'amount>0', 'transition guard imported');

  const act = findByName('UMLActivity', 'OrderFlow');
  t.ok(act, 'activity imported');
  const validate = act.ownedElements.find((e) => e.name === 'Validate');
  t.ok(validate && validate._type === 'UMLAction', 'action imported');
  const flows = act.ownedElements.filter((e) => e._type === 'UMLControlFlow');
  t.ok(flows.length >= 4, 'control flows imported');
  t.ok(flows.every((f) => f.source && f.target), 'flow ends resolved');

  const comp = findByName('UMLComponent', 'OrderService');
  t.ok(comp, 'component imported');
  const node = findByName('UMLNode', 'AppServer');
  t.ok(node, 'node imported');
  const art = findByName('UMLArtifact', 'order.war');
  t.ok(art, 'artifact imported');

  const seqDiagram = p2.diagrams().find((d) => d._type === 'UMLSequenceDiagram' && d.name === 'Checkout');
  t.ok(seqDiagram, 'interaction imported as sequence diagram');
  const ll = seqDiagram.ownedElements.filter((e) => e._type === 'UMLLifeline');
  const msgs = seqDiagram.ownedElements.filter((e) => e._type === 'UMLMessage');
  t.eq(ll.length, 2, 'lifelines imported');
  t.eq(msgs.length, 2, 'messages imported');
  t.ok(msgs.every((m) => m.source && m.target), 'message ends resolved to lifelines');
  t.eq(msgs[0].arguments, 'cart', 'message arguments imported');

  const note = findByName('UMLNote', 'Note');
  t.ok(note && note.documentation.includes('Sample note'), 'note/comment imported');

  t.ok(result.unresolved < 5, 'few unresolved references (' + result.unresolved + ')');

  // re-export the imported model → still well-formed
  t.doesNotThrow(() => { const x2 = OS.Xmi.exportProject(p2); OS.xml.parse(x2); }, 're-export of imported model is well-formed');
}

t.suite('xmi: foreign file tolerance');
{
  const foreign = `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmlns:uml="http://www.eclipse.org/uml2/5.0.0/UML" xmlns:xmi="http://www.omg.org/spec/XMI/20131001" xmi:version="20131001">
  <packagedElement xmi:type="uml:Model" xmi:id="_m1" name="Foreign">
    <packagedElement xmi:type="uml:Class" xmi:id="_c1" name="Widget" isAbstract="true">
      <ownedAttribute xmi:type="uml:Property" xmi:id="_a1" name="size" visibility="private">
        <type xmi:type="uml:PrimitiveType" href="http://www.eclipse.org/uml2/5.0.0/UML/PrimitiveType~Integer"/>
      </ownedAttribute>
      <ownedAttribute xmi:type="uml:Property" xmi:id="_a2" name="parts" type="_c2">
        <upperValue xmi:type="uml:LiteralUnlimitedNatural" xmi:id="_uv" value="*"/>
        <lowerValue xmi:type="uml:LiteralInteger" xmi:id="_lv" value="0"/>
      </ownedAttribute>
      <ownedOperation xmi:type="uml:Operation" xmi:id="_o1" name="draw"/>
      <generalization xmi:type="uml:Generalization" xmi:id="_g1" general="_c2"/>
    </packagedElement>
    <packagedElement xmi:type="uml:Class" xmi:id="_c2" name="Base"/>
    <packagedElement xmi:type="uml:Association" xmi:id="_as1" name="has">
      <ownedEnd xmi:type="uml:Property" xmi:id="_e1" type="_c1"/>
      <ownedEnd xmi:type="uml:Property" xmi:id="_e2" type="_c2" aggregation="composite"/>
    </packagedElement>
  </packagedElement>
</xmi:XMI>`;
  const p3 = new OS.Project();
  p3.newProject();
  let res = null;
  t.doesNotThrow(() => { res = OS.Xmi.importInto(p3, foreign); }, 'Eclipse-UML2-style XMI imports');
  let widget = null, base = null;
  p3.eachElement((e) => { if (e.name === 'Widget') widget = e; if (e.name === 'Base') base = e; });
  t.ok(widget && widget.isAbstract, 'class + isAbstract imported');
  const parts = widget.ownedAttributes.find((a) => a.name === 'parts');
  t.eq(parts.multiplicity, '0..*', 'lower/upperValue multiplicity imported');
  t.ok(parts.type === base, 'typed-by-class reference resolved');
  const gen = widget.ownedElements.find((e) => e._type === 'UMLGeneralization');
  t.ok(gen && gen.target === base, 'nested generalization imported');
  let assoc = null;
  p3.eachElement((e) => { if (e._type === 'UMLAssociation' && e.name === 'has') assoc = e; });
  t.ok(assoc && assoc.ownedEnds.length === 2, 'association ends imported');
  t.ok(assoc.ownedEnds.some((e) => e.aggregation === 'composite'), 'composite aggregation imported');
}
