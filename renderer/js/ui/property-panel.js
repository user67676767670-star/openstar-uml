/*
 * OpenStar UML — Property Editor panel (Model / Format / Documentation).
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};
  var util = OS.util, meta = OS.meta, model = OS.model, icons = OS.icons, text = OS.text;

  var FONT_FAMILIES = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Tahoma', 'Consolas', 'Georgia', 'Segoe UI'];

  function el(tag, cls, htmlText) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (htmlText !== undefined) e.innerHTML = htmlText;
    return e;
  }

  function PropertyPanel(host, app) {
    this.host = host;
    this.app = app;
    this.project = app.project;
    this.target = null;    // {model, views[]}
    this.expanded = new Set();
    host.classList.add('prop-panel');
  }

  PropertyPanel.prototype.show = function (target) {
    this.target = target;
    this.render();
  };

  PropertyPanel.prototype.clear = function () {
    this.target = null;
    this.host.innerHTML = '<div class="prop-empty">No selection</div>';
  };

  PropertyPanel.prototype.refresh = function () {
    if (!this.target) { this.clear(); return; }
    // re-resolve after undo/redo
    var m = this.target.model ? this.project.get(this.target.model._id) : null;
    var vs = (this.target.views || []).map(function (v) { return this.project.get(v._id); }, this).filter(Boolean);
    if (!m && !vs.length) { this.clear(); return; }
    this.target = { model: m, views: vs };
    this.render();
  };

  PropertyPanel.prototype.render = function () {
    var t = this.target;
    this.host.innerHTML = '';
    if (!t || (!t.model && !(t.views && t.views.length))) { this.clear(); return; }
    var m = t.model;
    var views = t.views || [];

    /* header */
    var header = el('div', 'prop-header');
    if (m) {
      var stereo = model.stereotypeText(m);
      header.innerHTML = icons.iconForType(m._type, 15) +
        '<span class="prop-header-name">' + util.xmlEscape((stereo ? '«' + stereo + '» ' : '') + (m.name || '')) + '</span>' +
        '<span class="prop-header-type">' + meta.label(m._type) + '</span>';
    } else {
      header.innerHTML = '<span class="prop-header-name">' + views.length + ' elements selected</span>';
    }
    this.host.appendChild(header);

    /* MODEL section */
    if (m) {
      var desc = meta.typeDescriptor(m._type);
      var props = (desc.props || []).filter(function (p) { return p.key !== 'documentation'; });
      if (props.length) {
        this.host.appendChild(this.section('Model', this.buildFields(m, props, 'model')));
      }
    }

    /* FORMAT section */
    if (views.length) {
      var fmtBody = el('div', 'prop-fields');
      this.buildFormatFields(fmtBody, views, m);
      this.host.appendChild(this.section('Format', fmtBody));
    }

    /* DOCUMENTATION section */
    if (m) {
      var self = this;
      var docBody = el('div', 'prop-fields');
      var ta = el('textarea', 'prop-doc');
      ta.value = m.documentation || '';
      ta.rows = 6;
      ta.placeholder = m._type === 'UMLNote' ? 'Note text…' : 'Documentation…';
      ta.addEventListener('change', function () {
        var v = ta.value;
        self.commit('Edit Documentation', function () {
          var mm = self.project.get(m._id);
          if (mm) mm.documentation = v;
        }, m);
      });
      docBody.appendChild(ta);
      this.host.appendChild(this.section('Documentation', docBody));
    }
  };

  PropertyPanel.prototype.section = function (title, body) {
    var s = el('div', 'prop-section');
    var h = el('div', 'prop-section-head', title);
    s.appendChild(h);
    s.appendChild(body);
    return s;
  };

  PropertyPanel.prototype.commit = function (label, fn, modelEl) {
    var self = this;
    this.project.transact(label, fn);
    this.app.onModelEdited(modelEl);
  };

  /* ============================ model fields ============================ */

  PropertyPanel.prototype.buildFields = function (target, fields, mode) {
    var self = this;
    var wrap = el('div', 'prop-fields');
    fields.forEach(function (f) {
      wrap.appendChild(self.buildField(target, f));
    });
    return wrap;
  };

  PropertyPanel.prototype.buildField = function (target, f) {
    var self = this;
    var row = el('div', 'prop-row' + (f.type === 'list' ? ' list-row-top' : ''));
    if (f.type !== 'list') {
      row.appendChild(el('label', 'prop-label', f.label));
    }
    var ctl;
    switch (f.type) {
      case 'text':
        ctl = el('input', 'prop-input');
        ctl.type = 'text';
        ctl.value = displayValue(target[f.key]);
        if (f.readOnly) ctl.readOnly = true;
        ctl.addEventListener('change', function () {
          var v = ctl.value;
          self.commit('Edit ' + f.label, function () { target[f.key] = v; }, target);
        });
        break;
      case 'multiline':
        ctl = el('textarea', 'prop-input');
        ctl.rows = 3;
        ctl.value = displayValue(target[f.key]);
        ctl.addEventListener('change', function () {
          var v = ctl.value;
          self.commit('Edit ' + f.label, function () { target[f.key] = v; }, target);
        });
        break;
      case 'check':
        ctl = el('label', 'prop-check');
        var cb = el('input');
        cb.type = 'checkbox';
        cb.checked = !!target[f.key];
        cb.addEventListener('change', function () {
          var v = cb.checked;
          self.commit('Toggle ' + f.label, function () { target[f.key] = v; }, target);
        });
        ctl.appendChild(cb);
        break;
      case 'select':
        ctl = el('select', 'prop-input');
        (f.options || []).forEach(function (o) {
          var opt = el('option');
          opt.value = o;
          opt.textContent = o === '' ? '(none)' : o;
          ctl.appendChild(opt);
        });
        ctl.value = target[f.key] || '';
        if (ctl.value !== (target[f.key] || '')) {
          var opt2 = el('option');
          opt2.value = target[f.key];
          opt2.textContent = target[f.key];
          ctl.appendChild(opt2);
          ctl.value = target[f.key];
        }
        ctl.addEventListener('change', function () {
          var v = ctl.value;
          self.commit('Edit ' + f.label, function () { target[f.key] = v; }, target);
        });
        break;
      case 'elemref':
        ctl = this.buildElemRef(target, f);
        break;
      case 'list':
        return this.buildListEditor(target, f);
      default:
        ctl = el('span', 'prop-static', displayValue(target[f.key]));
    }
    row.appendChild(ctl);
    return row;
  };

  function displayValue(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return v.name || '';
    return String(v);
  }

  PropertyPanel.prototype.buildElemRef = function (target, f) {
    var self = this;
    var sel = el('select', 'prop-input');
    var candidates = this.app.referenceCandidates(f.filter);
    var none = el('option');
    none.value = '';
    none.textContent = '(none)';
    sel.appendChild(none);
    var current = target[f.key];
    candidates.forEach(function (c) {
      var o = el('option');
      o.value = c._id;
      o.textContent = self.app.elementPathLabel(c);
      sel.appendChild(o);
    });
    if (current && current._id) {
      if (!candidates.some(function (c) { return c._id === current._id; })) {
        var o2 = el('option');
        o2.value = current._id;
        o2.textContent = self.app.elementPathLabel(current);
        sel.appendChild(o2);
      }
      sel.value = current._id;
    } else if (typeof current === 'string' && current) {
      var o3 = el('option');
      o3.value = '@str:' + current;
      o3.textContent = current + ' (name)';
      sel.appendChild(o3);
      sel.value = '@str:' + current;
    }
    sel.addEventListener('change', function () {
      var v = sel.value;
      self.commit('Edit ' + f.label, function () {
        if (!v) target[f.key] = null;
        else if (v.indexOf('@str:') === 0) target[f.key] = v.slice(5);
        else target[f.key] = self.project.get(v);
      }, target);
    });
    return sel;
  };

  /* ============================ list editor ============================ */

  PropertyPanel.prototype.buildListEditor = function (owner, f) {
    var self = this;
    var listKey = f.key;
    var itemType = f.itemType;
    var itemDesc = meta.typeDescriptor(itemType);
    var wrap = el('div', 'prop-list');
    var head = el('div', 'prop-list-head');
    head.appendChild(el('span', 'prop-label', f.label));
    var addBtn = el('button', 'btn-mini', '+ Add');
    head.appendChild(addBtn);
    wrap.appendChild(head);

    function items() {
      if (!owner[listKey]) owner[listKey] = [];
      return owner[listKey];
    }

    addBtn.addEventListener('click', function () {
      self.commit('Add ' + itemDesc.label, function () {
        var item = model.createElement(self.project, itemType);
        if (itemType === 'UMLAssociationEnd') { item.name = ''; }
        model.addOwned(self.project, owner, item, listKey);
        self.expanded.add(item._id);
      }, owner);
    });

    var body = el('div', 'prop-list-body');
    items().forEach(function (item, idx) {
      body.appendChild(self.buildListRow(owner, listKey, item, idx, items().length, itemType));
    });
    if (!items().length) {
      body.appendChild(el('div', 'prop-list-empty', '— none —'));
    }
    wrap.appendChild(body);
    return wrap;
  };

  PropertyPanel.prototype.buildListRow = function (owner, listKey, item, idx, count, itemType) {
    var self = this;
    var row = el('div', 'prop-list-item');
    var summary = el('div', 'prop-item-summary');
    var expanded = this.expanded.has(item._id);
    var hasNested = (meta.typeDescriptor(itemType).props || []).some(function (p) { return p.type === 'list'; });

    var chev = el('span', 'item-chev' + (hasNested ? '' : ' none'), expanded ? '▾' : '▸');
    chev.addEventListener('click', function () {
      if (!hasNested) return;
      if (expanded) self.expanded.delete(item._id); else self.expanded.add(item._id);
      self.render();
    });
    summary.appendChild(chev);
    summary.appendChild(el('span', 'item-text', itemSummaryText(item)));
    var btns = el('span', 'item-btns');
    function mini(label, title, fn, disabled) {
      var b = el('button', 'btn-mini', label);
      b.title = title;
      if (disabled) b.disabled = true;
      b.addEventListener('click', function (ev) { ev.stopPropagation(); fn(); });
      btns.appendChild(b);
    }
    mini('↑', 'Move up', function () {
      if (idx === 0) return;
      self.commit('Reorder', function () {
        var arr = owner[listKey];
        arr.splice(idx - 1, 0, arr.splice(idx, 1)[0]);
      }, owner);
    }, idx === 0);
    mini('↓', 'Move down', function () {
      if (idx === count - 1) return;
      self.commit('Reorder', function () {
        var arr = owner[listKey];
        arr.splice(idx + 1, 0, arr.splice(idx, 1)[0]);
      }, owner);
    }, idx === count - 1);
    mini('✕', 'Delete', function () {
      self.commit('Remove ' + meta.label(itemType), function () {
        model.removeOwned(owner, item);
        self.project._unregister(item);
        self.expanded.delete(item._id);
      }, owner);
    });
    summary.appendChild(btns);
    row.appendChild(summary);

    if (expanded && hasNested) {
      var detail = el('div', 'prop-item-detail');
      var props = (meta.typeDescriptor(itemType).props || []).filter(function (p) { return p.key !== 'documentation'; });
      props.forEach(function (p) {
        detail.appendChild(self.buildField(item, p));
      });
      row.appendChild(detail);
    }
    return row;
  };

  function itemSummaryText(item) {
    switch (item._type) {
      case 'UMLAttribute': return model.formatAttribute(item, {});
      case 'UMLOperation': return model.formatOperation(item, {});
      case 'UMLParameter': return model.formatParameter(item);
      case 'UMLEnumerationLiteral': return item.name || '(literal)';
      case 'UMLAssociationEnd': {
        var ref = item.reference ? model.typeName(item.reference) : '?';
        var agg = item.aggregation === 'composite' ? ' ◆' : item.aggregation === 'shared' ? ' ◇' : '';
        return (item.name || '(role)') + ' : ' + ref + (item.multiplicity ? ' [' + item.multiplicity + ']' : '') + agg +
          (item.navigable === false ? ' (no-nav)' : '');
      }
      default: return item.name || meta.label(item._type);
    }
  }

  /* ============================ format fields ============================ */

  PropertyPanel.prototype.buildFormatFields = function (body, views, m) {
    var self = this;
    var project = this.project;
    var isEdge = views.length && (meta.isEdgeView(views[0]._type) || views[0]._type === 'UMLSeqMessageView');

    function applyAll(label, fn) {
      self.commit(label, function () {
        views.forEach(function (v) {
          var cur = project.get(v._id);
          if (cur) fn(cur);
        });
      }, m || (views[0] && views[0].model));
    }

    /* fill color */
    if (!isEdge) {
      body.appendChild(colorRow('Fill Color', views[0].fillColor || '', function (c) {
        applyAll('Fill Color', function (v) { if (c) v.fillColor = c; else delete v.fillColor; });
      }, views.length > 1));
      body.appendChild(colorRow('Line Color', views[0].lineColor || '', function (c) {
        applyAll('Line Color', function (v) { if (c) v.lineColor = c; else delete v.lineColor; });
      }, views.length > 1));
    } else {
      body.appendChild(colorRow('Line Color', views[0].lineColor || '', function (c) {
        applyAll('Line Color', function (v) { if (c) v.lineColor = c; else delete v.lineColor; });
      }, views.length > 1));
    }

    /* font */
    var fontRow = el('div', 'prop-row');
    fontRow.appendChild(el('label', 'prop-label', 'Font'));
    var fontCtl = el('div', 'prop-font');
    var f = text.parseFont(views[0].font);
    var famSel = el('select', 'prop-input font-family');
    FONT_FAMILIES.forEach(function (ff) {
      var o = el('option'); o.value = ff; o.textContent = ff; famSel.appendChild(o);
    });
    if (FONT_FAMILIES.indexOf(f.family) < 0) {
      var o = el('option'); o.value = f.family; o.textContent = f.family; famSel.appendChild(o);
    }
    famSel.value = f.family;
    var sizeInp = el('input', 'prop-input font-size');
    sizeInp.type = 'number'; sizeInp.min = '6'; sizeInp.max = '72'; sizeInp.value = f.size;
    function styleBtn(txt, active, bit) {
      var b = el('button', 'btn-mini font-style' + (active ? ' active' : ''), txt);
      b.addEventListener('click', function () {
        applyAll('Font', function (v) {
          var cur = text.parseFont(v.font);
          var next = { family: cur.family, size: cur.size, bold: cur.bold, italic: cur.italic, underline: cur.underline };
          if (bit === 'b') next.bold = !next.bold;
          if (bit === 'i') next.italic = !next.italic;
          if (bit === 'u') next.underline = !next.underline;
          v.font = text.fontToMdj(next);
        });
      });
      return b;
    }
    famSel.addEventListener('change', function () {
      applyAll('Font', function (v) {
        var cur = text.parseFont(v.font);
        v.font = text.fontToMdj({ family: famSel.value, size: cur.size, bold: cur.bold, italic: cur.italic, underline: cur.underline });
      });
    });
    sizeInp.addEventListener('change', function () {
      var sz = Math.max(6, Math.min(72, parseInt(sizeInp.value, 10) || 13));
      applyAll('Font Size', function (v) {
        var cur = text.parseFont(v.font);
        v.font = text.fontToMdj({ family: cur.family, size: sz, bold: cur.bold, italic: cur.italic, underline: cur.underline });
      });
    });
    fontCtl.appendChild(famSel);
    fontCtl.appendChild(sizeInp);
    fontCtl.appendChild(styleBtn('B', f.bold, 'b'));
    fontCtl.appendChild(styleBtn('I', f.italic, 'i'));
    fontCtl.appendChild(styleBtn('U', f.underline, 'u'));
    fontRow.appendChild(fontCtl);
    body.appendChild(fontRow);

    /* per-type view flags */
    var modelType = m ? m._type : (views[0].model ? views[0].model._type : null);
    var flags = modelType ? (meta.typeDescriptor(modelType).viewFlags || []) : [];
    flags.forEach(function (vf) {
      if (vf.type === 'select') {
        var row = el('div', 'prop-row');
        row.appendChild(el('label', 'prop-label', vf.label));
        var sel = el('select', 'prop-input');
        vf.options.forEach(function (o) {
          var opt = el('option'); opt.value = o; opt.textContent = o; sel.appendChild(opt);
        });
        sel.value = views[0][vf.key] || vf.options[0];
        sel.addEventListener('change', function () {
          applyAll('Edit ' + vf.label, function (v) { v[vf.key] = sel.value; });
        });
        row.appendChild(sel);
        body.appendChild(row);
      } else {
        var row2 = el('div', 'prop-row');
        row2.appendChild(el('label', 'prop-label', vf.label));
        var lab = el('label', 'prop-check');
        var cb = el('input');
        cb.type = 'checkbox';
        cb.checked = !!views[0][vf.key];
        cb.addEventListener('change', function () {
          applyAll('Toggle ' + vf.label, function (v) { v[vf.key] = cb.checked; });
        });
        lab.appendChild(cb);
        row2.appendChild(lab);
        body.appendChild(row2);
      }
    });
  };

  function colorRow(label, value, onChange, disabled) {
    var row = el('div', 'prop-row');
    row.appendChild(el('label', 'prop-label', label));
    var ctl = el('div', 'prop-color');
    var inp = el('input');
    inp.type = 'color';
    inp.value = value && value.charAt(0) === '#' && (value.length === 7 || value.length === 4) ? expandColor(value) : '#ffffff';
    inp.disabled = !!disabled && false;
    var none = el('label', 'prop-check');
    var noneCb = el('input');
    noneCb.type = 'checkbox';
    noneCb.checked = !value;
    none.appendChild(noneCb);
    none.appendChild(document.createTextNode('default'));
    inp.addEventListener('input', function () {
      if (noneCb.checked) { noneCb.checked = false; }
      onChange(inp.value);
    });
    noneCb.addEventListener('change', function () {
      if (noneCb.checked) onChange(null);
      else onChange(inp.value);
    });
    ctl.appendChild(inp);
    ctl.appendChild(none);
    row.appendChild(ctl);
    return row;
  }

  function expandColor(c) {
    if (c.length === 4) return '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
    return c;
  }

  OS.PropertyPanel = PropertyPanel;
})(typeof window !== 'undefined' ? window : globalThis);
