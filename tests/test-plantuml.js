/* PlantUML generation tests */
'use strict';
const OS = globalThis.OS;
const { makeDemoProject } = require('./helpers.js');

t.suite('plantuml');

const { project } = makeDemoProject();
const diagrams = {};
project.eachDiagram((d) => { diagrams[d.name] = d; });

const cls = OS.PlantUML.generate(project, diagrams['Main']);
t.ok(cls.startsWith('@startuml'), 'class: starts with @startuml');
t.ok(cls.trimEnd().endsWith('@enduml'), 'class: ends with @enduml');
t.ok(/class "Person" as \w+/.test(cls), 'class: person block');
t.ok(/abstract class "Student"|class "Student"/.test(cls), 'class: student block');
t.ok(/interface "Printable"/.test(cls), 'class: interface');
t.ok(cls.includes('-id : int = 0'), 'class: formatted attribute');
t.ok(cls.includes('+getName() : String'), 'class: formatted operation');
t.ok(/<\|--/.test(cls), 'class: generalization arrow');
t.ok(/<\|\.\./.test(cls), 'class: realization arrow');
t.ok(/o--/.test(cls), 'class: shared aggregation arrow (whole side left)');
t.ok(cls.includes('note'), 'class: note emitted');

const uc = OS.PlantUML.generate(project, diagrams['UseCases']);
t.ok(/actor "Customer"/.test(uc), 'usecase: actor');
t.ok(/usecase "Place Order"/.test(uc), 'usecase: use case');
t.ok(uc.includes('<<include>>'), 'usecase: include arrow');

const seq = OS.PlantUML.generate(project, diagrams['Checkout']);
t.ok(/participant "ui" as \w+/.test(seq), 'sequence: participant');
t.ok(/participant "controller : OrderController" as \w+/.test(seq), 'sequence: participant with represent');
t.ok(/-> \w+ : submitOrder\(cart\)/.test(seq), 'sequence: sync message');
t.ok(/--> \w+ : ok/.test(seq), 'sequence: reply message (dashed)');

const st = OS.PlantUML.generate(project, diagrams['OrderStates']);
t.ok(/state "Pending"/.test(st), 'state: state declaration');
t.ok(st.includes('[*] -->'), 'state: initial transition');
t.ok(st.includes('pay [amount>0] / ship'), 'state: transition label with guard/effect');
t.ok(st.includes('--> [*]'), 'state: final transition');

const act = OS.PlantUML.generate(project, diagrams['Flow']);
t.ok(/state "Validate"/.test(act), 'activity: action as state node');
t.ok(act.includes('-->'), 'activity: flows emitted');
t.ok(act.includes('[valid]'), 'activity: guard label');

const comp = OS.PlantUML.generate(project, diagrams['Components']);
t.ok(/component "OrderService"/.test(comp), 'component: component keyword');
t.ok(/ -- /.test(comp), 'component: assembly connector');

const dep = OS.PlantUML.generate(project, diagrams['Deployment']);
t.ok(/node "AppServer"/.test(dep), 'deployment: node');
t.ok(/artifact "order.war"/.test(dep), 'deployment: artifact');
t.ok(dep.includes('tcp'), 'deployment: comm path label');

const all = OS.PlantUML.generateAll(project);
const starts = (all.match(/@startuml/g) || []).length;
const ends = (all.match(/@enduml/g) || []).length;
t.eq(starts, ends, 'generateAll: balanced @startuml/@enduml (' + starts + ' diagrams)');
t.ok(starts >= 7, 'generateAll covers every diagram');

// whole-project fallback (no diagram)
const proj = OS.PlantUML.generate(project, null);
t.ok(proj.includes('@startuml') && proj.includes('Person'), 'project-wide generation works');
t.ok(/enum "Grade"/.test(proj), 'project-wide: enumeration emitted');
t.ok(/\n {2}A\n/.test(proj) && /\n {2}B\n/.test(proj), 'project-wide: enum literals emitted');
