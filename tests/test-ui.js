/*
 * UI smoke test: boots the ENTIRE renderer (index.html + all scripts + app.js)
 * inside jsdom with a stubbed 2D canvas, then exercises the app end-to-end:
 * boot, explorer, tabs, toolbox, editor interactions, commands, dialogs,
 * property panel, inline edit, clipboard, undo/redo, exports, file round-trip.
 *
 * Skipped automatically when jsdom is not installed.
 */
'use strict';
const path = require('path');
const fs = require('fs');

let jsdomLib;
try { jsdomLib = require('jsdom'); }
catch (e) {
  console.log('\n▸ ui smoke (jsdom)');
  console.log('  – jsdom not installed, skipping (npm i --no-save jsdom)');
  module.exports = null;
  return;
}

function stubCanvasContext(window) {
  function makeCtx(canvas) {
    const noop = function () { };
    return {
      canvas,
      font: '13px Arial', fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
      textAlign: 'left', textBaseline: 'top', globalAlpha: 1, lineJoin: 'round', lineCap: 'butt',
      setTransform: noop, clearRect: noop, fillRect: noop, strokeRect: noop,
      save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
      beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
      rect: noop, arc: noop, arcTo: noop, ellipse: noop, roundRect: noop,
      quadraticCurveTo: noop, bezierCurveTo: noop,
      stroke: noop, fill: noop, clip: noop, setLineDash: noop, getLineDash: () => [],
      fillText: noop, strokeText: noop,
      measureText: (s) => ({ width: String(s).length * 7 }),
      drawImage: noop, createLinearGradient: () => ({ addColorStop: noop })
    };
  }
  window.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(this); };
  window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,iVBORw0KGgo=';
  window.ResizeObserver = class { observe() { } disconnect() { } unobserve() { } };
  window.devicePixelRatio = 1;
  window.URL.createObjectURL = () => 'blob:stub';
  window.URL.revokeObjectURL = () => { };
  window.HTMLAnchorElement.prototype.click = function () { /* no downloads in tests */ };
}

const indexHtml = path.join(__dirname, '..', 'renderer', 'index.html');
const demoMdj = fs.readFileSync(path.join(__dirname, '..', 'samples', 'demo.mdj'), 'utf8');

module.exports = new Promise((resolve) => {
  const virtualConsole = new jsdomLib.VirtualConsole();
  virtualConsole.on('jsdomError', () => { });
  virtualConsole.on('error', () => { });

  jsdomLib.JSDOM.fromFile(indexHtml, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) { stubCanvasContext(window); }
  }).then((dom) => {
    const window = dom.window;
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    window.addEventListener('load', () => {
      setTimeout(() => {
        try { runTests(window); }
        catch (e) {
          t.suite('ui smoke (jsdom)');
          t.ok(false, 'UI smoke crashed: ' + (e && e.stack || e));
        }
        finish();
      }, 50);
    });
    setTimeout(finish, 20000);
  }).catch((e) => {
    t.suite('ui smoke (jsdom)');
    t.ok(false, 'jsdom boot failed: ' + e.message);
    resolve();
  });
});

function runTests(window) {
  t.suite('ui smoke (jsdom)');
  const app = window.openstarApp;
  t.ok(app, 'app booted (window.openstarApp)');
  if (!app) return;
  const OS = window.OS;
  const doc = window.document;

  const mouse = (type, x, y, opts) => new window.MouseEvent(type, Object.assign({
    bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 1
  }, opts || {}));

  /* helpers that ALWAYS re-resolve (undo/redo replaces every object) */
  const CD = () => app.project.diagrams().find((d) => d._type === 'UMLClassDiagram');
  const M = (name, type) => app.project.models().find((m) => m.name === name && (!type || m._type === type));
  const V = (model) => CD().ownedViews.find((v) => v.model === model);
  const screenOf = (v, dx, dy) => {
    const p = app.editor.pan, z = app.editor.zoom;
    return { x: (v.left + (dx || 0)) * z + p.x, y: (v.top + (dy || 0)) * z + p.y };
  };

  /* ---------- initial state ---------- */
  t.ok(app.project.root, 'project created');
  t.ok(app.tabs.active(), 'default diagram opened');
  t.eq(app.tabs.active().name, 'Main', 'Main class diagram is active');
  t.ok(doc.querySelectorAll('#explorer-host .tree-row').length >= 3, 'explorer tree rendered');
  t.eq(doc.querySelectorAll('#tabs-host .diagram-tab').length, 1, 'one tab rendered');
  t.ok(doc.querySelectorAll('#toolbox-host .tool-btn').length > 5, 'toolbox rendered with tools');
  t.eq(doc.getElementById('menubar').style.display, 'flex', 'browser menubar visible');

  /* ---------- load demo project ---------- */
  app.loadProjectText(demoMdj, 'demo.mdj');
  t.eq(app.project.diagrams().length, 7, 'demo project loaded: 7 diagrams');
  t.eq(app.project.fileName, 'demo.mdj', 'file name set');

  /* ---------- open every diagram & render ---------- */
  let renderErrors = null;
  app.project.diagrams().forEach((d) => {
    try {
      app.openDiagram(d);
      app.editor.render();
      app.editor.selectAll();
      app.editor.render();
      app.editor.clearSelection();
    } catch (e) { renderErrors = renderErrors || e; }
  });
  t.ok(!renderErrors, 'every diagram opens, renders, selects-all without error' +
    (renderErrors ? ': ' + renderErrors.stack : ''));
  app.openDiagram(app.project.get(CD()._id));

  /* ---------- explorer + property panel ---------- */
  const rows = Array.from(doc.querySelectorAll('#explorer-host .tree-row'));
  const personRow = rows.find((r) => r.textContent.includes('Person'));
  t.ok(personRow, 'Person row present in explorer');
  personRow.dispatchEvent(mouse('click', 10, 10));
  t.ok(app.props.target && app.props.target.model && app.props.target.model.name === 'Person',
    'clicking explorer row shows Person properties');
  t.ok(doc.querySelector('#props-host .prop-header'), 'property header rendered');
  const nameInput = doc.querySelector('#props-host .prop-input');
  t.ok(nameInput, 'property name input rendered');

  nameInput.value = 'Human';
  nameInput.dispatchEvent(new window.Event('change', { bubbles: true }));
  t.ok(M('Human'), 'property panel rename committed');
  app.runCommand('undo');
  t.ok(M('Person'), 'undo reverts rename');
  app.runCommand('redo');
  t.ok(M('Human'), 'redo re-applies rename');
  app.runCommand('undo');
  t.ok(M('Person'), 'second undo back to Person');

  /* ---------- editor: drag-move + undo ---------- */
  let vPerson = V(M('Person'));
  app.editor.setSelection([vPerson]);
  t.eq(app.editor.selection.length, 1, 'editor selection set');
  const oldLeft = vPerson.left;
  let s = screenOf(vPerson, vPerson.width / 2, 10);
  app.editor.canvas.dispatchEvent(mouse('mousedown', s.x, s.y));
  app.editor.canvas.dispatchEvent(mouse('mousemove', s.x + 40, s.y + 25));
  window.dispatchEvent(mouse('mouseup', s.x + 40, s.y + 25));
  t.eq(app.project.get(vPerson._id).left, oldLeft + 40, 'drag moved the view by dx');
  t.ok(app.project.canUndo(), 'move recorded for undo');
  app.runCommand('undo');
  t.eq(V(M('Person')).left, oldLeft, 'undo restored position');
  app.runCommand('redo');
  t.eq(V(M('Person')).left, oldLeft + 40, 'redo re-moved');
  app.runCommand('undo');

  /* ---------- toolbox: create class ---------- */
  const classTool = OS.meta.DIAGRAMS['UMLClassDiagram'].toolbox.find((x) => x.tool === 'class');
  app.toolbox.setTool(classTool);
  t.ok(app.editor.tool === classTool, 'tool activated from toolbox');
  s = screenOf({ left: 520, top: 420 }, 0, 0);
  app.editor.canvas.dispatchEvent(mouse('mousedown', s.x, s.y));
  window.dispatchEvent(mouse('mouseup', s.x, s.y));
  app.editor.commitInlineEdit(true); // cancel the auto-opened rename
  let newClass = app.project.models().find((m) => m._type === 'UMLClass' && /^Class\d+$/.test(m.name));
  t.ok(newClass, 'clicking canvas with class tool created a class');
  t.ok(V(newClass), 'class view created on diagram');
  t.ok(app.editor.tool === null, 'tool reverted to pointer after placement');

  /* ---------- toolbox: association edge by dragging ---------- */
  const assocTool = OS.meta.DIAGRAMS['UMLClassDiagram'].toolbox.find((x) => x.tool === 'association');
  app.toolbox.setTool(assocTool);
  vPerson = V(M('Person'));
  let vNew = V(newClass);
  let a = screenOf(vPerson, vPerson.width / 2, 10);
  let b = screenOf(vNew, vNew.width / 2, 10);
  app.editor.canvas.dispatchEvent(mouse('mousedown', a.x, a.y));
  app.editor.canvas.dispatchEvent(mouse('mousemove', b.x, b.y));
  window.dispatchEvent(mouse('mouseup', b.x, b.y));
  const newAssoc = app.project.models().find((m) => m._type === 'UMLAssociation' &&
    m.ownedEnds && m.ownedEnds.some((e) => e.reference === M('Person')) &&
    m.ownedEnds.some((e) => e.reference === M(newClass.name, 'UMLClass')));
  t.ok(newAssoc, 'association created by dragging between views');
  t.ok(newAssoc && CD().ownedViews.some((v) => v.model === newAssoc), 'association view exists');
  app.runCommand('undo');

  /* ---------- copy / paste / delete ---------- */
  newClass = M(newClass.name, 'UMLClass');
  app.editor.setSelection([V(newClass)]);
  app.runCommand('copy');
  t.ok(app.clipboardData, 'copy captured clipboard data');
  app.runCommand('paste');
  t.eq(CD().ownedViews.filter((v) => v.model && v.model.name === newClass.name).length, 2,
    'paste duplicated view+model');
  app.runCommand('delete');
  t.eq(CD().ownedViews.filter((v) => v.model && v.model.name === newClass.name).length, 1,
    'delete removed the pasted copy');
  app.runCommand('undo');
  t.eq(CD().ownedViews.filter((v) => v.model && v.model.name === newClass.name).length, 2,
    'undo restored the pasted copy');
  app.runCommand('undo');

  /* ---------- align / distribute / z-order ---------- */
  const nodeIds = CD().ownedViews
    .filter((v) => !OS.meta.isEdgeView(v._type) && v._type !== 'UMLSeqMessageView')
    .slice(0, 3).map((v) => v._id);
  app.editor.setSelection(nodeIds.map((id) => app.project.get(id)));
  app.runCommand('align-left');
  const lefts = nodeIds.map((id) => app.project.get(id).left);
  t.ok(lefts[0] === lefts[1] && lefts[1] === lefts[2], 'align-left equalized lefts');
  app.runCommand('undo');
  app.editor.setSelection(nodeIds.map((id) => app.project.get(id)));
  app.runCommand('distribute-horizontal');
  app.runCommand('undo');
  app.editor.setSelection([app.project.get(nodeIds[0])]);
  app.runCommand('z-front');
  t.eq(CD().ownedViews[CD().ownedViews.length - 1]._id, nodeIds[0], 'bring-to-front reorders');
  app.runCommand('undo');

  /* ---------- inline edit ---------- */
  let vStudent = V(M('Student'));
  app.editor.setSelection([vStudent]);
  app.editor.startInlineEdit(vStudent);
  let inline = doc.querySelector('#canvas-host .inline-edit');
  t.ok(inline, 'inline edit input opened');
  inline.value = 'Scholar';
  inline.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  t.ok(M('Scholar'), 'inline edit committed rename');
  app.runCommand('undo');
  t.ok(M('Student'), 'inline rename undoable');

  /* ---------- tabs ---------- */
  app.tabs.closeAll();                       // earlier loops opened many tabs
  app.openDiagram(CD());
  t.eq(doc.querySelectorAll('#tabs-host .diagram-tab').length, 1, 'single tab after reset');
  const seq = app.project.diagrams().find((d) => d._type === 'UMLSequenceDiagram');
  app.openDiagram(seq);
  t.eq(doc.querySelectorAll('#tabs-host .diagram-tab').length, 2, 'second tab opened');
  t.ok(app.editor.diagram === seq, 'editor switched to sequence diagram');
  doc.querySelectorAll('#tabs-host .tab-close')[0].dispatchEvent(mouse('click', 0, 0));
  t.eq(doc.querySelectorAll('#tabs-host .diagram-tab').length, 1, 'tab closed');

  /* ---------- sequence diagram: lifeline + message ownership ---------- */
  app.openDiagram(app.project.diagrams().find((d) => d._type === 'UMLSequenceDiagram'));
  {
    const SEQ = () => app.project.diagrams().find((d) => d._type === 'UMLSequenceDiagram');
    const lifeTool = OS.meta.DIAGRAMS['UMLSequenceDiagram'].toolbox.find((x) => x.tool === 'lifeline');
    app.toolbox.setTool(lifeTool);
    const sp = { x: 200 + app.editor.pan.x, y: 60 + app.editor.pan.y };
    app.editor.canvas.dispatchEvent(mouse('mousedown', sp.x, sp.y));
    window.dispatchEvent(mouse('mouseup', sp.x, sp.y));
    app.editor.commitInlineEdit(true);
    const newLl = SEQ().ownedElements.find((e) => e._type === 'UMLLifeline' && e.name && /^Lifeline\d+$/.test(e.name));
    t.ok(newLl, 'lifeline tool creates a lifeline');
    t.ok(newLl && newLl._parent === SEQ(), 'lifeline is owned by the sequence diagram (StarUML convention)');
    t.ok(newLl && SEQ().ownedViews.some((v) => v.model === newLl), 'lifeline view created');

    // drag a message from an existing lifeline to the new one
    const msgTool = OS.meta.DIAGRAMS['UMLSequenceDiagram'].toolbox.find((x) => x.tool === 'message');
    app.toolbox.setTool(msgTool);
    const lls = SEQ().ownedViews.filter((v) => v._type === 'UMLSeqLifelineView');
    const src = lls.find((v) => v.model !== newLl), dst = lls.find((v) => v.model === newLl);
    const p1 = { x: src.left + src.width / 2 + app.editor.pan.x, y: 150 + app.editor.pan.y };
    const p2 = { x: dst.left + dst.width / 2 + app.editor.pan.x, y: 150 + app.editor.pan.y };
    app.editor.canvas.dispatchEvent(mouse('mousedown', p1.x, p1.y));
    app.editor.canvas.dispatchEvent(mouse('mousemove', p2.x, p2.y));
    window.dispatchEvent(mouse('mouseup', p2.x, p2.y));
    const newMsg = SEQ().ownedElements.find((e) => e._type === 'UMLMessage' && e.target === newLl);
    t.ok(newMsg, 'message tool creates a message between lifelines');
    t.ok(newMsg && newMsg._parent === SEQ(), 'message owned by the diagram');
    t.ok(newMsg && newMsg.messageSort === 'synchCall', 'message sort from tool preset');
    app.runCommand('undo');
    app.runCommand('undo');
    app.openDiagram(CD());
  }

  /* ---------- new diagram / element commands ---------- */
  app.runCommand('new-diagram:UMLActivityDiagram');
  t.eq(app.project.diagrams().length, 8, 'new diagram command works');
  app.runCommand('undo');
  t.eq(app.project.diagrams().length, 7, 'new diagram undoable');
  app.runCommand('new-element:UMLClass');
  t.ok(app.project.models().filter((m) => m._type === 'UMLClass').length >= 3, 'new element command works');
  app.runCommand('undo');

  /* ---------- dialogs ---------- */
  app.runCommand('about');
  t.ok(doc.querySelector('.modal-overlay'), 'about dialog opened');
  doc.querySelector('.modal-foot .btn.primary').dispatchEvent(mouse('click', 0, 0));
  app.runCommand('shortcuts');
  t.ok(doc.querySelector('.shortcuts-table'), 'shortcuts dialog rendered');
  doc.querySelector('.modal-foot .btn.primary').dispatchEvent(mouse('click', 0, 0));
  app.runCommand('preferences');
  const snapCb = doc.querySelector('#pref-snap');
  t.ok(snapCb, 'preferences dialog rendered');
  snapCb.checked = true;
  snapCb.dispatchEvent(new window.Event('change', { bubbles: true }));
  t.ok(app.settings.snap === true && app.editor.snapToGrid === true, 'preference applied live');
  doc.querySelector('.modal-foot .btn.primary').dispatchEvent(mouse('click', 0, 0));

  /* ---------- menubar (browser fallback) ---------- */
  const fileBtn = Array.from(doc.querySelectorAll('.menubar-item')).find((b) => b.textContent === 'File');
  t.ok(fileBtn, 'File menu present');
  fileBtn.dispatchEvent(mouse('click', 0, 0));
  const menuEl = doc.querySelector('.ctx-menu.open');
  t.ok(menuEl && menuEl.textContent.includes('New Project'), 'File dropdown rendered');
  OS.dialogs.closeMenus();

  /* ---------- canvas context menu ---------- */
  app.openDiagram(CD());
  vStudent = V(M('Student'));
  app.editor.setSelection([vStudent]);
  app.editor.emit('contextmenu', { view: vStudent, world: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, nativeEvent: { clientX: 50, clientY: 50 } });
  const ctxMenu = doc.querySelector('.ctx-menu');
  t.ok(ctxMenu, 'canvas context menu shown');
  t.ok(ctxMenu.textContent.includes('Rename'), 'context menu has Rename');
  OS.dialogs.closeMenus();

  /* ---------- exports ---------- */
  let exportErr = null;
  try {
    app.runCommand('export-svg');
    app.runCommand('export-xmi');
    app.runCommand('export-plantuml');
    app.runCommand('export-markdown');
    app.runCommand('export-png');
    app.runCommand('print');
  } catch (e) { exportErr = e; }
  t.ok(!exportErr, 'all export commands run without error' + (exportErr ? ': ' + exportErr.stack : ''));

  /* ---------- app-level save → load round-trip ---------- */
  const saved = OS.Mdj.serialize(app.project);
  app.loadProjectText(saved, 'demo.mdj');
  t.eq(app.project.diagrams().length, 7, 'app-level save → load round-trip');
  t.ok(doc.querySelectorAll('#tabs-host .diagram-tab').length >= 1, 'tab reopened after load');

  /* ---------- title & status ---------- */
  t.ok(doc.title.includes('OpenStar UML'), 'window title branded');
  t.ok(doc.getElementById('status-right').querySelectorAll('.status-btn').length >= 4, 'status bar zoom controls');

  /* ---------- close flow (browser mode) — LAST: jsdom window.close() tears down the document ---------- */
  t.ok(typeof app.bridge.closeWindow === 'function', 'bridge exposes closeWindow');
  t.doesNotThrow(() => app.runCommand('exit'), 'exit command is safe in browser mode');
}
