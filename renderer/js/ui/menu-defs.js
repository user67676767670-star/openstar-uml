/*
 * OpenStar UML — shared menu definitions.
 * Used both by the Electron main-process menu (main/menu.js) and by the
 * in-browser fallback menubar (ui/menubar.js), so both stay in sync.
 *
 * item: {cmd, label, accel, sep:true, submenu:[...], checkable:true, role}
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};

  var defs = [
    {
      id: 'file', label: 'File', items: [
        { cmd: 'new-project', label: 'New Project', accel: 'CmdOrCtrl+N' },
        { cmd: 'open-project', label: 'Open…', accel: 'CmdOrCtrl+O' },
        { sep: true },
        { cmd: 'save-project', label: 'Save', accel: 'CmdOrCtrl+S' },
        { cmd: 'save-project-as', label: 'Save As…', accel: 'CmdOrCtrl+Shift+S' },
        { sep: true },
        { cmd: 'import-xmi', label: 'Import XMI…' },
        {
          label: 'Export', submenu: [
            { cmd: 'export-png', label: 'PNG Image…' },
            { cmd: 'export-svg', label: 'SVG Image…' },
            { cmd: 'export-xmi', label: 'XMI…' },
            { sep: true },
            { cmd: 'export-plantuml', label: 'PlantUML (Current Diagram)…' },
            { cmd: 'export-plantuml-all', label: 'PlantUML (All Diagrams)…' },
            { cmd: 'export-markdown', label: 'Markdown Documentation…' }
          ]
        },
        { sep: true },
        { cmd: '__recent__', label: 'Open Recent', submenu: [] },
        { sep: true },
        { cmd: 'exit', label: 'Quit', accel: 'CmdOrCtrl+Q', role: 'quit' }
      ]
    },
    {
      id: 'edit', label: 'Edit', items: [
        { cmd: 'undo', label: 'Undo', accel: 'CmdOrCtrl+Z' },
        { cmd: 'redo', label: 'Redo', accel: 'CmdOrCtrl+Shift+Z' },
        { sep: true },
        { cmd: 'cut', label: 'Cut', accel: 'CmdOrCtrl+X' },
        { cmd: 'copy', label: 'Copy', accel: 'CmdOrCtrl+C' },
        { cmd: 'paste', label: 'Paste', accel: 'CmdOrCtrl+V' },
        { cmd: 'delete', label: 'Delete', accel: 'Delete' },
        { cmd: 'duplicate', label: 'Duplicate', accel: 'CmdOrCtrl+D' },
        { sep: true },
        { cmd: 'select-all', label: 'Select All', accel: 'CmdOrCtrl+A' },
        { cmd: 'rename', label: 'Rename', accel: 'F2' }
      ]
    },
    {
      id: 'model', label: 'Model', items: [
        {
          label: 'New Element', submenu: [
            { cmd: 'new-element:UMLClass', label: 'Class' },
            { cmd: 'new-element:UMLInterface', label: 'Interface' },
            { cmd: 'new-element:UMLEnumeration', label: 'Enumeration' },
            { cmd: 'new-element:UMLDataType', label: 'Data Type' },
            { cmd: 'new-element:UMLPackage', label: 'Package' },
            { sep: true },
            { cmd: 'new-element:UMLActor', label: 'Actor' },
            { cmd: 'new-element:UMLUseCase', label: 'Use Case' },
            { cmd: 'new-element:UMLComponent', label: 'Component' },
            { cmd: 'new-element:UMLArtifact', label: 'Artifact' },
            { cmd: 'new-element:UMLNode', label: 'Node' },
            { sep: true },
            { cmd: 'new-element:UMLStateMachine', label: 'State Machine' },
            { cmd: 'new-element:UMLActivity', label: 'Activity' },
            { cmd: 'new-element:UMLNote', label: 'Note' }
          ]
        },
        {
          label: 'New Diagram', submenu: [
            { cmd: 'new-diagram:UMLClassDiagram', label: 'Class Diagram' },
            { cmd: 'new-diagram:UMLUseCaseDiagram', label: 'Use Case Diagram' },
            { cmd: 'new-diagram:UMLSequenceDiagram', label: 'Sequence Diagram' },
            { cmd: 'new-diagram:UMLStatechartDiagram', label: 'Statechart Diagram' },
            { cmd: 'new-diagram:UMLActivityDiagram', label: 'Activity Diagram' },
            { cmd: 'new-diagram:UMLComponentDiagram', label: 'Component Diagram' },
            { cmd: 'new-diagram:UMLDeploymentDiagram', label: 'Deployment Diagram' },
            { cmd: 'new-diagram:UMLPackageDiagram', label: 'Package Diagram' }
          ]
        },
        { sep: true },
        { cmd: 'edit-selected', label: 'Edit Selected Element…' }
      ]
    },
    {
      id: 'format', label: 'Format', items: [
        {
          label: 'Align', submenu: [
            { cmd: 'align-left', label: 'Left' },
            { cmd: 'align-center', label: 'Center' },
            { cmd: 'align-right', label: 'Right' },
            { cmd: 'align-top', label: 'Top' },
            { cmd: 'align-middle', label: 'Middle' },
            { cmd: 'align-bottom', label: 'Bottom' }
          ]
        },
        {
          label: 'Distribute', submenu: [
            { cmd: 'distribute-horizontal', label: 'Horizontal' },
            { cmd: 'distribute-vertical', label: 'Vertical' }
          ]
        },
        { sep: true },
        { cmd: 'z-front', label: 'Bring to Front' },
        { cmd: 'z-forward', label: 'Bring Forward' },
        { cmd: 'z-backward', label: 'Send Backward' },
        { cmd: 'z-back', label: 'Send to Back' }
      ]
    },
    {
      id: 'view', label: 'View', items: [
        { cmd: 'zoom-in', label: 'Zoom In', accel: 'CmdOrCtrl+=' },
        { cmd: 'zoom-out', label: 'Zoom Out', accel: 'CmdOrCtrl+-' },
        { cmd: 'zoom-actual', label: 'Actual Size', accel: 'CmdOrCtrl+0' },
        { cmd: 'zoom-fit', label: 'Fit to Window', accel: 'CmdOrCtrl+Shift+F' },
        { sep: true },
        { cmd: 'toggle-grid', label: 'Grid', checkable: true },
        { cmd: 'toggle-snap', label: 'Snap to Grid', checkable: true },
        { sep: true },
        { cmd: 'toggle-explorer', label: 'Model Explorer', checkable: true },
        { cmd: 'toggle-properties', label: 'Property Editor', checkable: true },
        { cmd: 'toggle-toolbox', label: 'Toolbox', checkable: true }
      ]
    },
    {
      id: 'tools', label: 'Tools', items: [
        { cmd: 'preferences', label: 'Preferences…' }
      ]
    },
    {
      id: 'help', label: 'Help', items: [
        { cmd: 'about', label: 'About OpenStar UML' },
        { cmd: 'shortcuts', label: 'Keyboard Shortcuts…' },
        { sep: true },
        { cmd: 'open-external:https://github.com/openstar-uml/openstar-uml', label: 'Project Website' },
        { cmd: 'license', label: 'License (MIT)' }
      ]
    }
  ];

  OS.menuDefs = { defs: defs };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OS;
  }
})(typeof window !== 'undefined' ? window : globalThis);
