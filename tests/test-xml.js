/* XML mini parser/serializer tests */
'use strict';
const OS = globalThis.OS;
const xml = OS.xml;

t.suite('xml parser/serializer');

const doc = xml.parse(`<?xml version="1.0" encoding="UTF-8"?>
<!-- a comment -->
<root attr="v1" ns:attr2='v2'>
  <child>text &amp; more</child>
  <child><![CDATA[raw <data> & stuff]]></child>
  <empty/>
  <nested a="1"><deep b="2">x</deep></nested>
</root>`);

const root = xml.findChild(doc, 'root');
t.ok(root, 'root found');
t.eq(root.attrs.attr, 'v1', 'attribute parsed');
t.eq(root.attrs['ns:attr2'], 'v2', 'namespaced + single-quoted attribute parsed');

const children = xml.findChildren(root, 'child');
t.eq(children.length, 2, 'two child elements');
t.eq(children[0].text, 'text & more', 'entity decoded text');
t.eq(children[1].text, 'raw <data> & stuff', 'CDATA text');

t.ok(xml.findChild(root, 'empty'), 'self-closing element');
const deep = xml.findChild(xml.findChild(root, 'nested'), 'deep');
t.eq(deep.attrs.b, '2', 'nested attributes');
t.eq(deep.text, 'x', 'nested text');

t.throws(() => xml.parse('<a><b></a>'), 'mismatched tags throw');
t.throws(() => xml.parse('<a><b></b>'), 'unclosed tag throws');

// serializer round trip
const out = xml.serialize(xml.el('xmi:XMI', { 'xmlns:xmi': 'http://x', id: 'a&b"c' }, [
  xml.el('uml:Class', { name: 'A <B>' }),
  xml.el('doc', {}, ['multi\nline'])
]));
const reparsed = xml.parse(out);
const cls = xml.findChild(xml.findChild(reparsed, 'XMI'), 'Class');
t.eq(cls.attrs.name, 'A <B>', 'serialize → parse round trip with escapes');
t.eq(xml.findChild(reparsed, 'XMI').attrs.id, 'a&b"c', 'attribute escaping round trip');
t.ok(out.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'xml header emitted');

// descendants helper
const all = xml.descendants(reparsed);
t.ok(all.length >= 3, 'descendants walks tree');
