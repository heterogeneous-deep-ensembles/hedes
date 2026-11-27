# Fusion-Free Multimodal Classification with Heterogeneous Deep Ensembles

Project page for the NeurIPS 2026 paper by Ilya Burenko (ScaDS.AI, TU Dresden) and Dmitry Vetrov (Constructor University).

- Paper: https://arxiv.org/abs/2607.05019
- Page: https://heterogeneous-deep-ensembles.github.io/hedes/

## Editing

- Content lives in `index.html`; styles in `static/css/index.css`; figures in `static/images/` (extracted from the paper PDF).
- Preview locally with `python3 -m http.server` and open http://localhost:8000.
- Equations are rendered with MathJax 3 (loaded from jsDelivr).
- After changing a file in `static/css/` or `static/js/`, bump the `?v=...` version on its link in `index.html`
  (e.g. to today's date) so browsers don't keep using a cached old copy.
- The interactive trimodal ImageNet-1K figure (`static/js/allocation-explorer.js`) reads
  `static/data/trimodal_imagenet_n9.json`: per data split, the unimodal validation losses and accuracies, the
  accuracy (mean, std) of an ensemble of 3 late-fusion networks, and the HeDE `[accuracy, loss]` of every allocation of 9 networks.
  The static `static/images/fig3_trimodal.png` is shown instead if the data cannot be loaded or JavaScript is off.
- The interactive CREMA-D mixture figure (`static/js/mixture-explorer.js`) reads `static/data/crema_mixture.json`:
  `grid[audio][video][size]` holds, for every allocation, `[k_video, accuracy, std]`, plus the Eq. (1) share `h`,
  `hN = h * n` and the rounded `kh`. Where only 31 networks were trained, the 31-network results are shown as N = 32.

## Credits

Built with the [Academic Project Page Template](https://github.com/eliahuhorwitz/Academic-project-page-template), adapted from [Nerfies](https://nerfies.github.io/).
Website licensed under [CC BY-SA 4.0](http://creativecommons.org/licenses/by-sa/4.0/).
