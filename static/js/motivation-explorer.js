// Teaser (Fig. 1): bimodal synthetic CIFAR-100. Test accuracy of HeDE(2) and naive late fusion as the weaker modality
// gets more data (x-axis: accuracy of a single network on the weaker modality). Reference curves: HoDE(2), strong and
// weak unimodal networks. Hover snaps to the nearest measured split and compares HeDE with late fusion.
// Data: [{weak_share, strong_share, weak_acc, strong_acc, lf_acc, hede_acc, hode_acc, *_std, n_*}, ...].
(function () {
  'use strict';

  const root = document.getElementById('motivation-explorer');
  if (!root) return;
  const load = window.MOTIVATION_DATA ? Promise.resolve(window.MOTIVATION_DATA)
    : fetch(root.dataset.src).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  load.then(init).catch((err) => {
    console.error('motivation:', err);
    const fb = document.getElementById('motivation-fallback');
    if (fb) fb.hidden = false;
    root.hidden = true;
  });

  function init(P) {
    const NS = 'http://www.w3.org/2000/svg';
    // colours and line styles as in Fig. 1 of the paper (matplotlib defaults)
    const LF = '#1f77b4', HEDE = '#ff7f0e', HODE = '#2ca02c', STRONG = '#d62728', WEAK = '#8c564b';
    const W = 720, H = 400, L = 56, R = 704, T = 16, B = 340;
    const XMIN = 20, XMAX = 72, YMIN = 20, YMAX = 90;
    const sx = (v) => L + (R - L) * (v - XMIN) / (XMAX - XMIN), sy = (v) => B - (B - T) * (v - YMIN) / (YMAX - YMIN);
    const el = (tag, attrs, parent, txt) => {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      if (txt !== undefined) e.textContent = txt;
      if (parent) parent.appendChild(e);
      return e;
    };

    const svg = root.querySelector('.mo-plot');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    // axes and grid
    for (let y = YMIN; y <= YMAX; y += 10) {
      el('line', { x1: L, x2: R, y1: sy(y), y2: sy(y), stroke: '#e2e8f0' }, svg);
      el('text', { x: L - 8, y: sy(y) + 4, 'font-size': 12, fill: '#64748b', 'text-anchor': 'end' }, svg, y);
    }
    for (let x = 30; x <= 70; x += 10) {
      el('line', { x1: sx(x), x2: sx(x), y1: T, y2: B, stroke: '#e2e8f0' }, svg);
      el('text', { x: sx(x), y: B + 18, 'font-size': 12, fill: '#64748b', 'text-anchor': 'middle' }, svg, x);
    }
    el('text', { x: (L + R) / 2, y: B + 40, 'font-size': 13, fill: '#475569', 'text-anchor': 'middle' }, svg, 'accuracy of a single network on the weaker modality, %');
    el('text', { x: 16, y: (T + B) / 2, 'font-size': 13, fill: '#475569', 'text-anchor': 'middle', transform: `rotate(-90 16 ${(T + B) / 2})` }, svg, 'test accuracy, %');

    const path = (key) => P.map((p, i) => (i ? 'L' : 'M') + sx(p.weak_acc).toFixed(1) + ',' + sy(p[key]).toFixed(1)).join('');
    const band = (key) => {
      const up = P.map((p) => [sx(p.weak_acc), sy(p[key] + p[key + '_std'])]);
      const lo = P.map((p) => [sx(p.weak_acc), sy(p[key] - p[key + '_std'])]).reverse();
      return up.concat(lo).map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' ');
    };

    // reference curves (quiet), then the two main curves with std bands
    const gRef = el('g', {}, svg), gMain = el('g', {}, svg), gLab = el('g', {}, svg), gHover = el('g', { 'pointer-events': 'none' }, svg);
    const refs = [
      { key: 'hode_acc', color: HODE },
      { key: 'strong_acc', color: STRONG },
      { key: 'weak_acc', color: WEAK },
    ];
    refs.forEach((r) => el('path', { d: path(r.key), fill: 'none', stroke: r.color, 'stroke-width': 2, 'stroke-dasharray': '7 5', class: 'mo-fade' }, gRef));
    el('polygon', { points: band('lf_acc'), fill: LF, 'fill-opacity': 0.15, class: 'mo-fade' }, gMain);
    el('polygon', { points: band('hede_acc'), fill: HEDE, 'fill-opacity': 0.15, class: 'mo-fade' }, gMain);
    el('path', { d: path('lf_acc'), fill: 'none', stroke: LF, 'stroke-width': 3, 'stroke-linejoin': 'round', class: 'mo-draw' }, gMain);
    el('path', { d: path('hede_acc'), fill: 'none', stroke: HEDE, 'stroke-width': 3, 'stroke-linejoin': 'round', class: 'mo-draw' }, gMain);
    P.forEach((p) => {
      el('circle', { cx: sx(p.weak_acc), cy: sy(p.lf_acc), r: 3.5, fill: LF, stroke: '#fff', 'stroke-width': 1, class: 'mo-fade' }, gMain);
      el('circle', { cx: sx(p.weak_acc), cy: sy(p.hede_acc), r: 3.5, fill: HEDE, stroke: '#fff', 'stroke-width': 1, class: 'mo-fade' }, gMain);
    });

    // legend in the empty lower-right corner, as in the paper
    const items = [
      { label: 'Naive LF', color: LF }, { label: 'HeDE(2)', color: HEDE },
      { label: 'HoDE(2)', color: HODE, dash: true }, { label: 'Strong unimodal model', color: STRONG, dash: true },
      { label: 'Weak unimodal model', color: WEAK, dash: true },
    ];
    const LW = 196, LH = 14 + items.length * 19, LX = R - LW - 8, LY = B - LH - 8;
    el('rect', { x: LX, y: LY, width: LW, height: LH, rx: 6, fill: 'rgba(255,255,255,0.92)', stroke: '#e2e8f0', class: 'mo-fade' }, gLab);
    items.forEach((it, k) => {
      const y = LY + 16 + k * 19;
      el('line', { x1: LX + 12, x2: LX + 40, y1: y, y2: y, stroke: it.color, 'stroke-width': it.dash ? 2 : 3, ...(it.dash ? { 'stroke-dasharray': '7 5' } : {}), class: 'mo-fade' }, gLab);
      el('text', { x: LX + 50, y: y + 4, 'font-size': 12.5, fill: '#1e293b', class: 'mo-fade' }, gLab, it.label);
    });

    // ---- hover: snap to the nearest split ----
    const wrap = document.createElement('div');
    wrap.className = 'mo-plot-wrap';
    svg.parentNode.insertBefore(wrap, svg);
    wrap.appendChild(svg);
    const tip = document.createElement('div');
    tip.className = 'mo-tip';
    tip.setAttribute('role', 'status');
    wrap.appendChild(tip);
    const pct = (v) => Math.round(v * 100) + '%';

    function show(i) {
      gHover.innerHTML = '';
      if (i === null) { tip.classList.remove('is-visible'); return; }
      const p = P[i], x = sx(p.weak_acc), yh = sy(p.hede_acc), yl = sy(p.lf_acc);
      el('line', { x1: x, x2: x, y1: T, y2: B, stroke: '#cbd5e1', 'stroke-dasharray': '2 3' }, gHover);
      el('line', { x1: x, x2: x, y1: yh, y2: yl, stroke: '#1e293b', 'stroke-width': 2 }, gHover);       // the gap
      el('circle', { cx: x, cy: yh, r: 6.5, fill: '#fff', stroke: HEDE, 'stroke-width': 3 }, gHover);
      el('circle', { cx: x, cy: yl, r: 6.5, fill: '#fff', stroke: LF, 'stroke-width': 3 }, gHover);
      const gap = p.hede_acc - p.lf_acc;
      tip.innerHTML =
        `<span class="mo-tip-head">Weaker modality: ${pct(p.weak_share)} of the data &middot; stronger: ${pct(p.strong_share)}</span>` +
        `<span class="mo-tip-row"><i style="background:${HEDE}"></i>HeDE(2)<b>${p.hede_acc.toFixed(1)} \u00b1 ${p.hede_acc_std.toFixed(1)}%</b></span>` +
        `<span class="mo-tip-row"><i style="background:${LF}"></i>Naive LF<b>${p.lf_acc.toFixed(1)} \u00b1 ${p.lf_acc_std.toFixed(1)}%</b></span>` +
        `<span class="mo-tip-gap">${gap >= 0 ? '+' : '\u2212'}${Math.abs(gap).toFixed(1)} points for the ensemble</span>` +
        `<span class="mo-tip-ref"><em style="color:#6ee7a0">HoDE(2) ${p.hode_acc.toFixed(1)}</em> &middot; <em style="color:#fca5a5">strong ${p.strong_acc.toFixed(1)}</em> &middot; <em style="color:#d6b8a8">weak ${p.weak_acc.toFixed(1)}</em></span>`;

      const r = svg.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
      const px = r.left - wr.left + x * r.width / W, pyTop = r.top - wr.top + Math.min(yh, yl) * r.height / H;
      tip.classList.add('is-visible');
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      // beside the point (right if there is room, else left), vertically centred on the upper ring
      const right = px + 18 + tw <= wr.width;
      tip.style.left = (right ? px + 18 : Math.max(0, px - 18 - tw)) + 'px';
      tip.style.top = Math.max(0, Math.min(wr.height - th, pyTop - th / 2)) + 'px';
    }
    const onPointer = (e) => {
      const r = svg.getBoundingClientRect();
      const x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
      if (x < L - 20 || x > R + 20 || y < T - 10 || y > B + 10) { show(null); return; }
      let best = 0;
      P.forEach((p, i) => { if (Math.abs(sx(p.weak_acc) - x) < Math.abs(sx(P[best].weak_acc) - x)) best = i; });
      show(best);
    };
    svg.addEventListener('pointermove', onPointer);
    svg.addEventListener('pointerdown', onPointer); // a tap on touch screens
    svg.addEventListener('pointerleave', () => show(null));

    // one-time draw-in when the figure first comes into view: the two main curves are drawn, the rest fades in
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion && 'IntersectionObserver' in window) {
      svg.querySelectorAll('.mo-draw').forEach((p) => p.style.setProperty('--len', Math.ceil(p.getTotalLength())));
      root.classList.add('mo-pending');
      const io = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        requestAnimationFrame(() => { root.classList.remove('mo-pending'); root.classList.add('mo-drawn'); });
      }, { threshold: 0.3 });
      io.observe(root);
    }
  }
})();
