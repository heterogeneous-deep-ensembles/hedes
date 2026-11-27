// CREMA-D: accuracy of heterogeneous ensembles vs. the share of video networks (mixture factor).
// Three knobs: audio strength (share of training data), video strength (share of training data, then number
// of input frames at full data) and ensemble size N. One of them is the "animated" dimension: the chart draws
// one curve per value of that dimension, highlights the current one and can cycle through them.
// Data: {audio: [...], video: [{data, frames}], sizes: [...], grid[audio][video][size] = {n, h, hN, kh, pts}},
// pts = [[k_video, acc, std], ...]; h is the Eq. (1) video share, hN = h * n, kh = rounded number of video networks.
(function () {
  'use strict';

  const root = document.getElementById('mix-explorer');
  if (!root) return;

  const load = window.MIX_DATA ? Promise.resolve(window.MIX_DATA)
    : fetch(root.dataset.src).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  load.then(init).catch((err) => { console.error('mixture-explorer:', err); root.hidden = true; });

  function init(D) {
    const NS = 'http://www.w3.org/2000/svg';
    const CURVE = '#1e293b', HEUR = '#2563eb', BEST = '#dc2626';
    const W = 640, H = 360, L = 58, R = 616, T = 30, B = 300;
    const YMIN = 25, YMAX = 85;
    const sx = (x) => L + (R - L) * x, sy = (y) => B - (B - T) * (y - YMIN) / (YMAX - YMIN);
    const pct = (v) => Math.round(v * 100) + '%';

    // knob values and their labels
    const DIMS = {
      audio: { values: D.audio.map((_, i) => i), label: (i) => pct(D.audio[i]), name: 'Audio' },
      video: {
        values: D.video.map((_, i) => i), name: 'Video',
        label: (i) => { const v = D.video[i]; return v.frames > 1 ? `${pct(v.data)}, ${v.frames} fr` : pct(v.data); },
      },
      size: { values: D.sizes.map((_, i) => i), label: (i) => String(D.sizes[i]), name: 'N' },
    };
    const state = { audio: 3, video: 3, size: 0, anim: 'size' }; // full data, 1 frame: the setting of the CREMA-D table
    const cell = (a, v, s) => D.grid[a][v][s];
    const withDim = (k) => { const s = { ...state }; s[state.anim] = k; return cell(s.audio, s.video, s.size); };

    const el = (tag, attrs, parent, txt) => {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      if (txt !== undefined) e.textContent = txt;
      if (parent) parent.appendChild(e);
      return e;
    };

    // ---- static chart frame ----
    const svg = root.querySelector('.mx-plot');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    for (let y = YMIN; y <= YMAX; y += 10) {
      el('line', { x1: L, x2: R, y1: sy(y), y2: sy(y), stroke: '#e2e8f0' }, svg);
      el('text', { x: L - 8, y: sy(y) + 4, 'font-size': 12, fill: '#64748b', 'text-anchor': 'end' }, svg, y);
    }
    [0, 0.25, 0.5, 0.75, 1].forEach((x) => {
      el('line', { x1: sx(x), x2: sx(x), y1: T, y2: B, stroke: '#e2e8f0' }, svg);
      el('text', { x: sx(x), y: B + 18, 'font-size': 12, fill: '#64748b', 'text-anchor': 'middle' }, svg, x);
    });
    el('text', { x: sx(0), y: B + 36, 'font-size': 11, fill: '#94a3b8', 'text-anchor': 'middle' }, svg, 'audio only');
    el('text', { x: sx(1), y: B + 36, 'font-size': 11, fill: '#94a3b8', 'text-anchor': 'middle' }, svg, 'video only');
    el('text', { x: (L + R) / 2, y: B + 52, 'font-size': 13, fill: '#475569', 'text-anchor': 'middle' }, svg, 'mixture factor: share of video networks in the ensemble');
    el('text', { x: 16, y: (T + B) / 2, 'font-size': 13, fill: '#475569', 'text-anchor': 'middle', transform: `rotate(-90 16 ${(T + B) / 2})` }, svg, 'accuracy, %');
    const gCurves = el('g', {}, svg), gHeur = el('g', {}, svg), gBand = el('g', {}, svg), gActive = el('g', {}, svg), gPts = el('g', {}, svg);
    const gHover = el('g', { 'pointer-events': 'none' }, svg);
    const label = el('text', { x: L + 12, y: T + 24, 'font-size': 20, 'font-weight': 700, fill: CURVE }, svg);

    const xy = (p, n) => [sx(p[0] / n), sy(p[1])];
    const pathOf = (d) => d.pts.map((p, i) => (i ? 'L' : 'M') + xy(p, d.n).map((v) => v.toFixed(1)).join(',')).join('');
    const star = (cx, cy, Rr, parent) => {
      const pts = [];
      for (let k = 0; k < 10; k++) { const r = k % 2 ? Rr * 0.42 : Rr, a = -Math.PI / 2 + k * Math.PI / 5; pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1)); }
      el('polygon', { points: pts.join(' '), fill: HEUR, stroke: '#fff', 'stroke-width': 1.5 }, parent);
    };
    const diamond = (cx, cy, Rr, parent) =>
      el('polygon', { points: `${cx},${cy - Rr} ${cx + Rr * 0.62},${cy} ${cx},${cy + Rr} ${cx - Rr * 0.62},${cy}`, fill: BEST, stroke: '#fff', 'stroke-width': 1.5 }, parent);

    // ---- knobs ----
    const segButtons = {};
    Object.keys(DIMS).forEach((key) => {
      const box = root.querySelector(`.mx-seg[data-key="${key}"]`);
      segButtons[key] = DIMS[key].values.map((v) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = DIMS[key].label(v);
        b.addEventListener('click', () => { state[key] = v; render(); });
        box.appendChild(b);
        return b;
      });
    });
    const animBox = root.querySelector('.mx-seg[data-key="anim"]');
    const animButtons = [['size', 'Ensemble size'], ['audio', 'Audio strength'], ['video', 'Video strength']].map(([k, txt]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = txt; b.dataset.dim = k;
      b.addEventListener('click', () => { state.anim = k; render(); });
      animBox.appendChild(b);
      return b;
    });

    const readout = root.querySelector('.mx-readout');

    // Slider along the animated dimension; its stops are that knob's values.
    const slider = root.querySelector('.mx-slider');
    const ticks = root.querySelector('.mx-ticks');
    const TICK = {
      audio: (i) => DIMS.audio.label(i),
      video: (i) => { const v = D.video[i]; return v.frames > 1 ? `${v.frames} fr` : pct(v.data); },
      size: (i) => DIMS.size.label(i),
    };
    let sliderDim = null;
    function syncSlider() {
      const vals = DIMS[state.anim].values;
      if (sliderDim !== state.anim) {
        sliderDim = state.anim;
        slider.max = vals.length - 1;
        ticks.innerHTML = '';
        vals.forEach((v, i) => {
          const t = document.createElement('span');
          t.textContent = TICK[state.anim](v);
          t.style.left = `calc(var(--mx-thumb) / 2 + (100% - var(--mx-thumb)) * ${i / (vals.length - 1)})`;
          ticks.appendChild(t);
        });
        slider.setAttribute('aria-label', { size: 'Ensemble size', audio: 'Audio strength', video: 'Video strength' }[state.anim]);
      }
      const i = vals.indexOf(state[state.anim]);
      slider.value = i;
      slider.setAttribute('aria-valuetext', DIMS[state.anim].label(state[state.anim]));
      [...ticks.children].forEach((t, j) => t.classList.toggle('is-current', j === i));
    }

    // A size of 31 networks (runs where 32 were not trained) is shown as 32; mixes are then given as shares only.
    const nLabel = (d) => String(D.sizes[state.size]);
    const mix = (d, kv) => (d.n === D.sizes[state.size] ? `${d.n - kv} audio + ${kv} video` : `${pct(kv / d.n)} video`);

    function render() {
      Object.keys(DIMS).forEach((key) => DIMS[key].values.forEach((v, i) => {
        segButtons[key][i].setAttribute('aria-pressed', String(state[key] === v));
      }));
      animButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.dim === state.anim)));
      syncSlider();
      root.querySelectorAll('.mx-knob').forEach((k) => k.classList.toggle('is-animated', k.dataset.key === state.anim));

      // faded curves along the animated dimension
      gCurves.innerHTML = '';
      DIMS[state.anim].values.forEach((v) => {
        if (v === state[state.anim]) return;
        el('path', { d: pathOf(withDim(v)), class: 'mx-curve' }, gCurves);
      });

      const d = cell(state.audio, state.video, state.size), n = d.n;
      label.textContent = state.anim === 'size' ? `N = ${nLabel(d)}`
        : `${DIMS[state.anim].name} ${DIMS[state.anim].label(state[state.anim])}`;

      // Eq. (1): unrounded video share as a dashed line
      gHeur.innerHTML = '';
      el('line', { x1: sx(d.h), x2: sx(d.h), y1: T, y2: B, stroke: HEUR, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, gHeur);
      el('text', { x: sx(d.h), y: T - 13, 'font-size': 12, 'font-weight': 600, fill: HEUR, 'text-anchor': 'middle' }, gHeur, `Eq. (1): ${d.h.toFixed(2)}`);

      // std band and active curve
      gBand.innerHTML = ''; gActive.innerHTML = ''; gPts.innerHTML = '';
      const up = d.pts.map((p) => [sx(p[0] / n), sy(p[1] + p[2])]);
      const lo = d.pts.map((p) => [sx(p[0] / n), sy(p[1] - p[2])]).reverse();
      el('polygon', { points: up.concat(lo).map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' '), fill: 'rgba(30, 41, 59, 0.12)' }, gBand);
      el('path', { d: pathOf(d), fill: 'none', stroke: CURVE, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, gActive);

      let best = d.pts[0];
      d.pts.forEach((p) => { if (p[1] > best[1]) best = p; });
      const heur = d.pts.find((p) => p[0] === d.kh);
      d.pts.forEach((p) => {
        const [x, y] = xy(p, n);
        el('circle', { cx: x, cy: y, r: n > 16 ? 2.4 : 3.6, fill: CURVE, stroke: '#fff', 'stroke-width': 1 }, gPts);
      });
      const [bx, by] = xy(best, n), [hx, hy] = xy(heur, n), same = best === heur;
      diamond(bx, by, same ? 18 : 11, gPts);
      star(hx, hy, 11, gPts);
      // best value beside the diamond, on the side away from the Eq. (1) line
      const left = bx - 60 < L ? false : bx + 60 > R ? true : bx <= sx(d.h), off = same ? 14 : 10; // stay inside the plot
      const below = by - 10 < T + 18; // near the top the label would hit the Eq. (1) label: put it under the diamond
      el('text', { x: bx + (left ? -off : off), y: below ? by + 22 : by - 10, 'font-size': 13, 'font-weight': 700, fill: '#1e293b', 'text-anchor': left ? 'end' : 'start',
        stroke: 'rgba(255,255,255,.9)', 'stroke-width': 3, 'paint-order': 'stroke' }, gPts, best[1].toFixed(2));

      const delta = heur[1] - best[1];
      readout.innerHTML =
        `<span><span class="mx-key mx-key-best"></span>Best: <b>${mix(d, best[0])}</b>, <b>${best[1].toFixed(2)}%</b></span>` +
        `<span><span class="mx-key mx-key-heur"></span>Eq. (1): <b>${mix(d, heur[0])}</b>, <b>${heur[1].toFixed(2)}%</b> ` +
        (same ? '<span class="mx-ok">(the best)</span>' : `<span class="mx-delta">(\u0394 \u2212${(-delta).toFixed(2)})</span>`) + '</span>' +
        `<span class="mx-ends">audio only ${d.pts[0][1].toFixed(2)}% &middot; video only ${d.pts[d.pts.length - 1][1].toFixed(2)}%</span>`;
      if (hoverX !== null) drawHover();
    }

    // ---- hover: snap to the nearest point of the active curve and show its accuracy ----
    const wrap = document.createElement('div');
    wrap.className = 'mx-plot-wrap';
    svg.parentNode.insertBefore(wrap, svg);
    wrap.appendChild(svg);
    const tip = document.createElement('div');
    tip.className = 'mx-tip';
    tip.setAttribute('role', 'status');
    wrap.appendChild(tip);
    let hoverX = null; // pointer position in chart units, or null when not hovering

    function drawHover() {
      gHover.innerHTML = '';
      if (hoverX === null) { tip.classList.remove('is-visible'); return; }
      const d = cell(state.audio, state.video, state.size), n = d.n;
      let p = d.pts[0];
      d.pts.forEach((q) => { if (Math.abs(sx(q[0] / n) - hoverX) < Math.abs(sx(p[0] / n) - hoverX)) p = q; });
      const [x, y] = xy(p, n);
      el('line', { x1: x, x2: x, y1: T, y2: B, stroke: '#94a3b8', 'stroke-width': 1, 'stroke-dasharray': '2 3' }, gHover);
      el('circle', { cx: x, cy: y, r: 6, fill: '#fff', stroke: CURVE, 'stroke-width': 2.5 }, gHover);

      let best = d.pts[0];
      d.pts.forEach((q) => { if (q[1] > best[1]) best = q; });
      const tags = [];
      if (p === best) tags.push('<span class="mx-tip-best">best mix</span>');
      if (p[0] === d.kh) tags.push('<span class="mx-tip-heur">Eq. (1)</span>');
      const gap = p === best ? '' : `<span class="mx-tip-gap">\u2212${(best[1] - p[1]).toFixed(2)} vs best</span>`;
      tip.innerHTML = `<b>${mix(d, p[0])}</b><span class="mx-tip-acc">${p[1].toFixed(2)} \u00b1 ${p[2].toFixed(2)}%</span>` +
        (tags.length || gap ? `<span class="mx-tip-tags">${tags.join('')}${gap}</span>` : '');

      // position in CSS pixels relative to the wrapper: above the point, or below it near the top
      const r = svg.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
      const px = r.left - wr.left + x * r.width / W, py = r.top - wr.top + y * r.height / H;
      tip.classList.add('is-visible');
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      tip.style.left = Math.max(0, Math.min(wr.width - tw, px - tw / 2)) + 'px';
      tip.style.top = (py - th - 14 >= 0 ? py - th - 14 : py + 14) + 'px';
    }
    svg.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      const x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
      hoverX = x >= L - 20 && x <= R + 20 && y >= T - 10 && y <= B + 10 ? x : null;
      drawHover();
    });
    svg.addEventListener('pointerleave', () => { hoverX = null; drawHover(); });

    // ---- autoplay along the chosen dimension; any other interaction with the widget pauses it ----
    const INTERVAL = 1500;
    const btn = root.querySelector('.mx-play');
    const ICON_PLAY = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/></svg>';
    const ICON_PAUSE = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><rect x="2" y="1.5" width="3" height="9" rx="0.8" fill="currentColor"/><rect x="7" y="1.5" width="3" height="9" rx="0.8" fill="currentColor"/></svg>';
    let playing = false, hovered = false, visible = true, timer = null;
    const step = () => {
      const vals = DIMS[state.anim].values;
      state[state.anim] = vals[(vals.indexOf(state[state.anim]) + 1) % vals.length];
      render();
    };
    const setPlaying = (on) => {
      playing = on;
      clearInterval(timer);
      if (on) timer = setInterval(() => { if (!hovered && visible) step(); }, INTERVAL);
      btn.innerHTML = on ? ICON_PAUSE : ICON_PLAY;
      btn.setAttribute('aria-label', on ? 'Pause' : 'Play');
    };
    btn.addEventListener('click', () => setPlaying(!playing));
    // Choosing what to animate keeps the animation running; any other click pauses it.
    root.addEventListener('pointerdown', (e) => { if (!btn.contains(e.target) && !animBox.contains(e.target)) setPlaying(false); }, true);
    slider.addEventListener('input', () => { setPlaying(false); state[state.anim] = DIMS[state.anim].values[+slider.value]; render(); });
    root.querySelectorAll('.mx-seg:not([data-key="anim"])').forEach((s) => s.addEventListener('focusin', () => setPlaying(false)));
    svg.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hovered = true; });
    svg.addEventListener('pointerleave', () => { hovered = false; });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }, { threshold: 0.3 }).observe(root);
    }

    render();
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPlaying(!reduceMotion);
  }
})();
