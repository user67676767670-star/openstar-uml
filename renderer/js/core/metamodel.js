/*
 * OpenStar UML — UML metamodel registry.
 * Defines every supported model element type, view type, diagram type,
 * toolbox composition, default values and property-panel schemas.
 * StarUML .mdj-compatible type names and field names are used throughout.
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};

  /* ============================ helpers ============================ */

  function baseNamed(extra) {
    var d = { name: '', stereotype: '', visibility: 'public', documentation: '' };
    if (extra) for (var k in extra) d[k] = extra[k];
    return d;
  }
  function baseRel(extra) {
    var d = { name: '', stereotype: '', visibility: 'public', source: null, target: null };
    if (extra) for (var k in extra) d[k] = extra[k];
    return d;
  }

  /* ============================ model element types ============================ */
  /*
   * descriptor fields:
   *  label        — human readable name
   *  category     — namespace | classifier | feature | relationship | statemachine |
   *                 activity | interaction | annotation | diagram | misc
   *  defaults()   — fresh element fields
   *  refs         — fields holding element references (serialized as {$ref})
   *  childLists   — fields holding arrays of owned child elements
   *  props        — property panel schema (model tab)
   *  viewFlags    — property panel schema (format tab, view-specific toggles)
   *  icon         — icon key (see ui/icons.js)
   *  allowedChildren — types that may be created inside (explorer context menu)
   */

  var TYPES = {};

  function def(type, descriptor) {
    descriptor.type = type;
    if (!descriptor.defaults) descriptor.defaults = function () { return {}; };
    TYPES[type] = descriptor;
    return descriptor;
  }

  /* ---- property field shorthands ---- */
  function pText(key, label, ro) { return { key: key, label: label || key, type: 'text', readOnly: !!ro }; }
  function pArea(key, label) { return { key: key, label: label || key, type: 'multiline' }; }
  function pCheck(key, label) { return { key: key, label: label || key, type: 'check' }; }
  function pSelect(key, label, options) { return { key: key, label: label || key, type: 'select', options: options }; }
  function pList(key, label, itemType) { return { key: key, label: label || key, type: 'list', itemType: itemType }; }
  function pRef(key, label, filter) { return { key: key, label: label || key, type: 'elemref', filter: filter }; }

  var VIS_OPTS = ['public', 'private', 'protected', 'package'];
  var MULT_OPTS = ['', '1', '0..1', '*', '1..*', '0..*'];
  var AGGR_OPTS = ['none', 'shared', 'composite'];
  var DIR_OPTS = ['in', 'out', 'inout', 'return'];
  var MSG_OPTS = ['synchCall', 'asynchCall', 'asynchSignal', 'replyMessage', 'createMessage', 'deleteMessage'];
  var PSEUDO_OPTS = ['initial', 'junction', 'fork', 'join', 'choice', 'shallowHistory', 'deepHistory', 'entryPoint', 'exitPoint', 'terminate'];
  var OPERATOR_OPTS = ['seq', 'alt', 'opt', 'loop', 'break', 'par', 'critical', 'ignore', 'consider', 'assert', 'neg', 'strict', 'ref'];

  /* common property schemas */
  var NAME_STEREO_VIS = [pText('name', 'Name'), pText('stereotype', 'Stereotype'), pSelect('visibility', 'Visibility', VIS_OPTS)];
  var DOC = [pArea('documentation', 'Documentation')];

  var ATTRIBUTE_PROPS = [
    pText('name', 'Name'), pSelect('visibility', 'Vis', VIS_OPTS), pText('type', 'Type'),
    pText('multiplicity', 'Mult'), pText('defaultValue', 'Default'),
    pCheck('isStatic', 'Static'), pCheck('isReadOnly', 'ReadOnly'), pCheck('isID', 'IsID'),
    pText('stereotype', 'Stereotype')
  ];
  var PARAM_PROPS = [
    pText('name', 'Name'), pSelect('direction', 'Dir', DIR_OPTS), pText('type', 'Type'),
    pText('multiplicity', 'Mult'), pText('defaultValue', 'Default')
  ];
  var OPERATION_PROPS = [
    pText('name', 'Name'), pSelect('visibility', 'Vis', VIS_OPTS),
    pCheck('isStatic', 'Static'), pCheck('isAbstract', 'Abstract'), pCheck('isQuery', 'Query'),
    pList('parameters', 'Parameters', 'UMLParameter'),
    pText('stereotype', 'Stereotype')
  ];
  var END_PROPS = [
    pRef('reference', 'Reference', 'classifier'), pText('name', 'Role'),
    pSelect('visibility', 'Vis', VIS_OPTS), pSelect('multiplicity', 'Mult', MULT_OPTS),
    pSelect('aggregation', 'Aggregation', AGGR_OPTS), pCheck('navigable', 'Navigable'),
    pCheck('isReadOnly', 'ReadOnly'), pCheck('isDerived', 'Derived'),
    pText('defaultValue', 'Default')
  ];

  /* ---- root & namespaces ---- */

  def('Project', {
    label: 'Project', category: 'misc', icon: 'project',
    defaults: function () { return { name: 'Untitled', ownedElements: [] }; },
    childLists: ['ownedElements'],
    allowedChildren: ['UMLModel']
  });

  def('UMLModel', {
    label: 'Model', category: 'namespace', icon: 'model',
    defaults: function () { return baseNamed(); },
    childLists: ['ownedElements'], refs: [],
    props: NAME_STEREO_VIS.concat(DOC),
    allowedChildren: ['UMLPackage', 'UMLClass', 'UMLInterface', 'UMLEnumeration', 'UMLDataType',
      'UMLActor', 'UMLUseCase', 'UMLComponent', 'UMLArtifact', 'UMLNode', 'UMLStateMachine',
      'UMLActivity', 'UMLClassDiagram', 'UMLUseCaseDiagram', 'UMLSequenceDiagram',
      'UMLStatechartDiagram', 'UMLActivityDiagram', 'UMLComponentDiagram', 'UMLDeploymentDiagram',
      'UMLPackageDiagram']
  });

  def('UMLPackage', {
    label: 'Package', category: 'namespace', icon: 'package',
    defaults: function () { return baseNamed(); },
    childLists: ['ownedElements'],
    props: NAME_STEREO_VIS.concat(DOC),
    viewFlags: [{ key: 'wordWrap', label: 'Word Wrap', type: 'check' }],
    allowedChildren: ['UMLPackage', 'UMLClass', 'UMLInterface', 'UMLEnumeration', 'UMLDataType',
      'UMLActor', 'UMLUseCase', 'UMLComponent', 'UMLArtifact', 'UMLNode', 'UMLStateMachine',
      'UMLActivity', 'UMLClassDiagram', 'UMLUseCaseDiagram', 'UMLSequenceDiagram',
      'UMLStatechartDiagram', 'UMLActivityDiagram', 'UMLComponentDiagram', 'UMLDeploymentDiagram',
      'UMLPackageDiagram']
  });

  def('UMLSubsystem', {
    label: 'Subsystem', category: 'namespace', icon: 'subsystem',
    defaults: function () { return baseNamed(); },
    childLists: ['ownedElements'],
    props: NAME_STEREO_VIS.concat(DOC),
    allowedChildren: ['UMLComponent', 'UMLInterface', 'UMLClass', 'UMLArtifact', 'UMLPackage']
  });

  /* ---- classifiers ---- */

  var CLASSIFIER_BASE = {
    defaults: function () {
      return baseNamed({ isAbstract: false, isFinalSpecialization: false, ownedAttributes: [], ownedOperations: [] });
    },
    childLists: ['ownedElements', 'ownedAttributes', 'ownedOperations'],
    refs: [],
    props: NAME_STEREO_VIS.concat([
      pCheck('isAbstract', 'Abstract'), pCheck('isFinalSpecialization', 'Final'),
      pList('ownedAttributes', 'Attributes', 'UMLAttribute'),
      pList('ownedOperations', 'Operations', 'UMLOperation')
    ]).concat(DOC),
    viewFlags: [
      { key: 'wordWrap', label: 'Word Wrap', type: 'check' },
      { key: 'showVisibility', label: 'Show Visibility', type: 'check' },
      { key: 'showNamespace', label: 'Show Namespace', type: 'check' },
      { key: 'showProperty', label: 'Show Property', type: 'check' },
      { key: 'showType', label: 'Show Type', type: 'check' },
      { key: 'showMultiplicity', label: 'Show Multiplicity', type: 'check' },
      { key: 'suppressAttributes', label: 'Suppress Attributes', type: 'check' },
      { key: 'suppressOperations', label: 'Suppress Operations', type: 'check' },
      { key: 'suppressLiterals', label: 'Suppress Literals', type: 'check' }
    ],
    allowedChildren: ['UMLAttribute', 'UMLOperation', 'UMLClass', 'UMLInterface', 'UMLEnumeration']
  };

  def('UMLClass', Object.assign({ label: 'Class', category: 'classifier', icon: 'class' }, CLASSIFIER_BASE));
  def('UMLInterface', Object.assign({ label: 'Interface', category: 'classifier', icon: 'interface' }, CLASSIFIER_BASE));

  def('UMLEnumeration', {
    label: 'Enumeration', category: 'classifier', icon: 'enumeration',
    defaults: function () { return baseNamed({ ownedLiterals: [] }); },
    childLists: ['ownedElements', 'ownedLiterals'],
    props: NAME_STEREO_VIS.concat([
      pList('ownedLiterals', 'Literals', 'UMLEnumerationLiteral')
    ]).concat(DOC),
    viewFlags: [{ key: 'wordWrap', label: 'Word Wrap', type: 'check' },
      { key: 'suppressLiterals', label: 'Suppress Literals', type: 'check' }],
    allowedChildren: ['UMLEnumerationLiteral']
  });

  def('UMLEnumerationLiteral', {
    label: 'Literal', category: 'feature', icon: 'literal',
    defaults: function () { return { name: '' }; },
    props: [pText('name', 'Name')]
  });

  def('UMLDataType', {
    label: 'Data Type', category: 'classifier', icon: 'datatype',
    defaults: function () { return baseNamed(); },
    childLists: ['ownedElements', 'ownedAttributes', 'ownedOperations'],
    props: NAME_STEREO_VIS.concat(DOC),
    allowedChildren: ['UMLAttribute', 'UMLOperation']
  });

  def('UMLActor', {
    label: 'Actor', category: 'classifier', icon: 'actor',
    defaults: function () { return baseNamed({ isAbstract: false }); },
    childLists: ['ownedElements', 'ownedAttributes', 'ownedOperations'],
    props: NAME_STEREO_VIS.concat([pCheck('isAbstract', 'Abstract')]).concat(DOC),
    viewFlags: [{ key: 'wordWrap', label: 'Word Wrap', type: 'check' }, { key: 'showVisibility', label: 'Show Visibility', type: 'check' }],
    allowedChildren: ['UMLAttribute', 'UMLOperation']
  });

  def('UMLUseCase', {
    label: 'Use Case', category: 'classifier', icon: 'usecase',
    defaults: function () { return baseNamed({ isAbstract: false }); },
    childLists: ['ownedElements', 'ownedAttributes', 'ownedOperations'],
    props: NAME_STEREO_VIS.concat([pCheck('isAbstract', 'Abstract')]).concat(DOC),
    viewFlags: [{ key: 'wordWrap', label: 'Word Wrap', type: 'check' }, { key: 'showVisibility', label: 'Show Visibility', type: 'check' }],
    allowedChildren: ['UMLAttribute', 'UMLOperation']
  });

  def('UMLComponent', {
    label: 'Component', category: 'classifier', icon: 'component',
    defaults: function () { return baseNamed({ isAbstract: false }); },
    childLists: ['ownedElements', 'ownedAttributes', 'ownedOperations'],
    props: NAME_STEREO_VIS.concat([pCheck('isAbstract', 'Abstract')]).concat(DOC),
    viewFlags: [{ key: 'wordWrap', label: 'Word Wrap', type: 'check' }, { key: 'showVisibility', label: 'Show Visibility', type: 'check' }],
    allowedChildren: ['UMLArtifact', 'UMLComponent', 'UMLClass', 'UMLInterface']
  });

  def('UMLArtifact', {
    label: 'Artifact', category: 'classifier', icon: 'artifact',
    defaults: function () { return baseNamed({ fileName: '' }); },
    childLists: ['ownedElements'],
    props: NAME_STEREO_VIS.concat([pText('fileName', 'File Name')]).concat(DOC),
    viewFlags: [{ key: 'wordWrap', label: 'Word Wrap', type: 'check' }, { key: 'showVisibility', label: 'Show Visibility', type: 'check' }],
    allowedChildren: ['UMLArtifact', 'UMLComponent']
  });

  def('UMLNode', {
    label: 'Node', category: 'classifier', icon: 'node',
    defaults: function () { return baseNamed(); },
    childLists: ['ownedElements'],
    props: NAME_STEREO_VIS.concat(DOC),
    viewFlags: [{ key: 'wordWrap', label: 'Word Wrap', type: 'check' }, { key: 'showVisibility', label: 'Show Visibility', type: 'check' }],
    allowedChildren: ['UMLArtifact', 'UMLComponent', 'UMLNode', 'UMLInstance']
  });

  def('UMLInstance', {
    label: 'Instance', category: 'classifier', icon: 'instance',
    defaults: function () { return baseNamed({ classifier: null }); },
    refs: ['classifier'], childLists: ['ownedElements'],
    props: [pText('name', 'Name'), pRef('classifier', 'Classifier', 'classifier'), pText('stereotype', 'Stereotype')].concat(DOC),
    viewFlags: [{ key: 'wordWrap', label: 'Word Wrap', type: 'check' }]
  });

  /* ---- features ---- */

  def('UMLAttribute', {
    label: 'Attribute', category: 'feature', icon: 'attribute',
    defaults: function () {
      return {
        name: 'Attribute1', stereotype: '', visibility: 'public', isStatic: false, isLeaf: false,
        type: '', multiplicity: '', isReadOnly: false, isOrdered: false, isUnique: false,
        defaultValue: '', isID: false
      };
    },
    props: ATTRIBUTE_PROPS
  });

  def('UMLOperation', {
    label: 'Operation', category: 'feature', icon: 'operation',
    defaults: function () {
      return {
        name: 'Operation1', stereotype: '', visibility: 'public', isStatic: false, isLeaf: false,
        concurrency: 'sequential', isQuery: false, isAbstract: false, parameters: []
      };
    },
    childLists: ['parameters'],
    props: OPERATION_PROPS
  });

  def('UMLParameter', {
    label: 'Parameter', category: 'feature', icon: 'parameter',
    defaults: function () { return { name: 'Parameter1', type: '', multiplicity: '', direction: 'in', defaultValue: '', isReadOnly: false }; },
    props: PARAM_PROPS
  });

  def('UMLReception', {
    label: 'Reception', category: 'feature', icon: 'operation',
    defaults: function () { return { name: 'Reception1', stereotype: '', visibility: 'public', parameters: [] }; },
    childLists: ['parameters'],
    props: OPERATION_PROPS
  });

  /* ---- relationships ---- */

  def('UMLAssociation', {
    label: 'Association', category: 'relationship', icon: 'association',
    defaults: function () {
      return { name: '', stereotype: '', visibility: 'public', isDerived: false, ownedEnds: [] };
    },
    childLists: ['ownedEnds'],
    props: [pText('name', 'Name'), pText('stereotype', 'Stereotype'), pSelect('visibility', 'Visibility', VIS_OPTS),
      pCheck('isDerived', 'Derived'), pList('ownedEnds', 'Ends', 'UMLAssociationEnd')].concat(DOC),
    viewFlags: [{ key: 'showProperty', label: 'Show Property', type: 'check' },
      { key: 'showMultiplicity', label: 'Show Multiplicity', type: 'check' },
      { key: 'showType', label: 'Show Type', type: 'check' },
      { key: 'lineStyle', label: 'Line Style', type: 'select', options: ['straight', 'ortho'] }]
  });

  def('UMLAssociationEnd', {
    label: 'End', category: 'feature', icon: 'end',
    defaults: function () {
      return {
        name: '', stereotype: '', visibility: 'public', reference: null, multiplicity: '',
        isLeaf: false, isReadOnly: false, isOrdered: false, isUnique: false, isDerived: false,
        aggregation: 'none', navigable: true, defaultValue: ''
      };
    },
    refs: ['reference'],
    props: END_PROPS
  });

  var REL_DEFAULT_PROPS = [pText('name', 'Name'), pText('stereotype', 'Stereotype'), pSelect('visibility', 'Visibility', VIS_OPTS),
    pRef('source', 'Source', 'any'), pRef('target', 'Target', 'any')].concat(DOC);
  var EDGE_FLAGS_BASE = [{ key: 'lineStyle', label: 'Line Style', type: 'select', options: ['straight', 'ortho'] }];

  def('UMLGeneralization', {
    label: 'Generalization', category: 'relationship', icon: 'generalization',
    defaults: function () { return baseRel(); }, refs: ['source', 'target'],
    props: REL_DEFAULT_PROPS, viewFlags: EDGE_FLAGS_BASE
  });
  def('UMLRealization', {
    label: 'Realization', category: 'relationship', icon: 'realization',
    defaults: function () { return baseRel(); }, refs: ['source', 'target'],
    props: REL_DEFAULT_PROPS, viewFlags: EDGE_FLAGS_BASE
  });
  def('UMLDependency', {
    label: 'Dependency', category: 'relationship', icon: 'dependency',
    defaults: function () { return baseRel(); }, refs: ['source', 'target'],
    props: REL_DEFAULT_PROPS, viewFlags: EDGE_FLAGS_BASE
  });
  def('UMLInterfaceRealization', {
    label: 'Interface Realization', category: 'relationship', icon: 'interfacerealization',
    defaults: function () { return baseRel(); }, refs: ['source', 'target'],
    props: REL_DEFAULT_PROPS, viewFlags: EDGE_FLAGS_BASE
  });
  def('UMLInclude', {
    label: 'Include', category: 'relationship', icon: 'include',
    defaults: function () { return baseRel(); }, refs: ['source', 'target'],
    props: [pText('stereotype', 'Stereotype', true), pRef('source', 'Source', 'any'), pRef('target', 'Target', 'any')].concat(DOC),
    viewFlags: EDGE_FLAGS_BASE
  });
  def('UMLExtend', {
    label: 'Extend', category: 'relationship', icon: 'extend',
    defaults: function () { return baseRel(); }, refs: ['source', 'target'],
    props: [pText('stereotype', 'Stereotype', true), pRef('source', 'Source', 'any'), pRef('target', 'Target', 'any')].concat(DOC),
    viewFlags: EDGE_FLAGS_BASE
  });
  def('UMLConnector', {
    label: 'Connector', category: 'relationship', icon: 'connector',
    defaults: function () { return baseRel(); }, refs: ['source', 'target'],
    props: REL_DEFAULT_PROPS, viewFlags: EDGE_FLAGS_BASE
  });
  def('UMLCommunicationPath', {
    label: 'Communication Path', category: 'relationship', icon: 'communicationpath',
    defaults: function () { return baseRel({ name: '' }); }, refs: ['source', 'target'],
    props: REL_DEFAULT_PROPS, viewFlags: EDGE_FLAGS_BASE
  });
  def('UMLNoteLink', {
    label: 'Note Link', category: 'relationship', icon: 'notelink',
    defaults: function () { return { name: '', stereotype: '', source: null, target: null }; },
    refs: ['source', 'target'],
    props: [], viewFlags: EDGE_FLAGS_BASE
  });

  /* ---- state machine ---- */

  def('UMLStateMachine', {
    label: 'State Machine', category: 'statemachine', icon: 'statemachine',
    defaults: function () { return baseNamed(); },
    childLists: ['ownedElements'],
    props: NAME_STEREO_VIS.concat(DOC),
    viewFlags: [{ key: 'wordWrap', label: 'Word Wrap', type: 'check' }],
    allowedChildren: ['UMLState', 'UMLPseudostate', 'UMLFinalState', 'UMLRegion', 'UMLStatechartDiagram']
  });

  def('UMLRegion', {
    label: 'Region', category: 'statemachine', icon: 'region',
    defaults: function () { return baseNamed(); },
    childLists: ['ownedElements'],
    props: NAME_STEREO_VIS,
    allowedChildren: ['UMLState', 'UMLPseudostate', 'UMLFinalState', 'UMLTransition']
  });

  def('UMLState', {
    label: 'State', category: 'statemachine', icon: 'state',
    defaults: function () { return baseNamed({ entryActivity: '', doActivity: '', exitActivity: '' }); },
    childLists: ['ownedElements'],
    props: NAME_STEREO_VIS.concat([
      pText('entryActivity', 'Entry Activity'), pText('doActivity', 'Do Activity'), pText('exitActivity', 'Exit Activity')
    ]).concat(DOC),
    viewFlags: [{ key: 'wordWrap', label: 'Word Wrap', type: 'check' }, { key: 'showVisibility', label: 'Show Visibility', type: 'check' }],
    allowedChildren: ['UMLState', 'UMLPseudostate', 'UMLFinalState', 'UMLRegion']
  });

  def('UMLCompositeState', {
    label: 'Composite State', category: 'statemachine', icon: 'compositestate',
    defaults: function () { return baseNamed({ entryActivity: '', doActivity: '', exitActivity: '' }); },
    childLists: ['ownedElements'],
    props: NAME_STEREO_VIS.concat([
      pText('entryActivity', 'Entry Activity'), pText('doActivity', 'Do Activity'), pText('exitActivity', 'Exit Activity')
    ]).concat(DOC),
    viewFlags: [{ key: 'wordWrap', label: 'Word Wrap', type: 'check' }, { key: 'showVisibility', label: 'Show Visibility', type: 'check' }],
    allowedChildren: ['UMLState', 'UMLPseudostate', 'UMLFinalState', 'UMLRegion']
  });

  def('UMLPseudostate', {
    label: 'Pseudostate', category: 'statemachine', icon: 'pseudostate',
    defaults: function () { return { name: '', kind: 'initial' }; },
    props: [pText('name', 'Name'), pSelect('kind', 'Kind', PSEUDO_OPTS)]
  });

  def('UMLFinalState', {
    label: 'Final State', category: 'statemachine', icon: 'finalstate',
    defaults: function () { return { name: '' }; },
    props: [pText('name', 'Name')]
  });

  def('UMLTransition', {
    label: 'Transition', category: 'statemachine', icon: 'transition',
    defaults: function () { return baseRel({ trigger: '', guard: '', effect: '' }); },
    refs: ['source', 'target'],
    props: [pText('name', 'Name'), pText('trigger', 'Trigger'), pText('guard', 'Guard'), pText('effect', 'Effect'),
      pText('stereotype', 'Stereotype'), pRef('source', 'Source', 'any'), pRef('target', 'Target', 'any')].concat(DOC),
    viewFlags: EDGE_FLAGS_BASE
  });

  /* ---- activity ---- */

  def('UMLActivity', {
    label: 'Activity', category: 'activity', icon: 'activity',
    defaults: function () { return baseNamed({ isAbstract: false, isReentrant: true, isSingleExecution: false }); },
    childLists: ['ownedElements'],
    props: NAME_STEREO_VIS.concat(DOC),
    viewFlags: [{ key: 'wordWrap', label: 'Word Wrap', type: 'check' }],
    allowedChildren: ['UMLAction', 'UMLObjectNode', 'UMLInitialNode', 'UMLActivityFinalNode', 'UMLFlowFinalNode',
      'UMLDecisionNode', 'UMLMergeNode', 'UMLForkNode', 'UMLJoinNode', 'UMLActivityDiagram']
  });

  def('UMLAction', {
    label: 'Action', category: 'activity', icon: 'action',
    defaults: function () { return baseNamed(); },
    childLists: ['ownedElements'],
    props: NAME_STEREO_VIS.concat(DOC),
    viewFlags: [{ key: 'wordWrap', label: 'Word Wrap', type: 'check' }, { key: 'showVisibility', label: 'Show Visibility', type: 'check' }]
  });

  def('UMLObjectNode', {
    label: 'Object Node', category: 'activity', icon: 'objectnode',
    defaults: function () { return baseNamed(); },
    childLists: ['ownedElements'],
    props: NAME_STEREO_VIS.concat(DOC),
    viewFlags: [{ key: 'wordWrap', label: 'Word Wrap', type: 'check' }]
  });

  var CTRL_NODE_DEFAULTS = function () { return { name: '' }; };
  ['UMLInitialNode', 'UMLActivityFinalNode', 'UMLFlowFinalNode', 'UMLDecisionNode',
    'UMLMergeNode', 'UMLForkNode', 'UMLJoinNode'].forEach(function (t) {
    def(t, {
      label: t.replace('UML', '').replace(/([a-z])([A-Z])/g, '$1 $2'), category: 'activity', icon: 'controlnode',
      defaults: CTRL_NODE_DEFAULTS,
      props: [pText('name', 'Name')]
    });
  });

  def('UMLControlFlow', {
    label: 'Control Flow', category: 'activity', icon: 'controlflow',
    defaults: function () { return baseRel({ guard: '' }); }, refs: ['source', 'target'],
    props: [pText('name', 'Name'), pText('guard', 'Guard'), pText('stereotype', 'Stereotype'),
      pRef('source', 'Source', 'any'), pRef('target', 'Target', 'any')].concat(DOC),
    viewFlags: EDGE_FLAGS_BASE
  });

  def('UMLObjectFlow', {
    label: 'Object Flow', category: 'activity', icon: 'controlflow',
    defaults: function () { return baseRel({ guard: '' }); }, refs: ['source', 'target'],
    props: [pText('name', 'Name'), pText('guard', 'Guard'), pText('stereotype', 'Stereotype'),
      pRef('source', 'Source', 'any'), pRef('target', 'Target', 'any')].concat(DOC),
    viewFlags: EDGE_FLAGS_BASE
  });

  /* ---- interaction (sequence) ---- */

  def('UMLLifeline', {
    label: 'Lifeline', category: 'interaction', icon: 'lifeline',
    defaults: function () { return baseNamed({ represent: '', isMultiInstance: false }); },
    refs: [],
    props: [pText('name', 'Name'), pText('represent', 'Represent'), pText('stereotype', 'Stereotype'),
      pSelect('visibility', 'Visibility', VIS_OPTS)].concat(DOC),
    viewFlags: [{ key: 'wordWrap', label: 'Word Wrap', type: 'check' }]
  });

  def('UMLMessage', {
    label: 'Message', category: 'interaction', icon: 'message',
    defaults: function () { return baseRel({ messageSort: 'synchCall', arguments: '' }); },
    refs: ['source', 'target'],
    props: [pText('name', 'Name'), pSelect('messageSort', 'Sort', MSG_OPTS), pText('arguments', 'Arguments'),
      pText('stereotype', 'Stereotype'), pRef('source', 'Source', 'lifeline'), pRef('target', 'Target', 'lifeline')].concat(DOC),
    viewFlags: EDGE_FLAGS_BASE
  });

  def('UMLCombinedFragment', {
    label: 'Combined Fragment', category: 'interaction', icon: 'fragment',
    defaults: function () { return baseNamed({ operator: 'seq' }); },
    childLists: ['ownedElements'],
    props: [pText('name', 'Name'), pSelect('operator', 'Operator', OPERATOR_OPTS)].concat(DOC),
    viewFlags: [{ key: 'wordWrap', label: 'Word Wrap', type: 'check' }],
    allowedChildren: ['UMLInteractionOperand']
  });

  def('UMLInteractionOperand', {
    label: 'Operand', category: 'interaction', icon: 'operand',
    defaults: function () { return { name: '', guard: '' }; },
    props: [pText('name', 'Name'), pText('guard', 'Guard')]
  });

  /* ---- annotation ---- */

  def('UMLNote', {
    label: 'Note', category: 'annotation', icon: 'note',
    defaults: function () { return { name: 'Note', stereotype: '', visibility: 'public', documentation: '' }; },
    props: [pArea('documentation', 'Text')].concat(DOC.length ? [] : []),
    viewFlags: [{ key: 'wordWrap', label: 'Word Wrap', type: 'check' }]
  });

  def('UMLConstraint', {
    label: 'Constraint', category: 'annotation', icon: 'note',
    defaults: function () { return baseNamed({ specification: '' }); },
    props: [pText('name', 'Name'), pArea('specification', 'Specification')].concat(DOC)
  });

  def('UMLTag', { label: 'Tag', category: 'misc', icon: 'tag', defaults: function () { return { name: '', kind: 'string', value: '', checked: false }; } });

  /* generic fallback for unknown types (round-trip preservation) */
  def('UnknownElement', {
    label: 'Element', category: 'misc', icon: 'unknown',
    defaults: function () { return baseNamed(); },
    childLists: ['ownedElements'],
    props: [pText('name', 'Name'), pText('_type', 'Type', true)].concat(DOC)
  });

  /* ============================ diagram types ============================ */

  var DIAGRAM_ALIASES = {
    'UMLStateMachineDiagram': 'UMLStatechartDiagram',
    'UMLStateDiagram': 'UMLStatechartDiagram',
    'UMLStateMachineDiagram': 'UMLStatechartDiagram',
    'UMLModelDiagram': 'UMLPackageDiagram'
  };

  var DIAGRAMS = {};

  function defDiagram(type, d) {
    d.type = type;
    d.defaults = function () { return { name: d.defaultName || 'Diagram1', ownedElements: [], ownedViews: [] }; };
    d.category = 'diagram';
    d.childLists = ['ownedElements', 'ownedViews'];
    d.props = [{ key: 'name', label: 'Name', type: 'text' }, { key: '_type', label: 'Type', type: 'text', readOnly: true }];
    TYPES[type] = d;
    DIAGRAMS[type] = d;
    return d;
  }

  var NOTE_TOOLS = [
    { tool: 'note', label: 'Note', modelType: 'UMLNote', kind: 'node' },
    { tool: 'notelink', label: 'Note Link', modelType: 'UMLNoteLink', kind: 'edge' }
  ];

  defDiagram('UMLClassDiagram', {
    label: 'Class Diagram', icon: 'class-diagram', defaultName: 'Main',
    toolbox: [
      { tool: 'class', label: 'Class', modelType: 'UMLClass', kind: 'node' },
      { tool: 'interface', label: 'Interface', modelType: 'UMLInterface', kind: 'node' },
      { tool: 'enumeration', label: 'Enumeration', modelType: 'UMLEnumeration', kind: 'node' },
      { tool: 'datatype', label: 'Data Type', modelType: 'UMLDataType', kind: 'node' },
      { tool: 'package', label: 'Package', modelType: 'UMLPackage', kind: 'node' },
      { tool: 'association', label: 'Association', modelType: 'UMLAssociation', kind: 'edge' },
      { tool: 'directed-association', label: 'Directed Association', modelType: 'UMLAssociation', kind: 'edge',
        preset: { navigable: [false, true] } },
      { tool: 'aggregation', label: 'Aggregation', modelType: 'UMLAssociation', kind: 'edge',
        preset: { aggregation: [null, 'shared'] } },
      { tool: 'composition', label: 'Composition', modelType: 'UMLAssociation', kind: 'edge',
        preset: { aggregation: [null, 'composite'] } },
      { tool: 'generalization', label: 'Generalization', modelType: 'UMLGeneralization', kind: 'edge' },
      { tool: 'realization', label: 'Realization', modelType: 'UMLRealization', kind: 'edge' },
      { tool: 'interface-realization', label: 'Interface Realization', modelType: 'UMLInterfaceRealization', kind: 'edge' },
      { tool: 'dependency', label: 'Dependency', modelType: 'UMLDependency', kind: 'edge' }
    ].concat(NOTE_TOOLS),
    droppable: ['UMLClass', 'UMLInterface', 'UMLEnumeration', 'UMLDataType', 'UMLPackage', 'UMLModel',
      'UMLStateMachine', 'UMLActivity', 'UMLComponent', 'UMLArtifact', 'UMLNode', 'UMLActor', 'UMLUseCase',
      'UMLNote', 'UMLSubsystem', 'UMLInstance']
  });

  defDiagram('UMLUseCaseDiagram', {
    label: 'Use Case Diagram', icon: 'usecase-diagram', defaultName: 'UseCaseDiagram1',
    toolbox: [
      { tool: 'actor', label: 'Actor', modelType: 'UMLActor', kind: 'node' },
      { tool: 'usecase', label: 'Use Case', modelType: 'UMLUseCase', kind: 'node' },
      { tool: 'boundary', label: 'Boundary', modelType: 'UMLPackage', kind: 'node', preset: { boundary: true } },
      { tool: 'association', label: 'Association', modelType: 'UMLAssociation', kind: 'edge' },
      { tool: 'generalization', label: 'Generalization', modelType: 'UMLGeneralization', kind: 'edge' },
      { tool: 'dependency', label: 'Dependency', modelType: 'UMLDependency', kind: 'edge' },
      { tool: 'include', label: 'Include', modelType: 'UMLInclude', kind: 'edge' },
      { tool: 'extend', label: 'Extend', modelType: 'UMLExtend', kind: 'edge' }
    ].concat(NOTE_TOOLS),
    droppable: ['UMLActor', 'UMLUseCase', 'UMLPackage', 'UMLClass', 'UMLInterface', 'UMLNote']
  });

  defDiagram('UMLSequenceDiagram', {
    label: 'Sequence Diagram', icon: 'sequence-diagram', defaultName: 'SequenceDiagram1',
    toolbox: [
      { tool: 'lifeline', label: 'Lifeline', modelType: 'UMLLifeline', kind: 'node' },
      { tool: 'message', label: 'Message', modelType: 'UMLMessage', kind: 'seqedge', preset: { messageSort: 'synchCall' } },
      { tool: 'async-message', label: 'Async Message', modelType: 'UMLMessage', kind: 'seqedge', preset: { messageSort: 'asynchCall' } },
      { tool: 'reply-message', label: 'Reply Message', modelType: 'UMLMessage', kind: 'seqedge', preset: { messageSort: 'replyMessage' } },
      { tool: 'create-message', label: 'Create Message', modelType: 'UMLMessage', kind: 'seqedge', preset: { messageSort: 'createMessage' } },
      { tool: 'delete-message', label: 'Delete Message', modelType: 'UMLMessage', kind: 'seqedge', preset: { messageSort: 'deleteMessage' } },
      { tool: 'self-message', label: 'Self Message', modelType: 'UMLMessage', kind: 'seqedge', preset: { messageSort: 'synchCall', self: true } },
      { tool: 'combined-fragment', label: 'Combined Fragment', modelType: 'UMLCombinedFragment', kind: 'node' }
    ].concat(NOTE_TOOLS),
    droppable: ['UMLLifeline', 'UMLCombinedFragment', 'UMLNote'],
    allowedChildren: ['UMLLifeline', 'UMLMessage', 'UMLCombinedFragment']
  });

  defDiagram('UMLStatechartDiagram', {
    label: 'Statechart Diagram', icon: 'state-diagram', defaultName: 'StatechartDiagram1',
    toolbox: [
      { tool: 'state', label: 'State', modelType: 'UMLState', kind: 'node' },
      { tool: 'initial', label: 'Initial State', modelType: 'UMLPseudostate', kind: 'node', preset: { kind: 'initial' } },
      { tool: 'final', label: 'Final State', modelType: 'UMLFinalState', kind: 'node' },
      { tool: 'transition', label: 'Transition', modelType: 'UMLTransition', kind: 'edge' },
      { tool: 'choice', label: 'Choice', modelType: 'UMLPseudostate', kind: 'node', preset: { kind: 'choice' } },
      { tool: 'junction', label: 'Junction', modelType: 'UMLPseudostate', kind: 'node', preset: { kind: 'junction' } },
      { tool: 'fork', label: 'Fork', modelType: 'UMLPseudostate', kind: 'node', preset: { kind: 'fork' } },
      { tool: 'join', label: 'Join', modelType: 'UMLPseudostate', kind: 'node', preset: { kind: 'join' } },
      { tool: 'shallowhistory', label: 'Shallow History', modelType: 'UMLPseudostate', kind: 'node', preset: { kind: 'shallowHistory' } },
      { tool: 'deephistory', label: 'Deep History', modelType: 'UMLPseudostate', kind: 'node', preset: { kind: 'deepHistory' } },
      { tool: 'entrypoint', label: 'Entry Point', modelType: 'UMLPseudostate', kind: 'node', preset: { kind: 'entryPoint' } },
      { tool: 'exitpoint', label: 'Exit Point', modelType: 'UMLPseudostate', kind: 'node', preset: { kind: 'exitPoint' } },
      { tool: 'terminate', label: 'Terminate', modelType: 'UMLPseudostate', kind: 'node', preset: { kind: 'terminate' } }
    ].concat(NOTE_TOOLS),
    droppable: ['UMLState', 'UMLCompositeState', 'UMLPseudostate', 'UMLFinalState', 'UMLNote', 'UMLStateMachine']
  });

  defDiagram('UMLActivityDiagram', {
    label: 'Activity Diagram', icon: 'activity-diagram', defaultName: 'ActivityDiagram1',
    toolbox: [
      { tool: 'action', label: 'Action', modelType: 'UMLAction', kind: 'node' },
      { tool: 'controlflow', label: 'Control Flow', modelType: 'UMLControlFlow', kind: 'edge' },
      { tool: 'objectflow', label: 'Object Flow', modelType: 'UMLObjectFlow', kind: 'edge' },
      { tool: 'objectnode', label: 'Object Node', modelType: 'UMLObjectNode', kind: 'node' },
      { tool: 'initialnode', label: 'Initial Node', modelType: 'UMLInitialNode', kind: 'node' },
      { tool: 'activityfinalnode', label: 'Activity Final', modelType: 'UMLActivityFinalNode', kind: 'node' },
      { tool: 'flowfinalnode', label: 'Flow Final', modelType: 'UMLFlowFinalNode', kind: 'node' },
      { tool: 'decisionnode', label: 'Decision', modelType: 'UMLDecisionNode', kind: 'node' },
      { tool: 'mergenode', label: 'Merge', modelType: 'UMLMergeNode', kind: 'node' },
      { tool: 'forknode', label: 'Fork', modelType: 'UMLForkNode', kind: 'node' },
      { tool: 'joinnode', label: 'Join', modelType: 'UMLJoinNode', kind: 'node' }
    ].concat(NOTE_TOOLS),
    droppable: ['UMLAction', 'UMLObjectNode', 'UMLInitialNode', 'UMLActivityFinalNode', 'UMLFlowFinalNode',
      'UMLDecisionNode', 'UMLMergeNode', 'UMLForkNode', 'UMLJoinNode', 'UMLNote', 'UMLActivity']
  });

  defDiagram('UMLComponentDiagram', {
    label: 'Component Diagram', icon: 'component-diagram', defaultName: 'ComponentDiagram1',
    toolbox: [
      { tool: 'component', label: 'Component', modelType: 'UMLComponent', kind: 'node' },
      { tool: 'artifact', label: 'Artifact', modelType: 'UMLArtifact', kind: 'node' },
      { tool: 'interface', label: 'Interface', modelType: 'UMLInterface', kind: 'node' },
      { tool: 'assembly', label: 'Assembly Connector', modelType: 'UMLConnector', kind: 'edge' },
      { tool: 'provided', label: 'Provided Interface', modelType: 'UMLInterfaceRealization', kind: 'edge' },
      { tool: 'required', label: 'Required Interface', modelType: 'UMLDependency', kind: 'edge' },
      { tool: 'generalization', label: 'Generalization', modelType: 'UMLGeneralization', kind: 'edge' },
      { tool: 'dependency', label: 'Dependency', modelType: 'UMLDependency', kind: 'edge' }
    ].concat(NOTE_TOOLS),
    droppable: ['UMLComponent', 'UMLArtifact', 'UMLInterface', 'UMLClass', 'UMLNode', 'UMLSubsystem', 'UMLNote']
  });

  defDiagram('UMLDeploymentDiagram', {
    label: 'Deployment Diagram', icon: 'deployment-diagram', defaultName: 'DeploymentDiagram1',
    toolbox: [
      { tool: 'node', label: 'Node', modelType: 'UMLNode', kind: 'node' },
      { tool: 'artifact', label: 'Artifact', modelType: 'UMLArtifact', kind: 'node' },
      { tool: 'component', label: 'Component', modelType: 'UMLComponent', kind: 'node' },
      { tool: 'instance', label: 'Instance', modelType: 'UMLInstance', kind: 'node' },
      { tool: 'comm-path', label: 'Communication Path', modelType: 'UMLCommunicationPath', kind: 'edge' },
      { tool: 'dependency', label: 'Dependency', modelType: 'UMLDependency', kind: 'edge' }
    ].concat(NOTE_TOOLS),
    droppable: ['UMLNode', 'UMLArtifact', 'UMLComponent', 'UMLInstance', 'UMLClass', 'UMLNote']
  });

  defDiagram('UMLPackageDiagram', {
    label: 'Package Diagram', icon: 'package-diagram', defaultName: 'PackageDiagram1',
    toolbox: [
      { tool: 'package', label: 'Package', modelType: 'UMLPackage', kind: 'node' },
      { tool: 'model', label: 'Model', modelType: 'UMLModel', kind: 'node' },
      { tool: 'subsystem', label: 'Subsystem', modelType: 'UMLSubsystem', kind: 'node' },
      { tool: 'dependency', label: 'Dependency', modelType: 'UMLDependency', kind: 'edge' },
      { tool: 'generalization', label: 'Generalization', modelType: 'UMLGeneralization', kind: 'edge' }
    ].concat(NOTE_TOOLS),
    droppable: ['UMLPackage', 'UMLModel', 'UMLSubsystem', 'UMLClass', 'UMLInterface', 'UMLComponent', 'UMLNote']
  });

  /* generic diagram (unknown diagram types open in this mode; notes-only toolbox) */
  defDiagram('GenericDiagram', {
    label: 'Diagram', icon: 'diagram', defaultName: 'Diagram1',
    toolbox: NOTE_TOOLS.slice(),
    droppable: ['UMLNote']
  });

  /* ============================ view type mapping ============================ */

  var MODEL_TO_VIEW = {
    'UMLClass': 'UMLClassView',
    'UMLInterface': 'UMLInterfaceView',
    'UMLEnumeration': 'UMLEnumerationView',
    'UMLDataType': 'UMLDataTypeView',
    'UMLPackage': 'UMLPackageView',
    'UMLModel': 'UMLModelView',
    'UMLSubsystem': 'UMLSubsystemView',
    'UMLActor': 'UMLActorView',
    'UMLUseCase': 'UMLUseCaseView',
    'UMLComponent': 'UMLComponentView',
    'UMLArtifact': 'UMLArtifactView',
    'UMLNode': 'UMLNodeView',
    'UMLInstance': 'UMLInstanceView',
    'UMLStateMachine': 'UMLStateMachineView',
    'UMLActivity': 'UMLActivityView',
    'UMLState': 'UMLStateView',
    'UMLCompositeState': 'UMLCompositeStateView',
    'UMLPseudostate': 'UMLPseudostateView',
    'UMLFinalState': 'UMLFinalStateView',
    'UMLTransition': 'UMLTransitionView',
    'UMLAction': 'UMLActionView',
    'UMLObjectNode': 'UMLObjectNodeView',
    'UMLInitialNode': 'UMLInitialNodeView',
    'UMLActivityFinalNode': 'UMLActivityFinalNodeView',
    'UMLFlowFinalNode': 'UMLFlowFinalNodeView',
    'UMLDecisionNode': 'UMLDecisionNodeView',
    'UMLMergeNode': 'UMLMergeNodeView',
    'UMLForkNode': 'UMLForkNodeView',
    'UMLJoinNode': 'UMLJoinNodeView',
    'UMLControlFlow': 'UMLControlFlowView',
    'UMLObjectFlow': 'UMLObjectFlowView',
    'UMLLifeline': 'UMLSeqLifelineView',
    'UMLMessage': 'UMLSeqMessageView',
    'UMLCombinedFragment': 'UMLCombinedFragmentView',
    'UMLAssociation': 'UMLAssociationView',
    'UMLGeneralization': 'UMLGeneralizationView',
    'UMLRealization': 'UMLRealizationView',
    'UMLDependency': 'UMLDependencyView',
    'UMLInterfaceRealization': 'UMLInterfaceRealizationView',
    'UMLInclude': 'UMLIncludeView',
    'UMLExtend': 'UMLExtendView',
    'UMLConnector': 'UMLConnectorView',
    'UMLCommunicationPath': 'UMLCommunicationPathView',
    'UMLNote': 'UMLNoteView',
    'UMLNoteLink': 'UMLNoteLinkView',
    'UMLConstraint': 'UMLConstraintView'
  };

  var VIEW_TO_MODEL = {};
  for (var mt in MODEL_TO_VIEW) VIEW_TO_MODEL[MODEL_TO_VIEW[mt]] = mt;
  /* aliases accepted when reading foreign files */
  var VIEW_ALIASES = {
    'UMLControlNodeView': null,          /* resolve from model type */
    'UMLSeqLifelineView': 'UMLSeqLifelineView',
    'UMLFrameView': null,
    'UMLStateView': 'UMLStateView'
  };

  var EDGE_VIEW_TYPES = {
    'UMLAssociationView': true, 'UMLGeneralizationView': true, 'UMLRealizationView': true,
    'UMLDependencyView': true, 'UMLInterfaceRealizationView': true, 'UMLIncludeView': true,
    'UMLExtendView': true, 'UMLConnectorView': true, 'UMLCommunicationPathView': true,
    'UMLNoteLinkView': true, 'UMLTransitionView': true, 'UMLControlFlowView': true,
    'UMLObjectFlowView': true, 'UMLSeqMessageView': true
  };

  /* ============================ API ============================ */

  function isDiagram(type) { return !!DIAGRAMS[type]; }
  /** True for known diagram types AND foreign ones (e.g. UMLCommunicationDiagram). */
  function isDiagramLike(type) { return !!DIAGRAMS[type] || /^UML.*Diagram$/.test(type || ''); }
  function isEdgeModel(type) {
    var d = TYPES[type];
    return d && d.category === 'relationship';
  }
  function isEdgeView(type) { return !!EDGE_VIEW_TYPES[type]; }
  function isNodeView(type) { return !!type && /View$/.test(type) && !EDGE_VIEW_TYPES[type]; }

  function normalizeDiagramType(t) { return DIAGRAM_ALIASES[t] || t; }

  function typeDescriptor(type) { return TYPES[type] || TYPES['UnknownElement']; }

  function defaults(type) {
    var d = typeDescriptor(type).defaults();
    d._type = d._type || type;
    return d;
  }

  function label(type) { return typeDescriptor(type).label || type; }

  /** What child types can be created under a parent type (explorer context menu). */
  function allowedChildren(type) { return typeDescriptor(type).allowedChildren || []; }

  /** Types a diagram accepts when dropping from the explorer. */
  function droppableTypes(diagramType) {
    var d = DIAGRAMS[diagramType] || DIAGRAMS['GenericDiagram'];
    return d.droppable || [];
  }

  OS.meta = {
    TYPES: TYPES,
    DIAGRAMS: DIAGRAMS,
    DIAGRAM_ALIASES: DIAGRAM_ALIASES,
    MODEL_TO_VIEW: MODEL_TO_VIEW,
    VIEW_TO_MODEL: VIEW_TO_MODEL,
    VIEW_ALIASES: VIEW_ALIASES,
    EDGE_VIEW_TYPES: EDGE_VIEW_TYPES,
    isDiagram: isDiagram,
    isDiagramLike: isDiagramLike,
    isEdgeModel: isEdgeModel,
    isEdgeView: isEdgeView,
    isNodeView: isNodeView,
    normalizeDiagramType: normalizeDiagramType,
    typeDescriptor: typeDescriptor,
    defaults: defaults,
    label: label,
    allowedChildren: allowedChildren,
    droppableTypes: droppableTypes,
    viewTypeForModel: function (modelType) { return MODEL_TO_VIEW[modelType] || null; },
    modelTypeForView: function (viewType) {
      if (VIEW_TO_MODEL[viewType]) return VIEW_TO_MODEL[viewType];
      if (viewType in VIEW_ALIASES) return VIEW_ALIASES[viewType];
      return null;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
