// CREMA-D scaling laws (interactive version of Fig. 6).
// (a) log test loss of every HeDE with n_audio and n_video networks; each ray from the origin is a fixed mix.
// (b) log asymptotic loss L_inf of the power law fitted along each ray, against the mixture factor
//     m = share of video networks (m = 0: audio only, m = 1: video only).
// A slider that snaps to the fitted rays (or autoplay) moves the user's ray on (a) and its point on (b).
// Data: grid[audio][video] = {h, rays: [[m, log L_inf, 'a:v', r2], ...], heat[n_video][n_audio] = mean test loss};
// h is the Eq. (1) share of video networks; the optimum is the fitted ray with the lowest L_inf.
(function () {
  'use strict';

  const root = document.getElementById('scale-explorer');
  if (!root) return;
  const load = window.SCALE_DATA ? Promise.resolve(window.SCALE_DATA)
    : fetch(root.dataset.src).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  load.then(init).catch((err) => {
    console.error('scaling-explorer:', err);
    const fb = document.getElementById('scale-explorer-fallback');
    if (fb) fb.hidden = false;
    root.hidden = true;
  });

  function init(D) {
    const NS = 'http://www.w3.org/2000/svg';
    const OPT = '#dc2626', HEUR = '#2563eb', RAY = '#0f172a';
    const NMAX = D.nmax;
    const pct = (v) => Math.round(v * 100) + '%';
    const el = (tag, attrs, parent, txt) => {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      if (txt !== undefined) e.textContent = txt;
      if (parent) parent.appendChild(e);
      return e;
    };
    function viridis(t) {
      const c = [[0.2777, 0.0054, 0.3341], [0.1051, 1.4046, 1.3846], [-0.3309, 0.2148, 0.0951], [-4.6342, -5.7991, -19.3324],
        [6.2283, 14.1799, 56.6906], [4.7764, -13.7451, -65.3530], [-5.4355, 4.6459, 26.3124]];
      return [0, 1, 2].map((i) => { let v = c[6][i]; for (let k = 5; k >= 0; k--) v = c[k][i] + t * v; return Math.round(255 * Math.min(1, Math.max(0, v))); });
    }
    const star = (parent, cx, cy, R) => {
      const pts = [];
      for (let k = 0; k < 10; k++) { const r = k % 2 ? R * 0.42 : R, a = -Math.PI / 2 + k * Math.PI / 5; pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1)); }
      el('polygon', { points: pts.join(' '), fill: HEUR, stroke: '#fff', 'stroke-width': 1.5 }, parent);
    };
    const diamond = (parent, cx, cy, R) =>
      el('polygon', { points: `${cx},${cy - R} ${cx + R * 0.62},${cy} ${cx},${cy + R} ${cx - R * 0.62},${cy}`, fill: OPT, stroke: '#fff', 'stroke-width': 1.5 }, parent);

    // ---- state: modality strengths and the index of the selected fitted ray ----
    const state = { audio: 1, video: 4, ray: 6 }; // audio 33%, video 100% with 2 frames: the setting of Fig. 6 in the paper
    const cell = () => D.grid[state.audio][state.video];
    const linfAt = (c, m) => { // piecewise-linear between fitted rays: places the Eq. (1) star on the drawn curve
      const L = c.rays;
      for (let i = 1; i < L.length; i++) if (m <= L[i][0]) { const f = (m - L[i - 1][0]) / (L[i][0] - L[i - 1][0]); return L[i - 1][1] + f * (L[i][1] - L[i - 1][1]); }
      return L[L.length - 1][1];
    };
    const bestRay = (c) => c.rays.reduce((b, r, i) => (r[1] < c.rays[b][1] ? i : b), 0);
    const logLoss = (c, na, nv) => Math.log(c.heat[nv][na]); // log of the mean test loss of HeDEs with na audio and nv video networks

    // ---- knobs ----
    const DIMS = {
      audio: { values: D.audio.map((_, i) => i), label: (i) => pct(D.audio[i]) },
      video: { values: D.video.map((_, i) => i), label: (i) => { const v = D.video[i]; return v.frames > 1 ? `${pct(v.data)}, ${v.frames} fr` : pct(v.data); } },
    };
    const segButtons = {};
    Object.keys(DIMS).forEach((key) => {
      const box = root.querySelector(`.mx-seg[data-key="${key}"]`);
      segButtons[key] = DIMS[key].values.map((v) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = DIMS[key].label(v);
        b.addEventListener('click', () => { state[key] = v; drawScenario(); });
        box.appendChild(b);
        return b;
      });
    });

    // ---- (a) heatmap frame ----
    const hm = root.querySelector('.sl-heat');
    const HW = 400, HH = 380, HL = 52, HR = 340, HT = 22, HB = 310;
    hm.setAttribute('viewBox', `0 0 ${HW} ${HH}`);
    const cellW = (HR - HL) / (NMAX + 1);
    const hx = (na) => HL + (na + 0.5) * cellW, hy = (nv) => HB - (nv + 0.5) * cellW;
    const gImg = el('g', {}, hm), gRays = el('g', {}, hm), gAxes = el('g', {}, hm), gBar = el('g', {}, hm);
    [0, 8, 16, 24, 32].forEach((v) => {
      el('text', { x: hx(v), y: HB + 16, 'font-size': 11, fill: '#64748b', 'text-anchor': 'middle' }, gAxes, v);
      el('text', { x: HL - 6, y: hy(v) + 4, 'font-size': 11, fill: '#64748b', 'text-anchor': 'end' }, gAxes, v);
    });
    el('text', { x: (HL + HR) / 2, y: HB + 36, 'font-size': 12, fill: '#475569', 'text-anchor': 'middle' }, gAxes, 'number of audio networks');
    el('text', { x: 14, y: (HT + HB) / 2, 'font-size': 12, fill: '#475569', 'text-anchor': 'middle', transform: `rotate(-90 14 ${(HT + HB) / 2})` }, gAxes, 'number of video networks');
    // ray for mixture factor m: points (n (1 - m), n m), drawn to the edge of the grid
    const rayEnd = (m) => { const s = NMAX / Math.max(1 - m, m); return [(1 - m) * s, m * s]; };
    const drawRay = (parent, m, attrs) => { const [ex, ey] = rayEnd(m); return el('line', Object.assign({ x1: hx(0), y1: hy(0), x2: hx(ex), y2: hy(ey) }, attrs), parent); };

    // ---- (b) L_inf against the mixture factor ----
    const lc = root.querySelector('.sl-linf');
    const CW = 400, CH = 380, CL = 56, CR = 384, CT = 22, CB = 310;
    lc.setAttribute('viewBox', `0 0 ${CW} ${CH}`);
    const gFrame = el('g', {}, lc), gCurve = el('g', {}, lc), gMarks = el('g', {}, lc), gUser = el('g', {}, lc);
    const gHover = el('g', { 'pointer-events': 'none' }, lc), gHoverRay = el('g', { 'pointer-events': 'none' }, hm);
    const cx = (m) => CL + (CR - CL) * m;
    let cy = null;

    let userRay = null;
    function drawScenario() {
      Object.keys(DIMS).forEach((key) => DIMS[key].values.forEach((v, i) => segButtons[key][i].setAttribute('aria-pressed', String(state[key] === v))));
      const c = cell();
      buildTicks(c);

      // heatmap raster, one pixel per (n_audio, n_video); the empty ensemble (0, 0) is left blank
      const vals = [];
      for (let nv = 0; nv <= NMAX; nv++) for (let na = 0; na <= NMAX; na++) if (na + nv > 0) vals.push(logLoss(c, na, nv));
      const vmin = Math.min(...vals), vmax = Math.max(...vals);
      const cv = document.createElement('canvas'); cv.width = NMAX + 1; cv.height = NMAX + 1;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(NMAX + 1, NMAX + 1);
      for (let nv = 0; nv <= NMAX; nv++) for (let na = 0; na <= NMAX; na++) {
        const o = ((NMAX - nv) * (NMAX + 1) + na) * 4;
        if (na + nv === 0) continue;
        const [r, g, b] = viridis((logLoss(c, na, nv) - vmin) / (vmax - vmin));
        img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      gImg.innerHTML = '';
      el('image', { href: cv.toDataURL(), x: HL, y: HT, width: HR - HL, height: HB - HT, preserveAspectRatio: 'none', style: 'image-rendering: pixelated' }, gImg);

      gBar.innerHTML = '';
      const BX = HR + 18, BW = 12, steps = 40;
      for (let i = 0; i < steps; i++) {
        const [r, g, b] = viridis((i + 0.5) / steps);
        el('rect', { x: BX, y: HB - (i + 1) * (HB - HT) / steps, width: BW, height: (HB - HT) / steps + 0.5, fill: `rgb(${r},${g},${b})` }, gBar);
      }
      [0, 0.5, 1].forEach((f) => el('text', { x: BX + BW + 4, y: HB - f * (HB - HT) + 4, 'font-size': 10, fill: '#64748b' }, gBar, (vmin + f * (vmax - vmin)).toFixed(2)));
      el('text', { x: BX + BW / 2, y: HT - 10, 'font-size': 10, fill: '#64748b', 'text-anchor': 'middle' }, gBar, 'log test loss');

      gRays.innerHTML = '';
      const bi = bestRay(c);
      drawRay(gRays, c.rays[bi][0], { stroke: OPT, 'stroke-width': 2.5 });
      drawRay(gRays, c.h, { stroke: HEUR, 'stroke-width': 2.5, 'stroke-dasharray': '6 4' });
      userRay = [
        drawRay(gRays, 0, { stroke: '#fff', 'stroke-width': 4.5, 'stroke-linecap': 'round' }),
        drawRay(gRays, 0, { stroke: RAY, 'stroke-width': 2, 'stroke-linecap': 'round' }),
      ];

      // (b) frame and curve through the fitted rays
      const ys = c.rays.map((p) => p[1]);
      const lo = Math.min(...ys), hi = Math.max(...ys), pad = (hi - lo) * 0.08;
      const ymin = lo - pad, ymax = hi + pad;
      cy = (v) => CB - (CB - CT) * (v - ymin) / (ymax - ymin);
      gFrame.innerHTML = '';
      for (let k = 0; k <= 4; k++) {
        const v = ymin + (ymax - ymin) * k / 4;
        el('line', { x1: CL, x2: CR, y1: cy(v), y2: cy(v), stroke: '#e2e8f0' }, gFrame);
        el('text', { x: CL - 6, y: cy(v) + 4, 'font-size': 11, fill: '#64748b', 'text-anchor': 'end' }, gFrame, v.toFixed(2));
      }
      [0, 0.25, 0.5, 0.75, 1].forEach((m) => {
        el('line', { x1: cx(m), x2: cx(m), y1: CT, y2: CB, stroke: '#e2e8f0' }, gFrame);
        el('text', { x: cx(m), y: CB + 16, 'font-size': 11, fill: '#64748b', 'text-anchor': 'middle' }, gFrame, m);
      });
      el('text', { x: cx(0) - 4, y: CB + 32, 'font-size': 10, fill: '#94a3b8', 'text-anchor': 'start' }, gFrame, 'audio only');
      el('text', { x: cx(1) + 4, y: CB + 32, 'font-size': 10, fill: '#94a3b8', 'text-anchor': 'end' }, gFrame, 'video only');
      el('text', { x: (CL + CR) / 2, y: CB + 50, 'font-size': 12, fill: '#475569', 'text-anchor': 'middle' }, gFrame, 'mixture factor: share of video networks');
      el('text', { x: 14, y: (CT + CB) / 2, 'font-size': 12, fill: '#475569', 'text-anchor': 'middle', transform: `rotate(-90 14 ${(CT + CB) / 2})` }, gFrame, 'log asymptotic loss L\u221e');

      gCurve.innerHTML = '';
      el('path', { d: c.rays.map((p, i) => (i ? 'L' : 'M') + cx(p[0]).toFixed(1) + ',' + cy(p[1]).toFixed(1)).join(''), fill: 'none', stroke: '#1e293b', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, gCurve);
      c.rays.forEach((p) => el('circle', { cx: cx(p[0]), cy: cy(p[1]), r: 2.6, fill: '#1e293b' }, gCurve)); // the fitted rays
      gMarks.innerHTML = '';
      const close = Math.abs(cx(c.rays[bi][0]) - cx(c.h)) < 10 && Math.abs(cy(c.rays[bi][1]) - cy(linfAt(c, c.h))) < 10;
      diamond(gMarks, cx(c.rays[bi][0]), cy(c.rays[bi][1]), close ? 17 : 10); // enlarged behind the star when they coincide
      star(gMarks, cx(c.h), cy(linfAt(c, c.h)), 10);

      state.ray = Math.min(state.ray, c.rays.length - 1);
      drawUser();
      if (hoverM !== null) drawHover();
    }

    // ---- slider: positioned by the mixture factor, snapping to the fitted rays ----
    const slider = root.querySelector('.sl-slider'), readout = root.querySelector('.sl-readout'), ticks = root.querySelector('.sl-stops');
    function buildTicks(c) {
      ticks.innerHTML = '';
      c.rays.forEach((r) => { const t = document.createElement('span'); t.style.left = `calc(var(--mx-thumb) / 2 + (100% - var(--mx-thumb)) * ${r[0]})`; ticks.appendChild(t); });
    }
    const nearestRay = (m) => cell().rays.reduce((b, r, i, a) => (Math.abs(r[0] - m) < Math.abs(a[b][0] - m) ? i : b), 0);
    function drawUser() {
      const c = cell(), [m, v] = c.rays[state.ray];
      const [ex, ey] = rayEnd(m);
      userRay.forEach((l) => { l.setAttribute('x2', hx(ex)); l.setAttribute('y2', hy(ey)); });
      gUser.innerHTML = '';
      el('line', { x1: cx(m), x2: cx(m), y1: CT, y2: CB, stroke: '#94a3b8', 'stroke-dasharray': '2 3' }, gUser);
      el('circle', { cx: cx(m), cy: cy(v), r: 6.5, fill: '#fff', stroke: RAY, 'stroke-width': 2.5 }, gUser);
      slider.value = Math.round(m * 1000);
      [...ticks.children].forEach((t, i) => t.classList.toggle('is-current', i === state.ray));
      const bi = bestRay(c), best = c.rays[bi];
      const gap = state.ray === bi ? '<span class="mx-ok">(the optimum)</span>' : `<span class="mx-delta">(+${(v - best[1]).toFixed(3)} vs optimum)</span>`;
      // always two lines: the user's ray, then the reference mixes
      readout.innerHTML =
        `<div class="sl-line"><span><b>Your ray:</b> ${c.rays[state.ray][2]} &middot; ${pct(m)} video networks &middot; log L\u221e = <b>${v.toFixed(3)}</b> ${gap}</span></div>` +
        `<div class="sl-line"><span><span class="mx-key mx-key-best"></span>Optimum: ${pct(best[0])} video, log L\u221e = ${best[1].toFixed(3)}</span>` +
        `<span><span class="mx-key mx-key-heur"></span>Eq. (1): ${pct(c.h)} video</span></div>`;
    }

    // ---- hover on (b): snap to the nearest fitted ray, show its value, outline that ray on (a) ----
    const wrap = document.createElement('div');
    wrap.className = 'mx-plot-wrap sl-tip-wrap';
    lc.parentNode.insertBefore(wrap, lc);
    wrap.appendChild(lc);
    const tip = document.createElement('div');
    tip.className = 'mx-tip';
    tip.setAttribute('role', 'status');
    wrap.appendChild(tip);
    let hoverM = null;
    function drawHover() {
      gHover.innerHTML = ''; gHoverRay.innerHTML = '';
      if (hoverM === null) { tip.classList.remove('is-visible'); return; }
      const c = cell();
      const i = c.rays.reduce((b, r, j, a) => (Math.abs(r[0] - hoverM) < Math.abs(a[b][0] - hoverM) ? j : b), 0);
      const [m, v] = c.rays[i], x = cx(m), y = cy(v);
      el('circle', { cx: x, cy: y, r: 6, fill: '#fff', stroke: '#1e293b', 'stroke-width': 2.5 }, gHover);
      drawRay(gHoverRay, m, { stroke: '#fff', 'stroke-width': 2, 'stroke-dasharray': '4 3', opacity: 0.9 });

      const bi = bestRay(c), best = c.rays[bi], tags = [];
      if (i === bi) tags.push('<span class="mx-tip-best">optimum</span>');
      if (i === state.ray) tags.push('<span class="mx-tip-heur" style="color:#e2e8f0">your ray</span>');
      const gap = i === bi ? '' : `<span class="mx-tip-gap">+${(v - best[1]).toFixed(3)} vs optimum</span>`;
      tip.innerHTML = `<b>${pct(m)} video networks</b><span class="mx-tip-gap">ray ${c.rays[i][2].replace(':', ' : ')} (audio : video)</span><span class="mx-tip-acc">${v.toFixed(3)}</span>` +
        `<span class="mx-tip-gap">log asymptotic loss &middot; fit r\u00b2 = ${c.rays[i][3].toFixed(2)}</span>` +
        (tags.length || gap ? `<span class="mx-tip-tags">${tags.join('')}${gap}</span>` : '');

      const r = lc.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
      const px = r.left - wr.left + x * r.width / CW, py = r.top - wr.top + y * r.height / CH;
      tip.classList.add('is-visible');
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      tip.style.left = Math.max(0, Math.min(wr.width - tw, px - tw / 2)) + 'px';
      tip.style.top = (py - th - 14 >= 0 ? py - th - 14 : py + 14) + 'px';
    }
    lc.addEventListener('pointermove', (e) => {
      const r = lc.getBoundingClientRect();
      const x = (e.clientX - r.left) * CW / r.width, y = (e.clientY - r.top) * CH / r.height;
      hoverM = x >= CL - 15 && x <= CR + 15 && y >= CT - 10 && y <= CB + 10 ? Math.min(1, Math.max(0, (x - CL) / (CR - CL))) : null;
      drawHover();
    });
    lc.addEventListener('pointerleave', () => { hoverM = null; drawHover(); });

    // ---- autoplay: step through the fitted rays back and forth ----
    const INTERVAL = 600;
    const btn = root.querySelector('.mx-play');
    const ICON_PLAY = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/></svg>';
    const ICON_PAUSE = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><rect x="2" y="1.5" width="3" height="9" rx="0.8" fill="currentColor"/><rect x="7" y="1.5" width="3" height="9" rx="0.8" fill="currentColor"/></svg>';
    let playing = false, hovered = false, visible = true, timer = null, dir = 1;
    const step = () => {
      const n = cell().rays.length;
      if (state.ray + dir >= n || state.ray + dir < 0) dir = -dir;
      state.ray += dir; drawUser();
    };
    const setPlaying = (on) => {
      playing = on; clearInterval(timer);
      if (on) timer = setInterval(() => { if (!hovered && visible) step(); }, INTERVAL);
      btn.innerHTML = on ? ICON_PAUSE : ICON_PLAY;
      btn.setAttribute('aria-label', on ? 'Pause' : 'Sweep through the rays');
    };
    btn.addEventListener('click', () => setPlaying(!playing));
    slider.addEventListener('input', () => { setPlaying(false); state.ray = nearestRay(+slider.value / 1000); drawUser(); });
    root.addEventListener('pointerdown', (e) => { if (!btn.contains(e.target)) setPlaying(false); }, true);
    [hm, lc].forEach((s) => {
      s.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hovered = true; });
      s.addEventListener('pointerleave', () => { hovered = false; });
    });
    if ('IntersectionObserver' in window) new IntersectionObserver((e) => { visible = e[0].isIntersecting; }, { threshold: 0.3 }).observe(root);

    drawScenario();
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPlaying(!reduceMotion);
  }
})();
