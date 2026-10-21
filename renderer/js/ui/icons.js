/*
 * OpenStar UML — inline SVG icon set (16×16, stroke follows CSS color).
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};

  // Each icon: array of SVG child elements (paths/shapes), drawn in a 16x16 box.
  var S = { fill: 'fill="currentColor"', stroke: 'fill="none" stroke="currentColor" stroke-width="1.2"' };

  var ICONS = {
    project: '<rect x="2" y="3" width="12" height="10" rx="1" ' + S.stroke + '/><path d="M2 6h12" ' + S.stroke + '/>',
    model: '<path d="M2 5.5 4.5 3h4L10 4.5h4v8H2z" ' + S.stroke + '/>',
    package: '<path d="M2 5.5 4.5 3h4L10 4.5h4v8H2z" ' + S.stroke + '/>',
    subsystem: '<rect x="2" y="3" width="12" height="10" ' + S.stroke + '/><rect x="0.8" y="5.5" width="2.6" height="2" ' + S.stroke + '/><rect x="0.8" y="9" width="2.6" height="2" ' + S.stroke + '/>',
    'class': '<rect x="2.5" y="2.5" width="11" height="11" ' + S.stroke + '/><path d="M2.5 6h11M2.5 9.5h11" ' + S.stroke + '/>',
    interface: '<circle cx="8" cy="4.2" r="2.2" ' + S.stroke + '/><path d="M8 6.4V13.5" ' + S.stroke + '/>',
    enumeration: '<rect x="2.5" y="2.5" width="11" height="11" ' + S.stroke + '/><path d="M2.5 6h11" ' + S.stroke + '/><circle cx="5" cy="8" r="0.6" fill="currentColor"/><path d="M6.6 8h5M6.6 10.8h5" ' + S.stroke + '/><circle cx="5" cy="10.8" r="0.6" fill="currentColor"/>',
    datatype: '<rect x="2.5" y="3.5" width="11" height="9" ' + S.stroke + '/><path d="M5.5 8h5" ' + S.stroke + '/>',
    actor: '<circle cx="8" cy="4" r="2" ' + S.stroke + '/><path d="M8 6v4M4.5 7.6h7M8 10l-2.5 4M8 10l2.5 4" ' + S.stroke + '/>',
    usecase: '<ellipse cx="8" cy="8" rx="6" ry="4.2" ' + S.stroke + '/>',
    component: '<rect x="3.5" y="2.5" width="10.5" height="11" ' + S.stroke + '/><rect x="1.5" y="5" width="4" height="2.4" ' + S.stroke + '/><rect x="1.5" y="8.8" width="4" height="2.4" ' + S.stroke + '/>',
    artifact: '<rect x="3" y="2.5" width="10" height="11" ' + S.stroke + '/><path d="M4.8 5h4.5M4.8 7.4h6.4M4.8 9.8h6.4" ' + S.stroke + '/>',
    node: '<path d="M2 5.5 5 2.5h9v9L11 14.5H2z" ' + S.stroke + '/><path d="M2 5.5h9L14 2.5M11 5.5v9" ' + S.stroke + '/>',
    instance: '<rect x="2.5" y="3.5" width="11" height="9" ' + S.stroke + '/><path d="M5 8h6M5 8.9h6" ' + S.stroke + '/>',
    statemachine: '<rect x="2" y="3" width="12" height="10" rx="1" ' + S.stroke + '/><circle cx="5.4" cy="8" r="1.4" fill="currentColor"/><path d="M6.8 8h4.6m0 0-1.6-1.4m1.6 1.4-1.6 1.4" ' + S.stroke + '/>',
    state: '<rect x="2" y="4.5" width="12" height="7" rx="3.2" ' + S.stroke + '/>',
    compositestate: '<rect x="2" y="3.5" width="12" height="9" rx="2.6" ' + S.stroke + '/><path d="M2 6.6h12" ' + S.stroke + '/>',
    pseudostate: '<circle cx="8" cy="8" r="3" fill="currentColor"/>',
    finalstate: '<circle cx="8" cy="8" r="4.6" ' + S.stroke + '/><circle cx="8" cy="8" r="2.2" fill="currentColor"/>',
    transition: '<path d="M2.5 8h9.5m0 0-2.6-2.6m2.6 2.6-2.6 2.6" ' + S.stroke + '/>',
    activity: '<rect x="2" y="3" width="12" height="10" rx="1" ' + S.stroke + '/><circle cx="5.2" cy="8" r="1.3" fill="currentColor"/><rect x="8" y="6.4" width="4" height="3.2" rx="1.4" ' + S.stroke + '/>',
    action: '<rect x="2" y="4.8" width="12" height="6.4" rx="3" ' + S.stroke + '/>',
    controlnode: '<circle cx="8" cy="8" r="3" fill="currentColor"/>',
    controlflow: '<path d="M2.5 8h9.5m0 0-2.6-2.6m2.6 2.6-2.6 2.6" ' + S.stroke + '/>',
    objectnode: '<rect x="2.5" y="4.8" width="11" height="6.4" ' + S.stroke + '/><path d="M5.5 8h5" ' + S.stroke + '/>',
    lifeline: '<rect x="3" y="2.5" width="10" height="4" ' + S.stroke + '/><path d="M8 6.5v7" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2" fill="none"/>',
    message: '<path d="M2 8h10m0 0-2.6-2.4M12 8l-2.6 2.4" ' + S.stroke + '/>',
    fragment: '<rect x="2" y="3" width="12" height="10" ' + S.stroke + '/><path d="M2 3h4v2.6L4.6 7H2z" ' + S.stroke + '/>',
    operand: '<rect x="2.5" y="4" width="11" height="8" ' + S.stroke + '/><path d="M2.5 8h11" stroke="currentColor" stroke-dasharray="2 2"/>',
    association: '<path d="M2.5 8h11" ' + S.stroke + '/>',
    'directed-association': '<path d="M2.5 8h9.5m0 0-2.6-2.4m2.6 2.4-2.6 2.4" ' + S.stroke + '/>',
    aggregation: '<path d="M2.5 8h11M2.5 8 5 5.8 7.5 8 5 10.2z" ' + S.stroke + '/>',
    composition: '<path d="M2.5 8h11" ' + S.stroke + '/><path d="M2.5 8 5 5.8 7.5 8 5 10.2z" fill="currentColor" stroke="currentColor" stroke-width="1"/>',
    generalization: '<path d="M2.5 8h6.8M12.8 8 9.3 5.6v4.8z" ' + S.stroke + '/>',
    realization: '<path d="M2.5 8h6.8M12.8 8 9.3 5.6v4.8z" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2.4 1.8" fill="none"/>',
    dependency: '<path d="M2.5 8h7.9m0 0-2.6-2.4m2.6 2.4-2.6 2.4" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2.6 2" fill="none"/>',
    'interface-realization': '<path d="M2.5 8h6.8M12.8 8 9.3 5.6v4.8z" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2.4 1.8" fill="none"/>',
    interfacerealization: '<path d="M2.5 8h6.8M12.8 8 9.3 5.6v4.8z" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2.4 1.8" fill="none"/>',
    include: '<path d="M2.5 8h7.9m0 0-2.6-2.4m2.6 2.4-2.6 2.4" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2.6 2" fill="none"/>',
    extend: '<path d="M2.5 8h7.9m0 0-2.6-2.4m2.6 2.4-2.6 2.4" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2.6 2" fill="none"/>',
    connector: '<path d="M2.5 8h11" ' + S.stroke + '/><circle cx="5.2" cy="8" r="1.4" ' + S.stroke + '/><path d="M6.6 8h1.4" ' + S.stroke + '/>',
    communicationpath: '<path d="M2.5 8h11" ' + S.stroke + '/>',
    note: '<path d="M3 2.5h7l3.5 3.5v7.5H3z" ' + S.stroke + '/><path d="M10 2.5V6h3.5" ' + S.stroke + '/>',
    notelink: '<path d="M2.5 8h11" ' + S.stroke + '/>',
    attribute: '<path d="M4 8h8" ' + S.stroke + '/><circle cx="3" cy="8" r="1" fill="currentColor"/>',
    operation: '<path d="M4 8h8" ' + S.stroke + '/><circle cx="3" cy="8" r="1" fill="currentColor"/><path d="M9.5 5.5 12 8l-2.5 2.5" ' + S.stroke + '/>',
    parameter: '<circle cx="5" cy="8" r="1.2" fill="currentColor"/><path d="M7.5 8h5" ' + S.stroke + '/>',
    literal: '<circle cx="5" cy="8" r="1.2" fill="currentColor"/><path d="M7.5 8h5" ' + S.stroke + '/>',
    end: '<path d="M2.5 8h11" ' + S.stroke + '/><circle cx="12" cy="8" r="1.6" ' + S.stroke + '/>',
    region: '<rect x="2.5" y="3" width="11" height="10" ' + S.stroke + '/><path d="M8 3v10" stroke="currentColor" stroke-dasharray="2 2"/>',
    tag: '<path d="M3 3h5l5 5-5 5-5-5z" ' + S.stroke + '/><circle cx="5.8" cy="5.8" r="0.9" fill="currentColor"/>',
    unknown: '<circle cx="8" cy="8" r="5" ' + S.stroke + '/><path d="M6.3 6.3a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1v.4" ' + S.stroke + '/><circle cx="8" cy="11.4" r="0.7" fill="currentColor"/>',
    pointer: '<path d="M4 2.5 12.5 8 8.7 8.9 10.8 13 8.9 13.9 6.8 9.8 4 12z" fill="currentColor" stroke="currentColor" stroke-width="0.6" stroke-linejoin="round"/>',
    'class-diagram': '<rect x="1.5" y="2.5" width="5.5" height="4.5" ' + S.stroke + '/><rect x="9" y="9" width="5.5" height="4.5" ' + S.stroke + '/><path d="M4.2 7v3.2h4.8" ' + S.stroke + '/>',
    'usecase-diagram': '<ellipse cx="9.5" cy="6" rx="4" ry="2.8" ' + S.stroke + '/><circle cx="3.4" cy="4.4" r="1.3" ' + S.stroke + '/><path d="M3.4 5.7v2.6m-1.6-1.7h3.2m-2.6 3.6 1-1.9 1 1.9" ' + S.stroke + '/><path d="M4.7 6.3 6.2 6.1" ' + S.stroke + '/>',
    'sequence-diagram': '<rect x="2" y="2.5" width="4" height="2.6" ' + S.stroke + '/><rect x="10" y="2.5" width="4" height="2.6" ' + S.stroke + '/><path d="M4 5.1v8M12 5.1v8" stroke="currentColor" stroke-dasharray="2 2" fill="none"/><path d="M4 8.5h8m0 0-2-1.5m2 1.5-2 1.5" ' + S.stroke + '/>',
    'state-diagram': '<circle cx="3.4" cy="8" r="1.6" fill="currentColor"/><rect x="6.4" y="5.4" width="5.2" height="5.2" rx="2.4" ' + S.stroke + '/><path d="M5 8h1.4" ' + S.stroke + '/><circle cx="13.4" cy="8" r="1.5" ' + S.stroke + '/><circle cx="13.4" cy="8" r="0.7" fill="currentColor"/>',
    'activity-diagram': '<circle cx="8" cy="2.8" r="1.5" fill="currentColor"/><rect x="4.6" y="5.8" width="6.8" height="3.6" rx="1.7" ' + S.stroke + '/><path d="M8 4.3v1.5M8 9.4v1.8" ' + S.stroke + '/><path d="M5.5 13.5h5" stroke="currentColor" stroke-width="1.6"/>',
    'component-diagram': '<rect x="4" y="3" width="9" height="10" ' + S.stroke + '/><rect x="2.2" y="5.4" width="3.4" height="2" ' + S.stroke + '/><rect x="2.2" y="9" width="3.4" height="2" ' + S.stroke + '/>',
    'deployment-diagram': '<path d="M2 5.5 5 2.5h9v9L11 14.5H2z" ' + S.stroke + '/><path d="M2 5.5h9L14 2.5M11 5.5v9" ' + S.stroke + '/>',
    'package-diagram': '<path d="M1.5 5 4 2.5h3.5L9 4h5.5v9H1.5z" ' + S.stroke + '/><path d="M6.5 8.5h6M9.5 5.5v6" ' + S.stroke + '/>',
    diagram: '<rect x="2.5" y="2" width="11" height="12" rx="1" ' + S.stroke + '/><path d="M5 5.5h6M5 8h6M5 10.5h4" ' + S.stroke + '/>',
    /* tool aliases */
    boundary: '<rect x="2" y="3" width="12" height="10" ' + S.stroke + '/><path d="M5.6 3v2.6h5" ' + S.stroke + '/>',
    initial: '<circle cx="8" cy="8" r="3.4" fill="currentColor"/>',
    final: '<circle cx="8" cy="8" r="4.6" ' + S.stroke + '/><circle cx="8" cy="8" r="2.2" fill="currentColor"/>',
    choice: '<path d="M8 3.4 12.6 8 8 12.6 3.4 8z" ' + S.stroke + '/>',
    junction: '<circle cx="8" cy="8" r="2.4" fill="currentColor"/>',
    fork: '<path d="M3 8h10" stroke="currentColor" stroke-width="2.6"/>',
    join: '<path d="M3 8h10" stroke="currentColor" stroke-width="2.6"/>',
    shallowhistory: '<circle cx="8" cy="8" r="4.6" ' + S.stroke + '/><path d="M6.2 5.8h2.2a1.7 1.7 0 0 1 0 3.4H6.2m0 0h2.6" ' + S.stroke + '/>',
    deephistory: '<circle cx="8" cy="8" r="4.6" ' + S.stroke + '/><path d="M5.6 5.8h2a1.5 1.5 0 0 1 0 3H5.6m0 0h2.2M10 5.8v3.2m-.9 0h1.8" ' + S.stroke + '/>',
    entrypoint: '<circle cx="8" cy="8" r="3.4" ' + S.stroke + '/>',
    exitpoint: '<circle cx="8" cy="8" r="3.4" ' + S.stroke + '/><circle cx="8" cy="8" r="1.4" fill="currentColor"/>',
    terminate: '<circle cx="8" cy="8" r="4.4" ' + S.stroke + '/><path d="M5.8 5.8 10.2 10.2M10.2 5.8 5.8 10.2" ' + S.stroke + '/>',
    'async-message': '<path d="M2 8h10m0 0-2.6-2.4M12 8l-2.6 2.4" ' + S.stroke + '/>',
    'reply-message': '<path d="M2 8h10m0 0-2.6-2.4M12 8l-2.6 2.4" stroke="currentColor" stroke-dasharray="2.6 2" fill="none"/>',
    'create-message': '<path d="M2 8h10m0 0-2.6-2.4M12 8l-2.6 2.4" stroke="currentColor" stroke-dasharray="2.6 2" fill="none"/>',
    'delete-message': '<path d="M2 8h9m0 0-2.4-2.2M11 8l-2.4 2.2M13 6l2 4M15 6l-2 4" ' + S.stroke + '/>',
    'self-message': '<path d="M3 4.5h6v4H4.6m0 0 2-1.6M4.6 8.5l2 1.6" ' + S.stroke + '/>',
    'combined-fragment': '<rect x="2" y="3" width="12" height="10" ' + S.stroke + '/><path d="M2 3h4v2.6L4.6 7H2z" ' + S.stroke + '/>',
    initialnode: '<circle cx="8" cy="8" r="3.4" fill="currentColor"/>',
    activityfinalnode: '<circle cx="8" cy="8" r="4.6" ' + S.stroke + '/><circle cx="8" cy="8" r="2.2" fill="currentColor"/>',
    flowfinalnode: '<circle cx="8" cy="8" r="4.4" ' + S.stroke + '/><path d="M5.8 5.8 10.2 10.2M10.2 5.8 5.8 10.2" ' + S.stroke + '/>',
    decisionnode: '<path d="M8 3.4 12.6 8 8 12.6 3.4 8z" ' + S.stroke + '/>',
    mergenode: '<path d="M8 3.4 12.6 8 8 12.6 3.4 8z" ' + S.stroke + '/>',
    forknode: '<path d="M3 8h10" stroke="currentColor" stroke-width="2.6"/>',
    joinnode: '<path d="M3 8h10" stroke="currentColor" stroke-width="2.6"/>',
    objectflow: '<path d="M2.5 8h9.5m0 0-2.6-2.6m2.6 2.6-2.6 2.6" ' + S.stroke + '/>',
    assembly: '<path d="M2.5 8h3.2" ' + S.stroke + '/><circle cx="7" cy="8" r="1.6" ' + S.stroke + '/><path d="M8.6 8h1.6" ' + S.stroke + '/><path d="M10.2 5.6a2.6 2.6 0 0 1 0 4.8" ' + S.stroke + '/><path d="M12.5 8h1" ' + S.stroke + '/>',
    provided: '<circle cx="11" cy="8" r="1.8" ' + S.stroke + '/><path d="M2.5 8h6.7" ' + S.stroke + '/>',
    required: '<path d="M10.2 5.6a2.6 2.6 0 0 0 0 4.8M2.5 8h5m0 0 1.6-2.2M7.5 8 9.1 10.2" ' + S.stroke + '/>',
    'comm-path': '<path d="M2.5 8h11" ' + S.stroke + '/>',
    'interface-lollipop': '<circle cx="8" cy="4.2" r="2.2" ' + S.stroke + '/><path d="M8 6.4V13.5" ' + S.stroke + '/>'
  };

  // type → icon key fallbacks
  var TYPE_ICON = {
    'UMLClass': 'class', 'UMLInterface': 'interface', 'UMLEnumeration': 'enumeration',
    'UMLDataType': 'datatype', 'UMLPackage': 'package', 'UMLModel': 'model', 'UMLSubsystem': 'subsystem',
    'UMLActor': 'actor', 'UMLUseCase': 'usecase', 'UMLComponent': 'component', 'UMLArtifact': 'artifact',
    'UMLNode': 'node', 'UMLInstance': 'instance', 'UMLStateMachine': 'statemachine', 'UMLState': 'state',
    'UMLCompositeState': 'compositestate', 'UMLPseudostate': 'pseudostate', 'UMLFinalState': 'finalstate',
    'UMLTransition': 'transition', 'UMLActivity': 'activity', 'UMLAction': 'action',
    'UMLControlFlow': 'controlflow', 'UMLObjectFlow': 'objectflow', 'UMLObjectNode': 'objectnode',
    'UMLInitialNode': 'initialnode', 'UMLActivityFinalNode': 'activityfinalnode', 'UMLFlowFinalNode': 'flowfinalnode',
    'UMLDecisionNode': 'decisionnode', 'UMLMergeNode': 'mergenode', 'UMLForkNode': 'forknode', 'UMLJoinNode': 'joinnode',
    'UMLLifeline': 'lifeline', 'UMLMessage': 'message', 'UMLCombinedFragment': 'fragment',
    'UMLInteractionOperand': 'operand', 'UMLAssociation': 'association', 'UMLAssociationEnd': 'end',
    'UMLGeneralization': 'generalization', 'UMLRealization': 'realization', 'UMLDependency': 'dependency',
    'UMLInterfaceRealization': 'interfacerealization', 'UMLInclude': 'include', 'UMLExtend': 'extend',
    'UMLConnector': 'connector', 'UMLCommunicationPath': 'communicationpath', 'UMLNote': 'note',
    'UMLNoteLink': 'notelink', 'UMLAttribute': 'attribute', 'UMLOperation': 'operation',
    'UMLParameter': 'parameter', 'UMLReception': 'operation', 'UMLEnumerationLiteral': 'literal',
    'UMLRegion': 'region', 'UMLTag': 'tag', 'Project': 'project',
    'UMLClassDiagram': 'class-diagram', 'UMLUseCaseDiagram': 'usecase-diagram',
    'UMLSequenceDiagram': 'sequence-diagram', 'UMLStatechartDiagram': 'state-diagram',
    'UMLActivityDiagram': 'activity-diagram', 'UMLComponentDiagram': 'component-diagram',
    'UMLDeploymentDiagram': 'deployment-diagram', 'UMLPackageDiagram': 'package-diagram',
    'GenericDiagram': 'diagram'
  };

  function svg(key, size, cls) {
    var body = ICONS[key];
    if (!body) body = ICONS.unknown;
    size = size || 16;
    return '<svg class="icon ' + (cls || '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 16 16" aria-hidden="true">' + body + '</svg>';
  }

  function iconForType(type, size, cls) {
    return svg(TYPE_ICON[type] || 'unknown', size, cls);
  }

  OS.icons = { svg: svg, iconForType: iconForType, TYPE_ICON: TYPE_ICON, has: function (k) { return !!ICONS[k]; } };
})(typeof window !== 'undefined' ? window : globalThis);
