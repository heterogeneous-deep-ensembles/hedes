// Shared helpers for the canvas animations on the project page.
// Exposes window.AnimUtils.
(function () {
  'use strict';

  const COLORS = { text: '#1e293b', muted: '#64748b', accent: '#2563eb' };
  const FONT = 'Inter, "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif';

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  // Eased progress of t through the interval [a, b], clamped to [0, 1].
  const seg = (t, [a, b]) => ease(Math.min(1, Math.max(0, (t - a) / (b - a))));
  const lerp = (a, b, t) => a + (b - a) * t;

  // Load an image, retrying a couple of times so one dropped request does not break an animation.
  const loadImage = (src, retries = 2) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      if (retries <= 0) { reject(new Error('failed to load ' + src)); return; }
      setTimeout(() => loadImage(src, retries - 1).then(resolve, reject), 300);
    };
    img.src = src;
  });

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Draw image `a` (cross-faded into `b` by `mix`) in a rounded square whose top edge is centred at (cx, top).
  function drawTile(ctx, a, cx, top, size, { b = null, mix = 0, alpha = 1, radius = 12, shadow = true, border = 0 } = {}) {
    if (alpha <= 0) return;
    const x = cx - size / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (shadow) {
      ctx.shadowColor = 'rgba(15, 23, 42, 0.18)';
      ctx.shadowBlur = size > 100 ? 16 : 6;
      ctx.shadowOffsetY = size > 100 ? 6 : 2;
    }
    roundRectPath(ctx, x, top, size, size, radius);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.save();
    ctx.clip();
    ctx.drawImage(a, x, top, size, size);
    if (b && mix > 0) { ctx.globalAlpha = alpha * mix; ctx.drawImage(b, x, top, size, size); }
    ctx.restore();
    if (border > 0) {
      ctx.globalAlpha = alpha * border;
      ctx.lineWidth = 3;
      ctx.strokeStyle = COLORS.accent;
      roundRectPath(ctx, x - 1.5, top - 1.5, size + 3, size + 3, radius + 1);
      ctx.stroke();
    }
    ctx.restore();
  }

  function text(ctx, str, x, y, { size = 18, weight = 600, color = COLORS.text, alpha = 1, align = 'center' } = {}) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  // Run render(ctx, t) on `canvas` with a W x H logical coordinate system.
  // Pauses while off-screen. Draws a single still frame at `stillAt` seconds when the user
  // prefers reduced motion, or at data-still="seconds" when that attribute is set (for screenshots).
  function run(canvas, W, H, render, stillAt) {
    const ctx = canvas.getContext('2d');

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth || W;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssW * (H / W) * dpr);
      ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    }
    const draw = (t) => { ctx.clearRect(0, 0, W, H); render(ctx, t); };
    resize();

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const still = canvas.dataset.still !== undefined ? parseFloat(canvas.dataset.still)
      : reduceMotion ? stillAt : null;
    if (still !== null) {
      draw(still);
      window.addEventListener('resize', () => { resize(); draw(still); });
      return;
    }

    let visible = true, last = null, t = 0;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }).observe(canvas);
    }
    window.addEventListener('resize', resize);
    (function tick(now) {
      if (last !== null && visible) t += Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      if (visible) draw(t);
      requestAnimationFrame(tick);
    })(performance.now());
  }

  window.AnimUtils = { COLORS, FONT, ease, seg, lerp, loadImage, drawTile, text, run };
})();
