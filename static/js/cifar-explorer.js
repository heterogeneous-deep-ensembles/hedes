// Synthetic CIFAR-100 (Fig. 2a/2b): accuracy of HeDE, HoDE and imbalance-aware late-fusion methods.
// The x-axis is either the data split (with an ensemble-size knob; size 1 = Fig. 2a) or the ensemble size (with a
// data-split knob; split 0.05-0.95 = Fig. 2b). Legend entries toggle methods; hover lists all methods at that point.
// Data: {splits, sizes, methods, acc[method][split][size] = [mean, std]}.
(function () {
  'use strict';

  const root = document.getElementById('cifar-explorer');
  if (!root) return;
  const load = window.CIFAR_DATA ? Promise.resolve(window.CIFAR_DATA)
    : fetch(root.dataset.src).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  load.then(init).catch((err) => {
    console.error('cifar-explorer:', err);
    const fb = document.getElementById('cifar-explorer-fallback');
    if (fb) fb.hidden = false;
    root.hidden = true;
  });

  function init(D) {
    const NS = 'http://www.w3.org/2000/svg';
    // colours as in Fig. 2 of the paper (matplotlib defaults); HoDE stars and best-unimodal diamonds as in Fig. 2a
    const STYLE = {
      'InfoReg': { color: '#1f77b4' }, 'MMPareto': { color: '#ff7f0e' }, 'OGM-GE': { color: '#2ca02c' },
      'AUG': { color: '#d62728' }, 'ReconBoost': { color: '#9467bd' }, 'Late Fusion': { color: '#8c564b' },
      'HeDE': { color: '#e377c2', width: 3.2 },
      'HeDE (estimate)': { color: '#7f7f7f', dash: '6 4', label: 'HeDE (Eq. 1)', noBand: true },
      'HoDE': { color: '#bcbd22', marker: 'star' },
      'Best unimodal': { color: '#00008b', marker: 'diamond', dash: '2 4', noBand: true },
    };
    const W = 720, H = 346, L = 52, R = 704, T = 14, B = 320, YMIN = 20, YMAX = 95;
    const sy = (v) => B - (B - T) * (v - YMIN) / (YMAX - YMIN);
    const el = (tag, attrs, parent, txt) => {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
      if (txt !== undefined) e.textContent = txt;
      if (parent) parent.appendChild(e);
      return e;
    };
    const splitLabel = (s) => s.replace('-', '\u2013');

    const state = { axis: 'split', split: 0, size: 0, hidden: new Set() };
    const xs = () => (state.axis === 'split' ? D.splits : D.sizes);
    const xLabel = (i) => (state.axis === 'split' ? splitLabel(D.splits[i]) : String(D.sizes[i]));
    const val = (m, i) => (state.axis === 'split' ? D.acc[m][i][state.size] : D.acc[m][state.split][i]);
    const sx = (i) => L + 30 + (R - L - 60) * i / (xs().length - 1);

    // ---- knobs ----
    const mkSeg = (key, labels, onPick) => {
      const box = root.querySelector(`.mx-seg[data-key="${key}"]`);
      return labels.map((txt, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = txt;
        b.addEventListener('click', () => onPick(i));
        box.appendChild(b);
        return b;
      });
    };
    const axisBtns = mkSeg('axis', ['data split', 'ensemble size'], (i) => { state.axis = i ? 'size' : 'split'; render(); });
    const sizeBtns = mkSeg('size', D.sizes.map(String), (i) => { state.size = i; render(); });
    const splitBtns = mkSeg('split', D.splits.map(splitLabel), (i) => { state.split = i; render(); });

    // ---- legend: click to hide / show a method ----
    const legend = root.querySelector('.cf-legend');
    const legendBtns = D.methods.map((m) => {
      const st = STYLE[m] || { color: '#333' };
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('aria-pressed', 'true');
      const sw = st.marker === 'star' ? `<span class="cf-sw cf-sw-mark" style="color:${st.color}">\u2605</span>`
        : st.marker === 'diamond' ? `<span class="cf-sw cf-sw-mark" style="color:${st.color}">\u25c6</span>`
          : `<span class="cf-sw" style="border-top:${st.width ? 4 : 2.5}px ${st.dash ? 'dashed' : 'solid'} ${st.color}"></span>`;
      b.innerHTML = sw + (st.label || m);
      b.addEventListener('click', () => {
        if (state.hidden.has(m)) state.hidden.delete(m); else state.hidden.add(m);
        b.setAttribute('aria-pressed', String(!state.hidden.has(m)));
        render();
      });
      legend.appendChild(b);
      return b;
    });

    // ---- chart ----
    const svg = root.querySelector('.cf-plot');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const gGrid = el('g', {}, svg), gBands = el('g', {}, svg), gLines = el('g', {}, svg), gHover = el('g', { 'pointer-events': 'none' }, svg);
    const xTitle = root.querySelector('.cf-xtitle');

    const star = (parent, cx, cy, R0, fill) => {
      const pts = [];
      for (let k = 0; k < 10; k++) { const r = k % 2 ? R0 * 0.45 : R0, a = -Math.PI / 2 + k * Math.PI / 5; pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1)); }
      el('polygon', { points: pts.join(' '), fill, stroke: '#fff', 'stroke-width': 1 }, parent);
    };
    const diamond = (parent, cx, cy, R0, fill) =>
      el('polygon', { points: `${cx},${cy - R0} ${cx + R0 * 0.75},${cy} ${cx},${cy + R0} ${cx - R0 * 0.75},${cy}`, fill, stroke: '#fff', 'stroke-width': 1 }, parent);

    function render() {
      axisBtns.forEach((b, i) => b.setAttribute('aria-pressed', String((i ? 'size' : 'split') === state.axis)));
      sizeBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === state.size)));
      splitBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === state.split)));
      root.querySelector('.mx-knob[data-key="size"]').hidden = state.axis !== 'split';
      root.querySelector('.mx-knob[data-key="split"]').hidden = state.axis !== 'size';
      xTitle.textContent = state.axis === 'split'
        ? `data split (weaker\u2013stronger modality) \u00b7 ensemble size ${D.sizes[state.size]}`
        : `ensemble size (number of late-fusion networks) \u00b7 split ${splitLabel(D.splits[state.split])}`;

      gGrid.innerHTML = '';
      for (let y = 20; y <= 90; y += 10) {
        el('line', { x1: L, x2: R, y1: sy(y), y2: sy(y), stroke: '#e2e8f0' }, gGrid);
        el('text', { x: L - 8, y: sy(y) + 4, 'font-size': 12, fill: '#64748b', 'text-anchor': 'end' }, gGrid, y);
      }
      xs().forEach((_, i) => {
        el('line', { x1: sx(i), x2: sx(i), y1: T, y2: B, stroke: '#e2e8f0' }, gGrid);
        el('text', { x: sx(i), y: B + 18, 'font-size': 12, fill: '#64748b', 'text-anchor': 'middle' }, gGrid, xLabel(i));
      });
      el('text', { x: 14, y: (T + B) / 2, 'font-size': 13, fill: '#475569', 'text-anchor': 'middle', transform: `rotate(-90 14 ${(T + B) / 2})` }, gGrid, 'test accuracy, %');

      gBands.innerHTML = ''; gLines.innerHTML = '';
      // draw HeDE last so it sits on top
      const order = D.methods.filter((m) => m !== 'HeDE').concat(['HeDE']).filter((m) => !state.hidden.has(m));
      order.forEach((m) => {
        const st = STYLE[m] || { color: '#333' }, n = xs().length;
        const pts = Array.from({ length: n }, (_, i) => [sx(i), val(m, i)]);
        if (!st.noBand) {
          const up = pts.map(([x, v]) => [x, sy(v[0] + v[1])]), lo = pts.map(([x, v]) => [x, sy(v[0] - v[1])]).reverse();
          el('polygon', { points: up.concat(lo).map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' '), fill: st.color, 'fill-opacity': 0.16 }, gBands);
        }
        el('path', { d: pts.map(([x, v], i) => (i ? 'L' : 'M') + x.toFixed(1) + ',' + sy(v[0]).toFixed(1)).join(''),
          fill: 'none', stroke: st.color, 'stroke-width': st.width || (st.marker ? 1.4 : 2), 'stroke-dasharray': st.dash || (st.marker === 'star' ? '4 3' : null),
          'stroke-linejoin': 'round', opacity: st.marker ? 0.7 : 1 }, gLines);
        pts.forEach(([x, v]) => {
          if (st.marker === 'star') star(gLines, x, sy(v[0]), 8, st.color);
          else if (st.marker === 'diamond') diamond(gLines, x, sy(v[0]), 7, st.color);
        });
      });
      if (hoverI !== null) drawHover();
    }

    // ---- hover: snap to the nearest x and list the methods there, best first ----
    const wrap = document.createElement('div');
    wrap.className = 'mx-plot-wrap cf-wrap';
    svg.parentNode.insertBefore(wrap, svg);
    wrap.appendChild(svg);
    const tip = document.createElement('div');
    tip.className = 'mx-tip cf-tip';
    tip.setAttribute('role', 'status');
    wrap.appendChild(tip);
    let hoverI = null;
    function drawHover() {
      gHover.innerHTML = '';
      if (hoverI === null) { tip.classList.remove('is-visible'); return; }
      const i = hoverI, x = sx(i);
      el('line', { x1: x, x2: x, y1: T, y2: B, stroke: '#94a3b8', 'stroke-dasharray': '2 3' }, gHover);
      const rows = D.methods.filter((m) => !state.hidden.has(m)).map((m) => ({ m, v: val(m, i), st: STYLE[m] || { color: '#333' } }))
        .sort((a, b) => b.v[0] - a.v[0]);
      rows.forEach((r) => el('circle', { cx: x, cy: sy(r.v[0]), r: r.m === 'HeDE' ? 5.5 : 4, fill: '#fff', stroke: r.st.color, 'stroke-width': 2.2 }, gHover));
      const size = state.axis === 'split' ? D.sizes[state.size] : D.sizes[i];
      const split = state.axis === 'split' ? D.splits[i] : D.splits[state.split];
      tip.innerHTML = `<span class="cf-tip-head">Split ${splitLabel(split)} &middot; ensemble size ${size}</span>` +
        rows.map((r) => `<span class="cf-tip-row${r.m === 'HeDE' ? ' is-hede' : ''}"><i style="background:${r.st.color}"></i>${r.st.label || r.m}` +
          `<b>${r.v[0].toFixed(1)}</b><small>${r.v[1] > 0 ? '\u00b1 ' + r.v[1].toFixed(1) : ''}</small></span>`).join('');
      const rr = svg.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
      const px = rr.left - wr.left + x * rr.width / W;
      tip.classList.add('is-visible');
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      const right = px + 16 + tw <= wr.width;
      tip.style.left = (right ? px + 16 : Math.max(0, px - 16 - tw)) + 'px';
      tip.style.top = Math.max(0, (rr.top - wr.top) + (rr.height - th) / 2 - 10) + 'px';
    }
    const onPointer = (e) => {
      const r = svg.getBoundingClientRect();
      const x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
      if (x < L - 10 || x > R + 10 || y < T - 10 || y > B + 10) { hoverI = null; drawHover(); return; }
      let best = 0;
      xs().forEach((_, i) => { if (Math.abs(sx(i) - x) < Math.abs(sx(best) - x)) best = i; });
      hoverI = best; drawHover();
    };
    svg.addEventListener('pointermove', onPointer);
    svg.addEventListener('pointerdown', onPointer);
    svg.addEventListener('pointerleave', () => { hoverI = null; drawHover(); });

    // ---- autoplay: cycle the knob (ensemble size, or data split when the x-axis is the ensemble size) ----
    const INTERVAL = 1500;
    const btn = root.querySelector('.mx-play');
    const ICON_PLAY = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/></svg>';
    const ICON_PAUSE = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><rect x="2" y="1.5" width="3" height="9" rx="0.8" fill="currentColor"/><rect x="7" y="1.5" width="3" height="9" rx="0.8" fill="currentColor"/></svg>';
    let playing = false, hovered = false, visible = true, timer = null;
    const step = () => {
      if (state.axis === 'split') state.size = (state.size + 1) % D.sizes.length;
      else state.split = (state.split + 1) % D.splits.length;
      render();
    };
    const setPlaying = (on) => {
      playing = on; clearInterval(timer);
      if (on) timer = setInterval(() => { if (!hovered && visible) step(); }, INTERVAL);
      btn.innerHTML = on ? ICON_PAUSE : ICON_PLAY;
      btn.setAttribute('aria-label', on ? 'Pause' : 'Play');
    };
    btn.addEventListener('click', () => setPlaying(!playing));
    root.addEventListener('pointerdown', (e) => { if (!btn.contains(e.target) && !root.querySelector('.mx-seg[data-key="axis"]').contains(e.target)) setPlaying(false); }, true);
    svg.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hovered = true; });
    svg.addEventListener('pointerleave', () => { hovered = false; });
    if ('IntersectionObserver' in window) new IntersectionObserver((en) => { visible = en[0].isIntersecting; }, { threshold: 0.3 }).observe(root);

    render();
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPlaying(!reduceMotion);
  }
})();
