/*
 * OpenStar UML — application shell wiring: panel splitters.
 */
(function (global) {
  'use strict';

  function initSplitters() {
    function wire(splitterId, targetId, side) {
      var sp = document.getElementById(splitterId);
      var panel = document.getElementById(targetId);
      if (!sp || !panel) return;
      var dragging = false, startX = 0, startW = 0;
      sp.addEventListener('mousedown', function (ev) {
        dragging = true;
        startX = ev.clientX;
        startW = panel.getBoundingClientRect().width;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        ev.preventDefault();
      });
      global.addEventListener('mousemove', function (ev) {
        if (!dragging) return;
        var dx = ev.clientX - startX;
        var w = side === 'left' ? startW + dx : startW - dx;
        panel.style.width = Math.max(140, Math.min(640, w)) + 'px';
        if (global.openstarApp && global.openstarApp.editor) global.openstarApp.editor.resize();
      });
      global.addEventListener('mouseup', function () {
        if (!dragging) return;
        dragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      });
      sp.addEventListener('dblclick', function () {
        panel.style.width = '';
        if (global.openstarApp && global.openstarApp.editor) global.openstarApp.editor.resize();
      });
    }
    wire('split-left', 'explorer-panel', 'left');
    wire('split-right', 'props-panel', 'right');
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSplitters);
    else initSplitters();
  }
})(typeof window !== 'undefined' ? window : globalThis);
