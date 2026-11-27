// Interactive allocation explorer for the trimodal ImageNet-1K experiment (N = 9 networks):
// ternary accuracy map of every allocation, unimodal validation losses, the Eq. (1) allocation,
// and HeDE vs late fusion. Data: static/data/trimodal_imagenet_n9.json, built from the experiment CSVs.
(function () {
  'use strict';

  const root = document.getElementById('alloc-explorer');
  if (!root) return;

  fetch(root.dataset.src)
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(init)
    .catch((err) => {
      console.error('allocation-explorer:', err);
      const fb = document.getElementById('alloc-explorer-fallback');
      if (fb) fb.hidden = false;
      root.hidden = true;
    });

  function init(SPLITS) {

    const COL = ['#ea580c', '#16a34a', '#2563eb'];
    const NAMES = ['Modality 1', 'Modality 2', 'Modality 3'];
    const N = 9;
    const NS = 'http://www.w3.org/2000/svg';


    // Eq. (1) with the Largest Remainder Method, ties broken by smaller loss.
    function allocate(losses, n) {
      const inv = losses.map((l) => 1 / l), Z = inv.reduce((a, b) => a + b, 0);
      const quota = inv.map((v) => n * v / Z);
      const alloc = quota.map(Math.floor);
      const left = n - alloc.reduce((a, b) => a + b, 0);
      const frac = (i) => quota[i] - Math.floor(quota[i]);
      const order = [0, 1, 2].sort((a, b) => frac(b) - frac(a) || losses[a] - losses[b]);
      for (let k = 0; k < left; k++) alloc[order[k]]++;
      return { quota, alloc };
    }

    function el(tag, attrs, parent, txt) {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      if (txt !== undefined) e.textContent = txt;
      if (parent) parent.appendChild(e);
      return e;
    }

    function grid(k) {
      const g = new Map();
      for (const key in SPLITS[k].grid) g.set(key, SPLITS[k].grid[key][0]);
      return g;
    }

    // Matplotlib's viridis (polynomial fit), t in [0, 1].
    function viridis(t) {
      const c = [[0.2777, 0.0054, 0.3341], [0.1051, 1.4046, 1.3846], [-0.3309, 0.2148, 0.0951], [-4.6342, -5.7991, -19.3324],
        [6.2283, 14.1799, 56.6906], [4.7764, -13.7451, -65.3530], [-5.4355, 4.6459, 26.3124]];
      return [0, 1, 2].map((i) => {
        let v = c[6][i];
        for (let k = 5; k >= 0; k--) v = c[k][i] + t * v;
        return Math.round(255 * Math.min(1, Math.max(0, v)));
      });
    }
    const VMIN = 0, VMAX = 100, STEP = 10, NB = (VMAX - VMIN) / STEP;
    const bandColor = (v) => {
      const b = Math.min(NB - 1, Math.max(0, Math.floor((v - VMIN) / STEP)));
      return viridis((b + 0.5) / NB);
    };

    // Triangle geometry. The strongest modality (3) is at the top, as in Fig. 3 of the paper.
    const TOP = [210, 30], BL = [30, 306], BR = [390, 306];
    const P = (n) => { const z = n[0] + n[1] + n[2]; return [(n[2] * TOP[0] + n[0] * BL[0] + n[1] * BR[0]) / z, (n[2] * TOP[1] + n[0] * BL[1] + n[1] * BR[1]) / z]; };

    // Rasterise the colour bands: linear interpolation inside each small triangle of the grid.
    const rasterCache = new Map();
    function raster(k, g) {
      if (rasterCache.has(k)) return rasterCache.get(k);
      const S = 2, W = 420 * S, H = 330 * S;
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      const cx = cv.getContext('2d'), img = cx.createImageData(W, H);
      const [x1, y1] = TOP, [x2, y2] = BL, [x3, y3] = BR;
      const det = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
      const val = (a, b) => g.get(a + ',' + b + ',' + (N - a - b));
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
        const x = (px + 0.5) / S, y = (py + 0.5) / S;
        const lt = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / det;     // weight of TOP  (modality 3)
        const ll = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / det;     // weight of BL   (modality 1)
        const lr = 1 - lt - ll;                                             // weight of BR   (modality 2)
        if (lt < -1e-6 || ll < -1e-6 || lr < -1e-6) continue;
        const u = Math.max(0, ll) * N, w = Math.max(0, lr) * N;             // fractional n1, n2
        let i = Math.min(N - 1, Math.floor(u)), j = Math.min(N - 1 - i, Math.floor(w));
        const fx = u - i, fy = w - j;
        let v;
        if (fx + fy <= 1 || i + j + 2 > N) v = (1 - fx - fy) * val(i, j) + fx * val(i + 1, j) + fy * val(i, j + 1);
        else v = (fx + fy - 1) * val(i + 1, j + 1) + (1 - fy) * val(i + 1, j) + (1 - fx) * val(i, j + 1);
        const [r, gg, bb] = bandColor(v), o = (py * W + px) * 4;
        img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = bb; img.data[o + 3] = 255;
      }
      cx.putImageData(img, 0, 0);
      const url = cv.toDataURL();
      rasterCache.set(k, url);
      return url;
    }

    function star(svg, cx, cy, R) {
      const pts = [];
      for (let k = 0; k < 10; k++) { const r = k % 2 ? R * 0.42 : R, a = -Math.PI / 2 + k * Math.PI / 5; pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1)); }
      el('polygon', { points: pts.join(' '), fill: '#2563eb', stroke: '#fff', 'stroke-width': 1.5 }, svg);
    }
    function diamond(svg, cx, cy, R) {
      el('polygon', { points: `${cx},${cy - R} ${cx + R * 0.62},${cy} ${cx},${cy + R} ${cx - R * 0.62},${cy}`, fill: '#dc2626', stroke: '#fff', 'stroke-width': 1.5 }, svg);
    }

    function drawTernary(res, k) {
      const svg = document.getElementById('ae-tern'); svg.innerHTML = '';
      const g = grid(k);
      el('image', { href: raster(k, g), x: 0, y: 0, width: 420, height: 330 }, svg);
      el('path', { d: `M${TOP}L${BL}L${BR}Z`, fill: 'none', stroke: '#475569', 'stroke-width': 1 }, svg);
      // mesh lines of constant n_i
      for (let t = 1; t < N; t++) {
        [[[t, 0, N - t], [t, N - t, 0]], [[0, t, N - t], [N - t, t, 0]], [[0, N - t, t], [N - t, 0, t]]].forEach(([a, b]) => {
          const [ax, ay] = P(a), [bx, by] = P(b);
          el('line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: 'rgba(15,23,42,.22)', 'stroke-width': 1 }, svg);
        });
      }
      // grid points with hover tooltips
      let best = null;
      g.forEach((v, key) => {
        const n = key.split(',').map(Number), [x, y] = P(n);
        if (!best || v > best.v) best = { v, n };
        el('circle', { cx: x, cy: y, r: 3, fill: 'rgba(15,23,42,.35)' }, svg);
        const hit = el('circle', { cx: x, cy: y, r: 9, fill: 'transparent', style: 'cursor: default' }, svg);
        el('title', {}, hit, `n = (${n.join(', ')}): accuracy ${v.toFixed(2)}%, loss ${SPLITS[k].grid[key][1].toFixed(3)}`);
      });
      // corner labels
      el('text', { x: TOP[0], y: TOP[1] - 12, 'font-size': 12, 'font-weight': 700, fill: COL[2], 'text-anchor': 'middle' }, svg, 'Modality 3');
      el('text', { x: BL[0] - 4, y: BL[1] + 20, 'font-size': 12, 'font-weight': 700, fill: COL[0], 'text-anchor': 'start' }, svg, 'Modality 1');
      el('text', { x: BR[0] + 4, y: BR[1] + 20, 'font-size': 12, 'font-weight': 700, fill: COL[1], 'text-anchor': 'end' }, svg, 'Modality 2');
      // markers: best (brute force), unrounded Eq. (1), heuristic
      const [bx, by] = P(best.n), [qx, qy] = P(res.quota), [hx, hy] = P(res.alloc);
      const same = best.n.every((v, i) => v === res.alloc[i]);
      diamond(svg, bx, by, same ? 19 : 11); // enlarged behind the star when the heuristic finds the best
      el('line', { x1: qx, y1: qy, x2: hx, y2: hy, stroke: '#1e293b', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }, svg);
      el('circle', { cx: qx, cy: qy, r: 8, fill: 'none', stroke: '#1e293b', 'stroke-width': 2 }, svg);
      star(svg, hx, hy, 12);
      // Accuracy labels: each placed on the side facing away from the other marker.
      const label = (x, y, ux, uy, txt, color) => {
        const lx = x + ux * 17, ly = y + uy * 17 + 4;
        const anchor = ux > 0.35 ? 'start' : ux < -0.35 ? 'end' : 'middle';
        el('text', { x: lx, y: ly + (anchor === 'middle' ? uy * 4 : 0), 'font-size': 12, 'font-weight': 700, fill: color,
          stroke: 'rgba(255,255,255,.85)', 'stroke-width': 3, 'paint-order': 'stroke', 'text-anchor': anchor }, svg, txt);
      };
      if (same) label(bx, by, 0.8, -0.6, best.v.toFixed(2), '#1e293b');
      else {
        const dx = bx - hx, dy = by - hy, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
        label(bx, by, ux, uy, best.v.toFixed(2), '#1e293b');
        label(hx, hy, -ux, -uy, g.get(res.alloc.join(',')).toFixed(2), '#1d4ed8');
      }
      // colour bar
      const CBX = 436, CBW = 14, CBT = 30, CBB = 306, cbY = (v) => CBB - (CBB - CBT) * (v - VMIN) / (VMAX - VMIN);
      for (let b = 0; b < NB; b++) {
        const [r, gg, bb] = viridis((b + 0.5) / NB);
        el('rect', { x: CBX, y: cbY(VMIN + (b + 1) * STEP), width: CBW, height: (CBB - CBT) / NB + 0.5, fill: `rgb(${r},${gg},${bb})` }, svg);
      }
      for (let v = VMIN; v <= VMAX; v += 20) el('text', { x: CBX + CBW + 5, y: cbY(v) + 4, 'font-size': 11, fill: '#64748b' }, svg, v);
      el('text', { x: CBX + CBW / 2, y: CBT - 12, 'font-size': 11, fill: '#64748b', 'text-anchor': 'middle' }, svg, 'acc, %');
      // legend
      const lg = { x: 0, y: 12 };
      diamond(svg, lg.x + 8, lg.y, 9);
      el('text', { x: lg.x + 22, y: lg.y + 4, 'font-size': 12, fill: '#1e293b' }, svg, 'Best (brute force)');
      star(svg, lg.x + 8, lg.y + 22, 10);
      el('text', { x: lg.x + 22, y: lg.y + 26, 'font-size': 12, fill: '#1e293b' }, svg, 'Heuristic allocation');
      el('circle', { cx: lg.x + 8, cy: lg.y + 44, r: 7, fill: 'none', stroke: '#1e293b', 'stroke-width': 2 }, svg);
      el('text', { x: lg.x + 22, y: lg.y + 48, 'font-size': 12, fill: '#1e293b' }, svg, 'Eq. (1) before rounding');
    }

    // HeDE picked by the heuristic (with its gap to the best allocation) vs an ensemble of 3 late-fusion networks.
    function drawCompare(split, res) {
      const svg = document.getElementById('ae-cmp'); svg.innerHTML = '';
      const X0 = 92, X1 = 216, sx = (v) => X0 + (X1 - X0) * v / 100;
      const hede = split.grid[res.alloc.join(',')][0];
      const best = Math.max(...Object.values(split.grid).map((v) => v[0]));
      const delta = hede - best;
      [0, 50, 100].forEach((t) => {
        el('line', { x1: sx(t), x2: sx(t), y1: 4, y2: 92, stroke: '#e2e8f0' }, svg);
        el('text', { x: sx(t), y: 104, 'font-size': 10, fill: '#64748b', 'text-anchor': 'middle' }, svg, t);
      });
      const label = (y, txt) => el('text', { x: X0 - 8, y: y + 15, 'font-size': 12, 'font-weight': 600, fill: '#1e293b', 'text-anchor': 'end' }, svg, txt);
      // HeDE (Eq. 1), with its gap to the best allocation written underneath
      label(8, 'HeDE (Eq. 1)');
      el('rect', { x: X0, y: 8, width: sx(hede) - X0, height: 22, rx: 4, fill: '#1e293b' }, svg);
      el('text', { x: sx(hede) + 6, y: 23, 'font-size': 12, 'font-weight': 700, fill: '#1e293b' }, svg, hede.toFixed(1));
      el('text', { x: X0, y: 44, 'font-size': 11, fill: delta < -0.005 ? '#dc2626' : '#16a34a' }, svg,
        delta < -0.005 ? `\u0394 = \u2212${(-delta).toFixed(2)} vs best (${best.toFixed(2)})` : '\u0394 = 0: Eq. (1) is the best');
      // late fusion, mean +- std
      const lf = split.lf, y = 60;
      label(y, 'Late fusion \u00d73');
      el('rect', { x: X0, y, width: Math.max(1, sx(lf[0]) - X0), height: 22, rx: 4, fill: '#94a3b8' }, svg);
      el('line', { x1: sx(lf[0] - lf[1]), x2: sx(lf[0] + lf[1]), y1: y + 11, y2: y + 11, stroke: '#1e293b', 'stroke-width': 1.5 }, svg);
      el('text', { x: sx(lf[0] + lf[1]) + 6, y: y + 15, 'font-size': 12, 'font-weight': 700, fill: '#1e293b' }, svg, lf[0].toFixed(1));
    }

    function drawBars(split) {
      const svg = document.getElementById('ae-bars'); svg.innerHTML = '';
      const L = 30, R = 250, T = 18, Bt = 200, YMAX = 10;
      const sy = (l) => Bt - (Bt - T) * l / YMAX;
      [0, 2, 4, 6, 8, 10].forEach((v) => {
        el('line', { x1: L, x2: R, y1: sy(v), y2: sy(v), stroke: '#e2e8f0' }, svg);
        el('text', { x: L - 8, y: sy(v) + 4, 'font-size': 11, fill: '#64748b', 'text-anchor': 'end' }, svg, v);
      });
      const slot = (R - L) / 3, bw = slot * 0.56;
      split.losses.forEach((l, i) => {
        const x = L + slot * i + (slot - bw) / 2, y = sy(Math.min(l, YMAX));
        el('rect', { x, y, width: bw, height: Bt - y, rx: 4, fill: COL[i] }, svg);
        el('text', { x: x + bw / 2, y: y - 6, 'font-size': 12, 'font-weight': 700, fill: COL[i], 'text-anchor': 'middle' }, svg, l.toFixed(2));
        el('text', { x: x + bw / 2, y: Bt + 17, 'font-size': 12, 'font-weight': 700, fill: COL[i], 'text-anchor': 'middle' }, svg, 'l' + '\u2081\u2082\u2083'[i]);
        el('text', { x: x + bw / 2, y: Bt + 33, 'font-size': 11, fill: '#64748b', 'text-anchor': 'middle' }, svg, 's = ' + split.s[i]);
      });
    }

    const buttons = [];

    function select(k) {
      const split = SPLITS[k];
      buttons.forEach((b, j) => b.setAttribute('aria-pressed', String(j === k)));
      const res = allocate(split.losses, N);
      drawTernary(res, k);
      drawBars(split);
      const tup = (arr, f) => '(' + arr.map((v, i) => `<span style="color:${COL[i]}">${f(v)}</span>`).join(', ') + ')';
      document.getElementById('ae-alloc').innerHTML =
        `<span class="pre">Eq. (1): ${tup(res.quota, (v) => v.toFixed(2))} \u2192</span> n = ${tup(res.alloc, String)}`;
      drawCompare(split, res);
      const used = res.alloc.filter((n) => n > 0).length;
      document.getElementById('ae-kind').textContent =
        used === 1 ? `Homogeneous ensemble of ${NAMES[res.alloc.findIndex((n) => n > 0)]}`
          : used === 2 ? 'Heterogeneous ensemble of two modalities'
            : 'Heterogeneous ensemble of all three modalities';
      const chips = document.getElementById('ae-chips'); chips.innerHTML = '';
      res.alloc.forEach((n, i) => { for (let j = 0; j < n; j++) { const c = document.createElement('div'); c.className = 'ae-chip'; c.style.background = COL[i]; c.title = NAMES[i]; chips.appendChild(c); } });
    }

    const row = document.getElementById('ae-presets');
    SPLITS.forEach((sp, k) => {
      const b = document.createElement('button'); b.type = 'button';
      b.textContent = sp.s.join('\u2013');
      b.addEventListener('click', () => select(k));
      row.appendChild(b); buttons.push(b);
    });
    let current = 1;
    const show = (k) => { current = k; select(k); };
    buttons.forEach((b, k) => b.addEventListener('click', () => { current = k; }));
    show(1); // (0.01-0.03-0.96), the split in Fig. 3

    // Autoplay: step through the splits while the widget is on screen, with a play/pause button.
    // It pauses while the mouse is over the widget (so hover tooltips can be read) and stops when the user
    // clicks or taps anywhere else on the widget; the button resumes it. Off for reduced-motion users.
    const INTERVAL = 1500;
    const btn = document.getElementById('ae-play');
    const ICON_PLAY = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/></svg>';
    const ICON_PAUSE = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><rect x="2" y="1.5" width="3" height="9" rx="0.8" fill="currentColor"/><rect x="7" y="1.5" width="3" height="9" rx="0.8" fill="currentColor"/></svg>';
    let playing = false, hovered = false, visible = true, timer = null;
    const setPlaying = (on) => {
      playing = on;
      clearInterval(timer);
      if (on) timer = setInterval(() => { if (!hovered && visible) show((current + 1) % SPLITS.length); }, INTERVAL);
      btn.innerHTML = on ? ICON_PAUSE : ICON_PLAY;
      btn.setAttribute('aria-label', on ? 'Pause cycling through the splits' : 'Cycle through the splits');
    };
    btn.addEventListener('click', () => setPlaying(!playing));
    root.addEventListener('pointerdown', (e) => { if (!btn.contains(e.target)) setPlaying(false); }, true);
    row.addEventListener('focusin', () => setPlaying(false));
    root.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hovered = true; });
    root.addEventListener('pointerleave', () => { hovered = false; });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }, { threshold: 0.3 }).observe(root);
    }
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPlaying(!reduceMotion);
  }
})();
