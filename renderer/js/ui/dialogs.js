/*
 * OpenStar UML — modal dialogs, toasts and floating context menus.
 */
(function (global) {
  'use strict';
  var OS = global.OS = global.OS || {};

  /* All dynamic strings interpolated into innerHTML below MUST go through
   * esc() to prevent HTML/script injection from model names, file paths or
   * error messages. */
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function elText(tag, cls, textContent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (textContent !== undefined) e.textContent = textContent;
    return e;
  }

  var openMenus = [];

  function closeMenus() {
    openMenus.forEach(function (m) { if (m.parentNode) m.parentNode.removeChild(m); });
    openMenus = [];
  }

  /**
   * Floating context menu.
   * items: [{label, id, enabled, checked, sep, submenu:[...], accel}]
   */
  function menu(x, y, items, onSelect) {
    closeMenus();
    var root = buildMenu(items, onSelect, 0);
    document.body.appendChild(root);
    positionMenu(root, x, y);
    openMenus.push(root);
    function onDocDown(ev) {
      if (!root.contains(ev.target)) { closeMenus(); document.removeEventListener('mousedown', onDocDown, true); }
    }
    setTimeout(function () { document.addEventListener('mousedown', onDocDown, true); }, 0);
    return root;
  }

  function buildMenu(items, onSelect, depth) {
    var m = el('div', 'ctx-menu');
    items.forEach(function (item) {
      if (item.sep) { m.appendChild(el('div', 'ctx-sep')); return; }
      if (item.submenu) {
        var rowParent = el('div', 'ctx-item has-sub' + (item.enabled === false ? ' disabled' : ''));
        rowParent.innerHTML = '<span class="ctx-label"></span><span class="ctx-arrow">▸</span>';
        rowParent.firstChild.textContent = item.label || '';
        var sub = null;
        rowParent.addEventListener('mouseenter', function () {
          m.querySelectorAll(':scope > .ctx-submenu').forEach(function (s) { s.classList.remove('open'); });
          if (!sub) {
            sub = buildMenu(item.submenu, onSelect, depth + 1);
            sub.classList.add('ctx-submenu');
            m.appendChild(sub);
          }
          positionMenu(sub, 0, 0);
          var r = rowParent.getBoundingClientRect(), mr = m.getBoundingClientRect();
          sub.style.left = (r.right - mr.left - 2) + 'px';
          sub.style.top = (r.top - mr.top) + 'px';
          sub.classList.add('open');
        });
        m.appendChild(rowParent);
        return;
      }
      var row = el('div', 'ctx-item' + (item.enabled === false ? ' disabled' : '') + (item.checked ? ' checked' : ''));
      row.innerHTML = '<span class="ctx-check"></span><span class="ctx-label"></span>' +
        (item.accel ? '<span class="ctx-accel"></span>' : '');
      row.querySelector('.ctx-check').textContent = item.checked ? '✓' : '';
      row.querySelector('.ctx-label').textContent = item.label || '';
      if (item.accel) row.querySelector('.ctx-accel').textContent = item.accel;
      row.addEventListener('click', function () {
        if (item.enabled === false) return;
        closeMenus();
        if (onSelect) onSelect(item.id, item);
      });
      row.addEventListener('mouseenter', function () {
        m.querySelectorAll(':scope > .ctx-submenu').forEach(function (s) { s.classList.remove('open'); });
      });
      m.appendChild(row);
    });
    return m;
  }

  function positionMenu(m, x, y) {
    m.style.left = x + 'px';
    m.style.top = y + 'px';
    m.classList.add('open');
    // clamp to viewport
    var r = m.getBoundingClientRect();
    if (r.right > global.innerWidth - 4) m.style.left = Math.max(4, x - (r.right - global.innerWidth) - 4) + 'px';
    if (r.bottom > global.innerHeight - 4) m.style.top = Math.max(4, y - (r.bottom - global.innerHeight) - 4) + 'px';
  }

  /* ============================ modals ============================ */

  function modal(opts) {
    return new Promise(function (resolve) {
      var overlay = el('div', 'modal-overlay');
      var box = el('div', 'modal-box' + (opts.wide ? ' wide' : ''));
      var head = el('div', 'modal-head');
      head.innerHTML = '<span></span>';
      head.firstChild.textContent = opts.title || '';
      var closeBtn = el('button', 'modal-close', '✕');
      head.appendChild(closeBtn);
      var body = el('div', 'modal-body');
      if (typeof opts.content === 'string') body.innerHTML = messageHtml(opts.content);
      else if (opts.content) body.appendChild(opts.content);
      var foot = el('div', 'modal-foot');
      (opts.buttons || [{ label: 'OK', value: true, primary: true }]).forEach(function (b) {
        var btn = el('button', 'btn' + (b.primary ? ' primary' : ''), b.label);
        btn.addEventListener('click', function () { close(b.value); });
        foot.appendChild(btn);
      });
      box.appendChild(head); box.appendChild(body); box.appendChild(foot);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      function close(v) {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        document.removeEventListener('keydown', onKey, true);
        resolve(v);
      }
      function onKey(ev) {
        if (ev.key === 'Escape') { ev.stopPropagation(); close(opts.escapeValue !== undefined ? opts.escapeValue : null); }
      }
      closeBtn.addEventListener('click', function () { close(opts.escapeValue !== undefined ? opts.escapeValue : null); });
      overlay.addEventListener('mousedown', function (ev) {
        if (ev.target === overlay) close(opts.escapeValue !== undefined ? opts.escapeValue : null);
      });
      document.addEventListener('keydown', onKey, true);
      if (opts.onMount) opts.onMount(body, close);
      var focusEl = box.querySelector('input,textarea,button.primary');
      if (focusEl) focusEl.focus();
    });
  }

  function prompt2(title, label, value) {
    return new Promise(function (resolve) {
      var input = el('input', 'modal-input');
      input.type = 'text';
      input.value = value || '';
      var wrap = el('div');
      wrap.appendChild(el('label', 'modal-label', label || ''));
      wrap.appendChild(input);
      modal({
        title: title, content: wrap,
        buttons: [{ label: 'Cancel', value: null }, { label: 'OK', value: '@@ok', primary: true }],
        escapeValue: null
      }).then(function (v) {
        resolve(v === '@@ok' ? input.value : null);
      });
      setTimeout(function () { input.focus(); input.select(); }, 20);
    });
  }

  /**
   * Internal helper: render a message as plain text, but honour simple
   * inline markup the app already uses ("<br/>", "<code>escaped</code>").
   * Anything else in `message` is treated as literal text (XSS-safe).
   */
  function messageHtml(message) {
    var s = String(message === null || message === undefined ? '' : message);
    // split on <br> / <br/> line breaks
    var parts = s.split(/<br\s*\/?>/i);
    return parts.map(function (part) {
      var m = /^<code>([\s\S]*)<\/code>$/.exec(part.trim());
      if (m) return '<code>' + esc(m[1]) + '</code>';
      return esc(part);
    }).join('<br/>');
  }

  function confirm2(title, message, okLabel) {
    return modal({
      title: title,
      content: '<div class="modal-message">' + messageHtml(message) + '</div>',
      buttons: [{ label: 'Cancel', value: false }, { label: okLabel || 'OK', value: true, primary: true }],
      escapeValue: false
    });
  }

  function alertMsg(title, message) {
    return modal({
      title: title,
      content: '<div class="modal-message">' + messageHtml(message) + '</div>',
      buttons: [{ label: 'OK', value: true, primary: true }]
    });
  }

  OS.dialogs = {
    menu: menu,
    closeMenus: closeMenus,
    modal: modal,
    prompt: prompt2,
    confirm: confirm2,
    alert: alertMsg,
    el: el
  };
})(typeof window !== 'undefined' ? window : globalThis);
