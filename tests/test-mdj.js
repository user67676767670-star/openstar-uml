/* .mdj serialization / deserialization tests */
'use strict';
const OS = globalThis.OS;
const { makeDemoProject } = require('./helpers.js');

t.suite('mdj: serialize');

const demo = makeDemoProject();
const text = OS.Mdj.serialize(demo.project);

t.doesNotThrow(() => JSON.parse(text), 'serialize produces valid JSON');
const raw = JSON.parse(text);
t.eq(raw._type, 'Project', 'root is Project');
t.ok(Array.isArray(raw.ownedElements), 'root has ownedElements');

// every $ref must resolve to a defined _id
{
  const ids = new Set();
  const refs = [];
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (o._id) ids.add(o._id);
    if (o.$ref) refs.push(o.$ref);
    for (const k in o) walk(o[k]);
  })(raw);
  const dangling = refs.filter((r) => !ids.has(r));
  t.eq(dangling.length, 0, 'no dangling $refs in serialized file');
}

// StarUML-style view structure present
{
  const model0 = raw.ownedElements[0];
  const cd = model0.ownedElements.find((e) => e._type === 'UMLClassDiagram');
  const classView = cd.ownedViews.find((v) => v._type === 'UMLClassView');
  t.ok(classView, 'class view written');
  t.ok(classView.model && classView.model.$ref, 'view → model $ref');
  t.ok(Array.isArray(classView.subViews) && classView.subViews.length >= 3, 'class view has compartments (subViews)');
  const nameComp = classView.subViews.find((s) => s._type === 'UMLNameCompartmentView');
  t.ok(nameComp && nameComp.subViews.length === 4, 'name compartment has 4 labels (stereo/name/ns/property)');
  const attrComp = classView.subViews.find((s) => s._type === 'UMLAttributeCompartmentView');
  t.ok(attrComp && attrComp.subViews.length === 2, 'attribute compartment has one label per attribute');
  t.ok(attrComp.subViews[0].text === '-id : int = 0', 'attribute label text formatted');
  t.ok(classView.nameCompartment && classView.nameCompartment.$ref === nameComp._id, 'nameCompartment $ref wired');
  t.eq(classView.left, 80, 'geometry preserved (left)');

  const assocView = cd.ownedViews.find((v) => v._type === 'UMLAssociationView');
  t.ok(assocView, 'association view written');
  t.ok(typeof assocView.points === 'string' && /:/.test(assocView.points), 'edge points serialized as "x:y;..." string');
  t.ok(assocView.head && assocView.head.$ref && assocView.tail && assocView.tail.$ref, 'edge head/tail $refs');
  t.ok(assocView.nameLabel && assocView.tailRoleNameLabel && assocView.headMultiplicityLabel, 'edge label refs wired');
}

t.suite('mdj: load & round-trip');
{
  const p2 = new OS.Project();
  t.doesNotThrow(() => OS.Mdj.load(p2, text), 'load serialized file');
  t.eq(p2.diagrams().length, 7, 'all diagrams loaded');

  const m2 = p2.firstModel();
  const person2 = m2.ownedElements.find((e) => e.name === 'Person');
  t.ok(person2, 'class Person loaded');
  t.eq(person2.ownedAttributes.length, 2, 'attributes loaded');
  t.eq(person2.ownedAttributes[0].name, 'id', 'attribute name');
  t.eq(person2.ownedOperations[0].parameters[0].direction, 'return', 'operation return parameter');

  const cd2 = p2.diagrams().find((d) => d._type === 'UMLClassDiagram');
  const vPerson2 = cd2.ownedViews.find((v) => v.model === person2);
  t.ok(vPerson2, 'view linked to model object');
  t.eq(vPerson2.left, 80, 'view geometry');

  const gen2 = m2.ownedElements.find((e) => e._type === 'UMLGeneralization');
  t.ok(gen2.source && gen2.source.name === 'Student', 'generalization source resolved');
  t.ok(gen2.target && gen2.target.name === 'Person', 'generalization target resolved');

  const assoc2 = m2.ownedElements.find((e) => e._type === 'UMLAssociation');
  t.eq(assoc2.ownedEnds.length, 2, 'association ends loaded');
  t.eq(assoc2.ownedEnds[1].aggregation, 'shared', 'end aggregation preserved');
  t.ok(assoc2.ownedEnds[0].reference === m2.ownedElements.find((e) => e.name === 'Student'), 'end reference resolved');

  const assocView2 = cd2.ownedViews.find((v) => v._type === 'UMLAssociationView');
  t.ok(assocView2.head && assocView2.tail, 'edge view head/tail resolved to view objects');
  t.eq(assocView2.points.length, 2, 'points parsed back to array');

  // sequence diagram
  const seq2 = p2.diagrams().find((d) => d._type === 'UMLSequenceDiagram');
  const msg2 = seq2.ownedElements.find((e) => e._type === 'UMLMessage');
  t.ok(msg2.source && msg2.source._type === 'UMLLifeline', 'message source is lifeline');
  t.eq(msg2.messageSort, 'synchCall', 'messageSort preserved');

  // state machine nested under behavior owner
  const sm2 = m2.ownedElements.find((e) => e._type === 'UMLStateMachine');
  const smd2 = sm2.ownedElements.find((e) => e._type === 'UMLStatechartDiagram');
  t.ok(smd2, 'statechart diagram under state machine');
  const tr2 = sm2.ownedElements.find((e) => e._type === 'UMLTransition' && e.trigger === 'pay');
  t.ok(tr2 && tr2.source.name === 'Pending' && tr2.target.name === 'Paid', 'transition ends resolved');

  // idempotency: serialize(load(text)) === text
  const text2 = OS.Mdj.serialize(p2);
  t.eq(text2, text, 'round-trip serialization is byte-identical');
}

t.suite('mdj: tolerant reader (StarUML-style fixture)');
{
  // A hand-built file shaped like real StarUML output: full subViews, alpha
  // labels, string points, lineStyle numbers, tags, unknown fields and an
  // unknown element type that must round-trip untouched.
  const fixture = {
    _type: 'Project', _id: 'AAAAAAFF+h6SjaM2Hec=', name: 'Fixture',
    ownedElements: [
      {
        _type: 'UMLModel', _id: 'AAAAAAFF+qBWK6M3Z8Y=', _parent: { $ref: 'AAAAAAFF+h6SjaM2Hec=' },
        name: 'Model',
        ownedElements: [
          {
            _type: 'UMLClass', _id: 'CLASS_A_ID', _parent: { $ref: 'AAAAAAFF+qBWK6M3Z8Y=' },
            name: 'Alpha', visibility: 'public', isAbstract: true, isFinalSpecialization: false,
            documentation: 'docs here',
            tags: [{ _type: 'Tag', _id: 'TAG1', name: 'version', kind: 'string', value: '1.0', checked: false }],
            someFutureField: 42,
            ownedAttributes: [
              { _type: 'UMLAttribute', _id: 'ATTR1', _parent: { $ref: 'CLASS_A_ID' }, name: 'x', visibility: 'private', isStatic: true, type: 'int', multiplicity: '1..*', defaultValue: '7' }
            ],
            ownedOperations: [
              { _type: 'UMLOperation', _id: 'OP1', _parent: { $ref: 'CLASS_A_ID' }, name: 'run', visibility: 'public', isStatic: false, parameters: [
                { _type: 'UMLParameter', _id: 'PAR1', _parent: { $ref: 'OP1' }, name: 'arg', type: 'string', direction: 'in' }
              ] }
            ]
          },
          {
            _type: 'UMLStereotype', _id: 'STEREO1', _parent: { $ref: 'AAAAAAFF+qBWK6M3Z8Y=' },
            name: 'entity', metaClass: 'UMLClass', icon: { _type: 'UMLImage', _id: 'IMG1', content: 'data:...' }
          },
          {
            _type: 'UMLCommunicationDiagram', _id: 'COMMDIAG1', _parent: { $ref: 'AAAAAAFF+qBWK6M3Z8Y=' },
            name: 'Comm', ownedElements: [], ownedViews: []
          },
          {
            _type: 'UMLClassDiagram', _id: 'AAAAAAFF+qBtyKM79qY=', _parent: { $ref: 'AAAAAAFF+qBWK6M3Z8Y=' },
            name: 'Main', defaultDiagram: true,
            ownedViews: [
              {
                _type: 'UMLClassView', _id: 'VIEW_A', _parent: { $ref: 'AAAAAAFF+qBtyKM79qY=' },
                model: { $ref: 'CLASS_A_ID' },
                subViews: [
                  {
                    _type: 'UMLNameCompartmentView', _id: 'NC_A', _parent: { $ref: 'VIEW_A' }, model: { $ref: 'VIEW_A' },
                    subViews: [
                      { _type: 'LabelView', _id: 'L1', _parent: { $ref: 'NC_A' }, visible: false, font: 'Arial;13;0', left: -32, top: -16, width: 64, height: 13 },
                      { _type: 'LabelView', _id: 'L2', _parent: { $ref: 'NC_A' }, font: 'Arial;13;1', left: 245, top: 239, width: 64.18359375, height: 13, text: 'Alpha' },
                      { _type: 'LabelView', _id: 'L3', _parent: { $ref: 'NC_A' }, visible: false, font: 'Arial;13;0', left: 245, top: 239, width: 73.67724609375, height: 13, text: '(from Model)' },
                      { _type: 'LabelView', _id: 'L4', _parent: { $ref: 'NC_A' }, visible: false, font: 'Arial;13;0', left: -32, top: -16, height: 13, horizontalAlignment: 1 }
                    ],
                    font: 'Arial;13;0', left: 240, top: 232, width: 120.25732421875, height: 25,
                    stereotypeLabel: { $ref: 'L1' }, nameLabel: { $ref: 'L2' }, namespaceLabel: { $ref: 'L3' }, propertyLabel: { $ref: 'L4' }
                  },
                  {
                    _type: 'UMLAttributeCompartmentView', _id: 'AC_A', _parent: { $ref: 'VIEW_A' }, model: { $ref: 'VIEW_A' },
                    subViews: [
                      { _type: 'LabelView', _id: 'AL1', _parent: { $ref: 'AC_A' }, font: 'Arial;13;0', left: 245, top: 262, width: 110.257, height: 13, text: '-x: int = 7' }
                    ],
                    font: 'Arial;13;0', left: 240, top: 257, width: 120.257, height: 38
                  },
                  { _type: 'UMLOperationCompartmentView', _id: 'OC_A', _parent: { $ref: 'VIEW_A' }, model: { $ref: 'VIEW_A' }, subViews: [], font: 'Arial;13;0', left: 240, top: 295, width: 120.257, height: 10, visible: false },
                  { _type: 'UMLReceptionCompartmentView', _id: 'RC_A', _parent: { $ref: 'VIEW_A' }, model: { $ref: 'VIEW_A' }, subViews: [], visible: false, font: 'Arial;13;0', left: 240, top: 295, width: 120.257, height: 10 },
                  { _type: 'UMLTemplateParameterCompartmentView', _id: 'TP_A', _parent: { $ref: 'VIEW_A' }, model: { $ref: 'VIEW_A' }, subViews: [], visible: false, font: 'Arial;13;0', left: 240, top: 232, width: 10, height: 10 }
                ],
                font: 'Arial;13;0', containerChangeable: true,
                left: 240, top: 232, width: 120.25732421875, height: 121,
                nameCompartment: { $ref: 'NC_A' }, attributeCompartment: { $ref: 'AC_A' },
                operationCompartment: { $ref: 'OC_A' }, receptionCompartment: { $ref: 'RC_A' },
                templateParameterCompartment: { $ref: 'TP_A' }
              },
              {
                _type: 'UMLNoteView', _id: 'VIEW_N', _parent: { $ref: 'AAAAAAFF+qBtyKM79qY=' },
                font: 'Arial;13;0', left: 440, top: 240, width: 100, height: 50, text: 'sticky text'
              },
              {
                _type: 'UMLFutureShapeView', _id: 'VIEW_F', _parent: { $ref: 'AAAAAAFF+qBtyKM79qY=' },
                left: 600, top: 100, width: 90, height: 40
              }
            ]
          }
        ]
      }
    ]
  };

  const p3 = new OS.Project();
  t.doesNotThrow(() => OS.Mdj.load(p3, JSON.stringify(fixture)), 'fixture loads without error');

  const m3 = p3.firstModel();
  const alpha = m3.ownedElements.find((e) => e.name === 'Alpha');
  t.ok(alpha && alpha.isAbstract === true, 'class flags preserved');
  t.eq(alpha.ownedAttributes[0].multiplicity, '1..*', 'attribute multiplicity');
  t.ok(alpha.ext.someFutureField === 42, 'unknown scalar kept in ext');
  t.ok(Array.isArray(alpha.tags) && alpha.tags[0].name === 'version', 'tags preserved');

  const stereo = m3.ownedElements.find((e) => e._type === 'UMLStereotype');
  t.ok(stereo && stereo.ext.metaClass === 'UMLClass', 'unknown element type loaded generically with fields in ext');

  const cd3 = p3.diagrams().find((d) => d.name === 'Main');
  const vA = cd3.ownedViews.find((v) => v.model === alpha);
  t.ok(vA, 'class view linked');
  t.eq(vA.font, 'Arial;13;0', 'font string preserved');
  t.ok(vA.suppressOperations === true, 'hidden operation compartment → suppressOperations');

  const noteView = cd3.ownedViews.find((v) => v._type === 'UMLNoteView');
  t.ok(noteView && noteView.text === 'sticky text', 'note view text preserved');

  const future = cd3.ownedViews.find((v) => v._type === 'UMLFutureShapeView');
  t.ok(future && future.left === 600, 'unknown view type preserved with geometry');

  const comm = p3.diagrams().find((d) => d._type === 'UMLCommunicationDiagram');
  t.ok(comm, 'unknown diagram type kept as generic diagram');

  // unknown material must survive a round trip
  const text3 = OS.Mdj.serialize(p3);
  t.ok(text3.includes('"UMLStereotype"'), 'unknown element type round-trips');
  t.ok(text3.includes('someFutureField'), 'unknown field round-trips');
  t.ok(text3.includes('UMLFutureShapeView'), 'unknown view round-trips');
  t.ok(text3.includes('sticky text'), 'note text round-trips');

  // load state machine alias names
  const aliasFixture = {
    _type: 'Project', _id: 'P1', name: 'U',
    ownedElements: [{
      _type: 'UMLModel', _id: 'M1', _parent: { $ref: 'P1' }, name: 'Model',
      ownedElements: [{
        _type: 'UMLStateMachineDiagram', _id: 'D1', _parent: { $ref: 'M1' }, name: 'SM', ownedElements: [], ownedViews: []
      }]
    }]
  };
  const p4 = new OS.Project();
  OS.Mdj.load(p4, JSON.stringify(aliasFixture));
  t.ok(p4.diagrams().some((d) => d._type === 'UMLStatechartDiagram'), 'UMLStateMachineDiagram aliased to UMLStatechartDiagram');
}

t.suite('mdj: corrupt input');
{
  const p5 = new OS.Project();
  t.throws(() => OS.Mdj.load(p5, '{not json'), 'invalid JSON throws (caught by app with dialog)');
  t.doesNotThrow(() => {
    const p6 = new OS.Project();
    OS.Mdj.load(p6, JSON.stringify({ _type: 'Project', _id: 'X', name: 'Empty' }));
  }, 'empty project loads');
}
