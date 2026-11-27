// Copy BibTeX to clipboard
function copyBibTeX() {
    const bibtexElement = document.getElementById('bibtex-code');
    const button = document.querySelector('.copy-bibtex-btn');
    const copyText = button.querySelector('.copy-text');
    if (!bibtexElement) return;

    const showCopied = function() {
        button.classList.add('copied');
        copyText.textContent = 'Cop';
        setTimeout(function() {
            button.classList.remove('copied');
            copyText.textContent = 'Copy';
        }, 2000);
    };

    navigator.clipboard.writeText(bibtexElement.textContent).then(showCopied).catch(function() {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = bibtexElement.textContent;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showCopied();
    });
}

// Scroll to top functionality
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Show/hide scroll to top button
window.addEventListener('scroll', function() {
    const scrollButton = document.querySelector('.scroll-to-top');
    if (!scrollButton) return;
    scrollButton.classList.toggle('visible', window.pageYOffset > 300);
});

// Simple carousel: arrows, dots, arrow keys and swipe; no auto-advance.
function initCarousel(root) {
    const track = root.querySelector('.carousel-track');
    const slides = Array.from(root.querySelectorAll('.carousel-slide'));
    const dotsBox = root.querySelector('.carousel-dots');
    const n = slides.length;
    if (!track || n === 0) return;
    let index = 0;

    const dots = slides.map(function(_, i) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'carousel-dot';
        dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
        dot.addEventListener('click', function() { go(i); });
        if (dotsBox) dotsBox.appendChild(dot);
        return dot;
    });

    function go(i) {
        index = (i + n) % n;
        track.style.transform = 'translateX(-' + (index * 100) + '%)';
        slides.forEach(function(s, j) { s.setAttribute('aria-hidden', j === index ? 'false' : 'true'); });
        dots.forEach(function(d, j) {
            d.classList.toggle('is-active', j === index);
            d.setAttribute('aria-current', j === index ? 'true' : 'false');
        });
    }

    const prev = root.querySelector('.carousel-prev');
    const next = root.querySelector('.carousel-next');
    if (prev) prev.addEventListener('click', function() { go(index - 1); });
    if (next) next.addEventListener('click', function() { go(index + 1); });

    root.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowLeft') { go(index - 1); e.preventDefault(); }
        if (e.key === 'ArrowRight') { go(index + 1); e.preventDefault(); }
    });

    let startX = null;
    root.addEventListener('touchstart', function(e) { startX = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', function(e) {
        if (startX === null) return;
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        startX = null;
    });

    go(0);
}

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.simple-carousel').forEach(initCarousel);
});

// ---- Table of contents: always visible, highlights the current section, pop-up on narrow screens ----
document.addEventListener('DOMContentLoaded', function () {
  var toc = document.getElementById('toc');
  var toggle = document.getElementById('toc-toggle');
  if (!toc) return;
  var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
  var targets = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });

  function update() {
    // current section: the last target whose top has passed a line near the top of the viewport
    var line = Math.min(160, window.innerHeight * 0.25), current = -1;
    targets.forEach(function (t, i) { if (t && t.getBoundingClientRect().top <= line) current = i; });
    // at the very bottom of the page, highlight the last entry
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = targets.length - 1;
    links.forEach(function (a, i) {
      var on = i === current;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });
  }

  function close() {
    toc.classList.remove('is-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }
  if (toggle) {
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !toc.classList.contains('is-open');
      toc.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function (e) { if (!toc.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }
  links.forEach(function (a) { a.addEventListener('click', close); });

  window.addEventListener('scroll', update, { passive: true }); // cheap: a few getBoundingClientRect calls
  window.addEventListener('resize', update);
  toc.classList.add('is-shown');
  if (toggle) toggle.classList.add('is-shown');
  update();
});
