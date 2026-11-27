// Animation of the instance-aligned synthetic multimodal construction:
//   x  ->  ( G_s1(x) [low-pass],  x - G_s2(x) [high-pass],  y )
// Gaussian blurs are computed in the browser from the source images.
// Requires anim-utils.js.
(function () {
  'use strict';

  const canvas = document.getElementById('synthetic-anim');
  if (!canvas || !window.AnimUtils) return;
  const { COLORS, seg, lerp, loadImage, drawTile, text, run } = window.AnimUtils;

  // ---- configuration (data-* attributes on the canvas) ----
  const samples = JSON.parse(canvas.dataset.images); // [{src, label}]
  const SIGMA_LOW = parseFloat(canvas.dataset.sigmaLow || '6');   // px, relative to a 224px image
  const SIGMA_HIGH = parseFloat(canvas.dataset.sigmaHigh || '3'); // px, relative to a 224px image
  const GAIN = parseFloat(canvas.dataset.gain || '2');            // display gain for the high-pass image

  // ---- layout (logical units) ----
  const W = 900, H = 450, S = 200;
  const CX = W / 2, LX = 200, RX = 700, TOP = 70, DROP = 140;

  // ---- timeline of one sample (seconds) ----
  const T = {
    appear: [0.0, 0.8],
    split: [1.4, 2.4],
    transform: [2.8, 4.0],
    tuple: [4.0, 4.6],
    drop: [5.8, 6.8],
    total: 7.2,
  };

  // ---- image processing ----
  function gaussianKernel(sigma) {
    const r = Math.max(1, Math.ceil(3 * sigma));
    const k = new Float32Array(2 * r + 1);
    let sum = 0;
    for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma)); sum += k[i + r]; }
    for (let i = 0; i < k.length; i++) k[i] /= sum;
    return { k, r };
  }

  // Separable Gaussian blur of an interleaved RGB float image, edges clamped.
  function blur(src, w, h, sigma) {
    const { k, r } = gaussianKernel(sigma);
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let a = 0, b = 0, c = 0;
        for (let i = -r; i <= r; i++) {
          const xx = Math.min(w - 1, Math.max(0, x + i)), p = (y * w + xx) * 3, kv = k[i + r];
          a += src[p] * kv; b += src[p + 1] * kv; c += src[p + 2] * kv;
        }
        const q = (y * w + x) * 3; tmp[q] = a; tmp[q + 1] = b; tmp[q + 2] = c;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let a = 0, b = 0, c = 0;
        for (let i = -r; i <= r; i++) {
          const yy = Math.min(h - 1, Math.max(0, y + i)), p = (yy * w + x) * 3, kv = k[i + r];
          a += tmp[p] * kv; b += tmp[p + 1] * kv; c += tmp[p + 2] * kv;
        }
        const q = (y * w + x) * 3; out[q] = a; out[q + 1] = b; out[q + 2] = c;
      }
    }
    return out;
  }

  function toCanvas(rgb, w, h, map) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d'), img = cx.createImageData(w, h);
    for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
      img.data[j] = map(rgb[i]); img.data[j + 1] = map(rgb[i + 1]); img.data[j + 2] = map(rgb[i + 2]); img.data[j + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    return c;
  }

  function prepare(img) {
    const w = img.naturalWidth, h = img.naturalHeight, scale = w / 224;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0);
    const data = cx.getImageData(0, 0, w, h).data;
    const x = new Float32Array(w * h * 3);
    for (let i = 0, j = 0; j < data.length; i += 3, j += 4) { x[i] = data[j] / 255; x[i + 1] = data[j + 1] / 255; x[i + 2] = data[j + 2] / 255; }

    const low = blur(x, w, h, SIGMA_LOW * scale);
    const g2 = blur(x, w, h, SIGMA_HIGH * scale);
    const high = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) high[i] = x[i] - g2[i];

    const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
    return {
      orig: c,
      low: toCanvas(low, w, h, clamp255),
      high: toCanvas(high, w, h, (v) => clamp255(0.5 + GAIN * v)),
    };
  }

  // ---- one frame ----
  function render(ctx, frames, t) {
    const i = Math.floor(t / T.total) % frames.length;
    const l = t % T.total;
    const f = frames[i], label = samples[i].label;

    const pA = seg(l, T.appear), pB = seg(l, T.split), pC = seg(l, T.transform);
    const pT = seg(l, T.tuple), pD = seg(l, T.drop);
    const alpha = pA * (1 - pD), top = TOP + pD * DROP;
    const size = S * (0.92 + 0.08 * pA);

    // the two copies start on top of each other and split left / right
    drawTile(ctx, f.orig, lerp(CX, RX, pB), top, size, { b: f.high, mix: pC, alpha });
    drawTile(ctx, f.orig, lerp(CX, LX, pB), top, size, { b: f.low, mix: pC, alpha });

    // class label under the original image, before splitting
    text(ctx, `y = ${label}`, CX, TOP + S + 30, { color: COLORS.muted, weight: 500, alpha: pA * (1 - pB) });

    // modality titles and formulas
    const la = pC * (1 - pD);
    text(ctx, 'Modality 1 \u00b7 low-pass', LX, top - 32, { alpha: la });
    text(ctx, 'Modality 2 \u00b7 high-pass', RX, top - 32, { alpha: la });
    text(ctx, 'G\u03c3\u2081(x)', LX, top + S + 30, { size: 20, weight: 500, color: COLORS.accent, alpha: la });
    text(ctx, 'x \u2212 G\u03c3\u2082(x)', RX, top + S + 30, { size: 20, weight: 500, color: COLORS.accent, alpha: la });

    // the resulting multimodal sample
    text(ctx, `sample:  ( G\u03c3\u2081(x),  x \u2212 G\u03c3\u2082(x),  y = ${label} )`, CX, top + S + 80,
      { size: 17, weight: 500, alpha: pT * (1 - pD) });
  }

  Promise.all(samples.map((s) => loadImage(s.src))).then((imgs) => {
    const frames = imgs.map(prepare);
    run(canvas, W, H, (ctx, t) => render(ctx, frames, t), T.tuple[1] + 0.5);
  }).catch((err) => {
    console.error('synthetic-anim:', err);
    canvas.hidden = true;
  });
})();
