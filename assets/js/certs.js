/* ==========================================================================
   certs.js  -  certificate filter + accessible image viewer (<dialog>)
   Works without GSAP; uses it for the filter animation when available.
   ========================================================================== */
(function () {
  'use strict';

  var grid = document.querySelector('.cert-grid');
  var dialog = document.getElementById('certDialog');
  if (!grid) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll('.cert-card'));
  var filters = Array.prototype.slice.call(document.querySelectorAll('.cert-filter'));
  var statusEl = document.getElementById('certStatus');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- filter counts + filtering ---------------------------------------- */
  function countFor(cat) {
    return cards.filter(function (c) { return cat === 'all' || c.getAttribute('data-cat') === cat; }).length;
  }
  filters.forEach(function (btn) {
    var span = btn.querySelector('.cf-count');
    if (span) span.textContent = '(' + countFor(btn.getAttribute('data-filter')) + ')';
  });

  function applyFilter(cat) {
    var shown = [];
    cards.forEach(function (card) {
      var match = cat === 'all' || card.getAttribute('data-cat') === cat;
      card.hidden = !match;
      if (match) shown.push(card);
    });
    filters.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-filter') === cat)); });
    if (statusEl) statusEl.textContent = 'Showing ' + shown.length + ' certificate' + (shown.length === 1 ? '' : 's');
    if (window.gsap && !reduced && document.documentElement.classList.contains('motion-ready')) {
      gsap.fromTo(shown, { opacity: 0, y: 22, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out', stagger: 0.05, clearProps: 'opacity,transform' });
    }
  }
  filters.forEach(function (btn) {
    btn.addEventListener('click', function () { applyFilter(btn.getAttribute('data-filter')); });
  });

  /* ---- viewer -------------------------------------------------------------- */
  if (!dialog) return;
  var img = dialog.querySelector('.cd-stage img');
  var title = dialog.querySelector('#certDialogTitle');
  var meta = dialog.querySelector('.cd-meta');
  var count = dialog.querySelector('.cd-count');
  var verify = dialog.querySelector('.cd-verify');
  var current = 0, opener = null, closing = false;

  function visible() { return cards.filter(function (c) { return !c.hidden; }); }
  function buttonOf(card) { return card.querySelector('.cert-open'); }

  function show(i) {
    var list = visible();
    if (!list.length) return;
    current = (i + list.length) % list.length;
    var b = buttonOf(list[current]);
    img.src = b.getAttribute('data-full');
    img.alt = b.getAttribute('data-title') + ' certificate';
    title.innerHTML = b.getAttribute('data-title');
    var issuer = b.getAttribute('data-issuer'), year = b.getAttribute('data-year');
    meta.innerHTML = issuer + (year ? ' &middot; ' + year : '');
    count.textContent = (current + 1) + ' / ' + list.length;
    var link = b.getAttribute('data-link');
    if (link) { verify.href = link; verify.hidden = false; } else { verify.hidden = true; }
    dialog.querySelector('.cd-prev').hidden = dialog.querySelector('.cd-next').hidden = list.length < 2;
  }

  function open(card) {
    if (typeof dialog.showModal !== 'function') { window.open(buttonOf(card).getAttribute('data-full'), '_blank', 'noopener'); return; }
    opener = buttonOf(card);
    show(visible().indexOf(card));
    closing = false;
    dialog.showModal();
    requestAnimationFrame(function () { dialog.classList.add('is-in'); });
    dialog.querySelector('.cd-close').focus();
  }

  function close() {
    if (closing) return;
    closing = true;
    dialog.classList.remove('is-in');
    setTimeout(function () {
      dialog.close();
      if (opener) opener.focus();
    }, reduced ? 0 : 220);
  }

  grid.addEventListener('click', function (e) {
    var b = e.target.closest('.cert-open');
    if (b) open(b.closest('.cert-card'));
  });
  dialog.querySelector('.cd-close').addEventListener('click', close);
  dialog.querySelector('.cd-prev').addEventListener('click', function () { show(current - 1); });
  dialog.querySelector('.cd-next').addEventListener('click', function () { show(current + 1); });
  dialog.addEventListener('click', function (e) { if (e.target === dialog) close(); });   // backdrop click
  dialog.addEventListener('cancel', function (e) { e.preventDefault(); close(); });         // Esc key
  dialog.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });
})();
