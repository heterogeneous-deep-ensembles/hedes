// Animation of the class-aligned synthetic multimodal construction.
// Each class's images are split into two NON-OVERLAPPING pools: I1 (modality 1) and the smaller I2
// (modality 2). Every image of I1 is paired with an image of the same class from I2; I2's images are
// cycled through and reused.
// Requires anim-utils.js.
(function () {
  'use strict';

  const canvas = document.getElementById('class-aligned-anim');
  if (!canvas || !window.AnimUtils) return;
  const { COLORS, seg, lerp, loadImage, drawTile, text, run } = window.AnimUtils;

  // ---- configuration (data-* attributes on the canvas) ----
  const classes = JSON.parse(canvas.dataset.classes);                 // [{label, images: [src, ...]}]
  const POOL1 = JSON.parse(canvas.dataset.pool1 || '[0, 1, 2, 3]');   // image indices forming I1
  const POOL2 = JSON.parse(canvas.dataset.pool2 || '[4, 5]');         // image indices forming I2

  // Pair each image of I1 with an image of I2, cycling through I2. The pools must not overlap,
  // so a pair can never contain the same image twice.
  function makePairs(nImages) {
    const overlap = POOL1.filter((i) => POOL2.includes(i));
    if (overlap.length) throw new Error('pools I1 and I2 overlap at image(s) ' + overlap.map((i) => '#' + (i + 1)).join(', '));
    const bad = POOL1.concat(POOL2).filter((i) => i < 0 || i >= nImages);
    if (bad.length) throw new Error('pool index out of range: ' + bad.join(', '));
    return POOL1.map((k, kpos) => {
      const jpos = kpos % POOL2.length;
      return { k, kpos, j: POOL2[jpos], jpos };
    });
  }

  // ---- layout (logical units) ----
  const W = 900, H = 430;
  const CX = W / 2, LX = 200, RX = 700;
  const P = 64, GAP = 10, POOL_TOP = 46;     // pool thumbnails
  const S = 170, SLOT_TOP = 150, DROP = 70;  // the pair

  const poolX = (n, i, cx) => cx - (n * P + (n - 1) * GAP) / 2 + P / 2 + i * (P + GAP);
  const x1At = (kpos) => poolX(POOL1.length, kpos, LX);
  const x2At = (jpos) => poolX(POOL2.length, jpos, RX);

  // ---- timeline (seconds) ----
  const INTRO = 0.9, PAIR = 3.0, OUTRO = 0.6;
  const PT = { highlight: [0, 0.35], fly: [0.35, 1.1], tuple: [1.1, 1.5], drop: [2.2, 2.8] };

  function render(ctx, data, t) {
    const total = data.reduce((s, c) => s + c.duration, 0);
    let l = t % total, ci = 0;
    while (l >= data[ci].duration) { l -= data[ci].duration; ci++; }
    const cls = data[ci], label = cls.label, nPairs = cls.pairs.length;

    const poolAlpha = seg(l, [0, 0.6]) * (1 - seg(l, [cls.duration - OUTRO, cls.duration]));
    const inPairs = l >= INTRO && l < INTRO + nPairs * PAIR;
    const p = inPairs ? Math.floor((l - INTRO) / PAIR) : (l < INTRO ? -1 : nPairs);
    const lp = inPairs ? (l - INTRO) % PAIR : 0;
    const pair = inPairs ? cls.pairs[p] : null;

    const pH = inPairs ? seg(lp, PT.highlight) : 0;
    const pF = inPairs ? seg(lp, PT.fly) : 0;
    const pT = inPairs ? seg(lp, PT.tuple) : 0;
    const pD = inPairs ? seg(lp, PT.drop) : 0;

    // ---- pools ----
    text(ctx, 'Modality 1 \u00b7 pool I\u2081', LX, 22, { alpha: poolAlpha });
    text(ctx, 'Modality 2 \u00b7 pool I\u2082 (reused)', RX, 22, { alpha: poolAlpha });
    text(ctx, label, CX, POOL_TOP + P / 2 - 10, { size: 20, weight: 700, color: COLORS.accent, alpha: poolAlpha });
    text(ctx, 'class', CX, POOL_TOP + P / 2 + 14, { size: 14, weight: 500, color: COLORS.muted, alpha: poolAlpha });

    POOL1.forEach((k, kpos) => {
      const used = kpos < p || (kpos === p && pD > 0.5);
      const border = pair && pair.kpos === kpos ? pH * (1 - pD) : 0;
      drawTile(ctx, cls.imgs[k], x1At(kpos), POOL_TOP, P, { alpha: poolAlpha * (used ? 0.35 : 1), radius: 6, border });
      text(ctx, `#${k + 1}`, x1At(kpos), POOL_TOP + P + 12, { size: 12, weight: 500, color: COLORS.muted, alpha: poolAlpha });
    });
    POOL2.forEach((j, jpos) => {
      const border = pair && pair.jpos === jpos ? pH * (1 - pD) : 0;
      drawTile(ctx, cls.imgs[j], x2At(jpos), POOL_TOP, P, { alpha: poolAlpha, radius: 6, border });
      text(ctx, `#${j + 1}`, x2At(jpos), POOL_TOP + P + 12, { size: 12, weight: 500, color: COLORS.muted, alpha: poolAlpha });
    });

    if (!pair || pF <= 0) return;

    // ---- the pair: copies fly from the pools to the slots, then drop away ----
    const alpha = 1 - pD, dy = pD * DROP;
    const size = lerp(P, S, pF), top = lerp(POOL_TOP, SLOT_TOP, pF) + dy;
    drawTile(ctx, cls.imgs[pair.k], lerp(x1At(pair.kpos), LX, pF), top, size, { alpha });
    drawTile(ctx, cls.imgs[pair.j], lerp(x2At(pair.jpos), RX, pF), top, size, { alpha });

    const la = pF * (1 - pD);
    text(ctx, 'x\u00b9', LX - S / 2 - 22, SLOT_TOP + S / 2 + dy, { size: 20, weight: 600, color: COLORS.accent, alpha: la });
    text(ctx, 'x\u00b2', RX + S / 2 + 22, SLOT_TOP + S / 2 + dy, { size: 20, weight: 600, color: COLORS.accent, alpha: la });
    text(ctx, 'same class', CX, SLOT_TOP + S / 2 - 14 + dy, { size: 15, weight: 500, color: COLORS.muted, alpha: la });
    text(ctx, `y = ${label}`, CX, SLOT_TOP + S / 2 + 12 + dy, { size: 18, weight: 600, alpha: la });

    text(ctx, `sample ${p + 1}/${nPairs}:  ( x\u00b9 = #${pair.k + 1},  x\u00b2 = #${pair.j + 1},  y = ${label} )`,
      CX, SLOT_TOP + S + 40 + dy, { size: 17, weight: 500, alpha: pT * (1 - pD) });
  }

  Promise.all(classes.map((c) => Promise.all(c.images.map((src) => loadImage(src))))).then((all) => {
    const data = classes.map((c, i) => {
      const pairs = makePairs(all[i].length);
      return { label: c.label, imgs: all[i], pairs, duration: INTRO + pairs.length * PAIR + OUTRO };
    });
    run(canvas, W, H, (ctx, t) => render(ctx, data, t), INTRO + 1.6);
  }).catch((err) => {
    console.error('class-aligned-anim:', err);
    canvas.hidden = true;
  });
})();
