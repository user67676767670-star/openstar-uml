/* view layout / drawing (SVG backend) / routing tests — run headless in Node */
'use strict';
const OS = globalThis.OS;
const { makeDemoProject } = require('./helpers.js');

t.suite('views: layout & routing');

{
  const { project, classDiagram, person, student } = makeDemoProject();
  const vPerson = classDiagram.ownedViews.find((v) => v.model === person);

  // autoLayout sized the class to fit members
  t.ok(vPerson.width >= 100, 'class width fits content');
  t.ok(vPerson.height >= 25 + 2 * 16, 'class height includes name + 2 attributes');

  const layout = OS.views.computeLayout(vPerson);
  t.ok(layout.classifierStyle, 'class view is classifier-style');
  t.eq(layout.compartments.length, 2, 'attributes + operations compartments');
  t.eq(layout.compartments[0].lines[0].text, '-id : int = 0', 'compartment line text');
  t.eq(layout.nameCompartment.text, 'Person', 'name compartment text');

  // suppress flags
  vPerson.suppressAttributes = true;
  const l2 = OS.views.computeLayout(vPerson);
  t.eq(l2.compartments.length, 1, 'suppressAttributes hides compartment');
  vPerson.suppressAttributes = false;

  // interface forced stereotype
  const iface = project.models().find((m) => m._type === 'UMLInterface');
  const vIface = classDiagram.ownedViews.find((v) => v.model === iface);
  t.eq(OS.views.stereoOf(vIface), 'interface', 'interface shows «interface»');

  // edge routing: generalization endpoints lie on view boundaries
  const genView = classDiagram.ownedViews.find((v) => v._type === 'UMLGeneralizationView');
  const pts = OS.views.routedPoints(genView);
  t.ok(pts.length >= 2, 'routed points produced');
  const rS = OS.views.viewRect(genView.tail), rH = OS.views.viewRect(genView.head);
  const onRect = (p, r) => Math.abs(p.x - r.x) < 1.5 || Math.abs(p.x - (r.x + r.width)) < 1.5 ||
    Math.abs(p.y - r.y) < 1.5 || Math.abs(p.y - (r.y + r.height)) < 1.5;
  t.ok(onRect(pts[0], rS), 'tail endpoint on source boundary');
  t.ok(onRect(pts[pts.length - 1], rH), 'head endpoint on target boundary');

  // diagram bounds contain all views
  const b = OS.views.diagramBounds(classDiagram);
  t.ok(b.width > 0 && b.height > 0, 'diagram bounds positive');
  t.ok(b.x <= vPerson.left && b.y <= vPerson.top, 'bounds include views');

  // container assignment (package)
  const pkg = project.createElement(classDiagram._parent, 'UMLPackage', { name: 'Pkg' });
  const vPkg = project.createView(classDiagram, pkg, { x: 600, y: 60, width: 260, height: 200 });
  const inner = project.createElement(pkg, 'UMLClass', { name: 'Inner' });
  const vInner = project.createView(classDiagram, inner, { x: 640, y: 120 });
  OS.views.assignContainers(classDiagram);
  t.ok(vInner.containerView === vPkg, 'class inside package gets containerView');
  const order = OS.views.drawOrder(classDiagram);
  t.ok(order.indexOf(vPkg) < order.indexOf(vInner), 'container drawn before contained');
}

t.suite('views: SVG rendering smoke test');
{
  const { project } = makeDemoProject();
  const svgGfx = new OS.gfx.SvgGfx();
  let err = null;
  project.eachDiagram((d) => {
    try {
      OS.views.prepareDiagram(d);
      OS.views.drawOrder(d).forEach((v) => {
        svgGfx.save();
        OS.views.draw(svgGfx, v, { diagram: d, project });
        svgGfx.restore();
      });
    } catch (e) { err = e; }
  });
  t.ok(!err, 'every view of every demo diagram draws without error' + (err ? ': ' + err.message : ''));

  const svgText = svgGfx.toSvg(800, 600);
  t.ok(svgText.includes('<svg'), 'svg root emitted');
  t.ok(svgText.includes('<rect'), 'rects emitted');
  t.ok(svgText.includes('<text'), 'text emitted');

  // the emitted SVG must itself be well-formed XML
  let parsed = null;
  t.doesNotThrow(() => { parsed = OS.xml.parse(svgText); }, 'emitted SVG parses as XML');
  t.ok(parsed && OS.xml.findChild(parsed, 'svg'), 'svg element found after parse');
}

t.suite('image export');
{
  const { project } = makeDemoProject();
  let err = null;
  project.eachDiagram((d) => {
    try {
      const svg = OS.Image.toSVG(d);
      OS.xml.parse(svg); // must be well-formed (balanced groups!)
      if (!svg.includes('<svg')) throw new Error('no svg root');
    } catch (e) { err = err || e; }
  });
  t.ok(!err, 'every diagram exports to well-formed SVG' + (err ? ': ' + err.message : ''));
}

t.suite('views: sequence specifics');
{
  const { project, seqDiagram } = makeDemoProject();
  const vLl1 = seqDiagram.ownedViews.find((v) => v._type === 'UMLSeqLifelineView');
  const msgView = seqDiagram.ownedViews.find((v) => v._type === 'UMLSeqMessageView');
  const pts = OS.views.routedPoints(msgView);
  t.eq(pts.length, 2, 'message has two routed points');
  t.eq(pts[0].y, pts[1].y, 'message is horizontal');
  const bottom = OS.views.lifelineBottom(seqDiagram, vLl1);
  t.ok(bottom > 200, 'lifeline extends past last message');
}
