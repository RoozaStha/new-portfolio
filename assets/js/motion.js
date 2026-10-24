/* ==========================================================================
   motion.js  -  advanced motion layer
   Needs: GSAP 3 + ScrollTrigger + ScrollToPlugin (cdnjs, see index.html) and
   the .motion-ready flag set by the small inline script in <head>.

   Features
    1. Page loader curtain, then a staggered hero intro (split-text title)
    2. Hero: rotating "I work on" line, interactive particle network, parallax
    3. Scroll reveals (batched + staggered) and animated section headings
    4. Count-up statistics
    5. Experience timeline whose line draws as you scroll
    6. Tilt + spotlight on cards, magnetic hero buttons, cursor glow
    7. GSAP-powered anchor scrolling (replaces the jQuery easing scroll)
    8. Scroll-progress fallback for browsers without CSS scroll timelines

   Safety
    - If GSAP fails, reduced motion is on, or the head failsafe fired, the script
      only fills in the final numbers and exits. Nothing stays hidden.
    - Only opacity and transforms are animated (no layout thrash); the canvas
      pauses when the hero is off-screen.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var ready = window.gsap && window.ScrollTrigger && root.classList.contains('motion-ready');

  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* ---- numbers that must be right even without any animation ------------- */
  function yearsSince(ym) {
    var p = ym.split('-'), now = new Date();
    var months = (now.getFullYear() - +p[0]) * 12 + (now.getMonth() + 1 - +p[1]);
    return Math.max(1, Math.floor(months / 12));
  }
  function certTotal() {
    return qsa('.cert-card').length + qsa('.more-certs li').length;
  }
  function fillFinalNumbers() {
    qsa('[data-since]').forEach(function (el) { el.textContent = yearsSince(el.getAttribute('data-since')); });
    qsa('[data-count-certs]').forEach(function (el) { el.textContent = certTotal(); });
  }
  fillFinalNumbers();

  if (!ready) {
    root.classList.remove('motion-ready');
    return;
  }

  window.__motionBooted = true; // tells the head failsafe not to un-hide anything
  gsap.registerPlugin(ScrollTrigger);
  if (window.ScrollToPlugin) gsap.registerPlugin(window.ScrollToPlugin);
  ScrollTrigger.config({ ignoreMobileResize: true });

  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var lowPower = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) ||
                 (navigator.deviceMemory && navigator.deviceMemory <= 2);
  var heroStarted = false;

  /* ---- helpers ------------------------------------------------------------ */
  function revealAll() {
    root.classList.remove('motion-ready');
    qsa('[data-reveal]').forEach(function (el) { el.removeAttribute('data-reveal'); });
    var loader = qs('.page-loader');
    if (loader) loader.remove();
  }

  /* wraps every character of the text nodes inside el in <span class="ch"> */
  function splitChars(el) {
    var chars = [];
    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        var frag = document.createDocumentFragment();
        node.textContent.split('').forEach(function (c) {
          var s = document.createElement('span');
          s.className = 'ch';
          s.textContent = c === ' ' ? '\u00a0' : c;
          frag.appendChild(s);
          chars.push(s);
        });
        el.replaceChild(frag, node);
      } else if (node.nodeType === 1) {
        chars = chars.concat(splitChars(node));
      }
    });
    return chars;
  }

  /* ---------- 1. Loader + hero intro ---------------------------------------- */
  function prepareHero() {
    var lines = qsa('.hero-title .ht-line');
    var chars = [];
    qsa('.hero-title [data-split]').forEach(function (el) { chars = chars.concat(splitChars(el)); });
    gsap.set(lines.filter(function (l) { return !l.hasAttribute('data-split'); }), { yPercent: 110 });
    gsap.set(chars, { yPercent: 120, rotate: 6 });
    return { lines: lines, chars: chars };
  }

  function runLoader(done) {
    var loader = qs('.page-loader');
    if (!loader) { done(); return; }
    var bar = qs('.pl-bar i', loader);
    var finished = false;

    gsap.to(bar, { scaleX: 0.85, duration: 1.1, ease: 'power2.out' });

    function exit() {
      if (finished) return;
      finished = true;
      gsap.timeline({ onComplete: function () { loader.remove(); done(); } })
        .to(bar, { scaleX: 1, duration: 0.25, ease: 'power1.out' })
        .to('.pl-inner', { y: -24, opacity: 0, duration: 0.4, ease: 'power2.in' }, '+=0.05')
        .to(loader, { yPercent: -100, duration: 0.85, ease: 'power4.inOut' }, '-=0.1');
    }

    var loaded = document.readyState === 'complete';
    var minDone = false;
    function tryExit() { if (minDone && loaded) exit(); }
    gsap.delayedCall(0.9, function () { minDone = true; tryExit(); });
    if (!loaded) window.addEventListener('load', function () { loaded = true; tryExit(); }, { once: true });
    gsap.delayedCall(2.2, exit); // never wait longer than this
  }

  function heroIntro(parts) {
    if (heroStarted) return;
    heroStarted = true;

    var plainLines = parts.lines.filter(function (l) { return !l.hasAttribute('data-split'); });
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to(plainLines, { yPercent: 0, duration: 0.9 }, 0)
      .to(parts.chars, { yPercent: 0, rotate: 0, duration: 1, stagger: 0.035 }, 0.1);

    var rest = qsa('.header-text [data-reveal="hero"]');
    tl.fromTo(rest, { opacity: 0, y: 30 }, {
      opacity: 1, y: 0, duration: 0.9, stagger: 0.14,
      onComplete: function () {
        rest.forEach(function (el) {
          el.removeAttribute('data-reveal');
          gsap.set(el, { clearProps: 'opacity,transform' });
        });
      }
    }, 0.55);
    tl.fromTo('.scroll-cue', { opacity: 0 }, { opacity: 1, duration: 0.8 }, 1.4);
  }

  /* ---------- 2. Hero extras --------------------------------------------------- */
  function roleRotator(cleanups) {
    var box = qs('[data-rotate]');
    if (!box) return;
    var words = qsa('.hf-word', box);
    if (words.length < 2) return;
    var clone = words[0].cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    box.appendChild(clone);
    var all = words.concat([clone]);

    var tl = gsap.timeline({ repeat: -1, delay: 1.8 });
    for (var i = 1; i < all.length; i++) {
      tl.to(all, { yPercent: -100 * i, duration: 0.65, ease: 'power3.inOut' }, '+=1.9');
    }
    tl.set(all, { yPercent: 0 });
    cleanups.push(function () { tl.kill(); gsap.set(all, { clearProps: 'transform' }); clone.remove(); });
  }

  function heroParallax() {
    if (!qs('#welcome-hero .header-text')) return;
    gsap.to('#welcome-hero .header-text', {
      yPercent: 16, opacity: 0.15, ease: 'none',
      scrollTrigger: { trigger: '#welcome-hero', start: 'top top', end: 'bottom top', scrub: true }
    });
    gsap.to('.scroll-cue', {
      opacity: 0, ease: 'none',
      scrollTrigger: { trigger: '#welcome-hero', start: 'top top', end: '+=160', scrub: true }
    });
  }

  function heroNetwork(cleanups) {
    var hero = qs('#welcome-hero'), cv = qs('.hero-canvas');
    if (!hero || !cv || lowPower || !cv.getContext) return;
    var ctx = cv.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, pts = [], active = false;
    var mouse = { x: -9999, y: -9999 };
    var LINK = 125, MOUSE_LINK = 170;

    function seed() {
      var n = Math.round(Math.min(64, Math.max(22, (W * H) / 24000)));
      pts = [];
      for (var i = 0; i < n; i++) {
        pts.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28,
          r: 1 + Math.random() * 1.4
        });
      }
    }
    function resize() {
      var r = hero.getBoundingClientRect();
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }
    function onMove(e) {
      var r = hero.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    }
    function onLeave() { mouse.x = mouse.y = -9999; }

    function tick() {
      if (!active) return;
      ctx.clearRect(0, 0, W, H);
      var i, j, a, b, dx, dy, d;
      for (i = 0; i < pts.length; i++) {
        a = pts[i];
        a.x += a.vx; a.y += a.vy;
        if (a.x < 0 || a.x > W) a.vx *= -1;
        if (a.y < 0 || a.y > H) a.vy *= -1;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, 6.2832);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fill();
        for (j = i + 1; j < pts.length; j++) {
          b = pts[j]; dx = a.x - b.x; dy = a.y - b.y; d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK) {
            ctx.strokeStyle = 'rgba(160,205,255,' + (0.38 * (1 - d / LINK)).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        dx = a.x - mouse.x; dy = a.y - mouse.y; d = Math.sqrt(dx * dx + dy * dy);
        if (d < MOUSE_LINK) {
          ctx.strokeStyle = 'rgba(108,195,255,' + (0.7 * (1 - d / MOUSE_LINK)).toFixed(3) + ')';
          ctx.lineWidth = 1.1;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
          a.x -= dx * 0.0016; a.y -= dy * 0.0016; // gentle pull towards the pointer
        }
      }
    }

    resize();
    var st = ScrollTrigger.create({
      trigger: hero, start: 'top bottom', end: 'bottom top',
      onToggle: function (self) { active = self.isActive; }
    });
    gsap.ticker.add(tick);
    window.addEventListener('resize', resize);
    hero.addEventListener('pointermove', onMove);
    hero.addEventListener('pointerleave', onLeave);
    gsap.fromTo(cv, { opacity: 0 }, { opacity: 1, duration: 1.6, delay: 0.4 });

    cleanups.push(function () {
      st.kill(); gsap.ticker.remove(tick);
      window.removeEventListener('resize', resize);
      hero.removeEventListener('pointermove', onMove);
      hero.removeEventListener('pointerleave', onLeave);
      ctx.clearRect(0, 0, W, H);
    });
  }

  function magneticButtons(cleanups) {
    if (!finePointer) return;
    qsa('.header-text a').forEach(function (btn) {
      var xTo = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3' });
      var yTo = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3' });
      var rect = null;
      function enter() { rect = btn.getBoundingClientRect(); }
      function move(e) {
        if (!rect) return;
        xTo((e.clientX - (rect.left + rect.width / 2)) * 0.25);
        yTo((e.clientY - (rect.top + rect.height / 2)) * 0.25);
      }
      function leave() { xTo(0); yTo(0); rect = null; }
      btn.addEventListener('pointerenter', enter);
      btn.addEventListener('pointermove', move);
      btn.addEventListener('pointerleave', leave);
      cleanups.push(function () {
        btn.removeEventListener('pointerenter', enter);
        btn.removeEventListener('pointermove', move);
        btn.removeEventListener('pointerleave', leave);
        gsap.set(btn, { clearProps: 'transform' });
      });
    });
  }

  /* ---------- 3. Scroll reveals -------------------------------------------------- */
  var FROM = {
    up: { x: 0, y: 36, s: 1 },
    left: { x: -48, y: 0, s: 1 },
    right: { x: 48, y: 0, s: 1 },
    scale: { x: 0, y: 24, s: 0.94 }
  };
  function fromFor(el) {
    var f = FROM[el.getAttribute('data-reveal')] || FROM.up;
    if (f.x && window.innerWidth < 768) return { x: 0, y: 36, s: f.s };
    return f;
  }

  function revealBatch(batch) {
    gsap.fromTo(
      batch,
      {
        opacity: 0,
        x: function (i, el) { return fromFor(el).x; },
        y: function (i, el) { return fromFor(el).y; },
        scale: function (i, el) { return fromFor(el).s; }
      },
      {
        opacity: 1, x: 0, y: 0, scale: 1,
        duration: 0.9, ease: 'power3.out', stagger: 0.09,
        onComplete: function () {
          batch.forEach(function (el) {
            el.removeAttribute('data-reveal');
            gsap.set(el, { clearProps: 'opacity,transform' });
          });
        }
      }
    );
    batch.forEach(function (el) {
      if (el.classList.contains('section-heading')) {
        var h = qs('h2', el);
        if (h) gsap.fromTo(h, { '--accent': 0 }, { '--accent': 1, duration: 0.9, delay: 0.25, ease: 'power3.out' });
      }
    });
  }

  function scrollReveals() {
    qsa('.section-heading h2').forEach(function (h) { h.style.setProperty('--accent', 0); });
    ScrollTrigger.batch('[data-reveal]:not([data-reveal="hero"])', {
      start: 'top 90%', once: true, interval: 0.1, onEnter: revealBatch
    });
  }

  /* ---------- 4. Count-up ---------------------------------------------------------- */
  function counters(cleanups) {
    qsa('.stat-num').forEach(function (el) {
      var target = parseInt(el.textContent, 10);
      if (isNaN(target)) return;
      var state = { v: 0 }, tween = null;
      el.textContent = '0';
      var st = ScrollTrigger.create({
        trigger: el, start: 'top 92%', once: true,
        onEnter: function () {
          tween = gsap.to(state, {
            v: target, duration: 1.8, ease: 'power2.out',
            onUpdate: function () { el.textContent = Math.round(state.v); },
            onComplete: function () { el.textContent = target; }
          });
        }
      });
      cleanups.push(function () { st.kill(); if (tween) tween.kill(); el.textContent = target; });
    });
  }

  /* ---------- 5. Experience timeline ------------------------------------------------ */
  function timeline(cleanups) {
    var wrap = qs('.xp-timeline'), fill = qs('.xp-line-fill'), list = qs('.xp-list');
    if (!wrap || !fill || !list) return;
    var tween = gsap.fromTo(fill, { scaleY: 0 }, {
      scaleY: 1, ease: 'none', transformOrigin: '50% 0',
      scrollTrigger: { trigger: list, start: 'top 62%', end: 'bottom 62%', scrub: 0.4 }
    });
    var triggers = qsa('.xp-item').map(function (item) {
      return ScrollTrigger.create({
        trigger: item, start: 'top 62%',
        onEnter: function () { item.classList.add('is-active'); },
        onLeaveBack: function () { item.classList.remove('is-active'); }
      });
    });
    cleanups.push(function () {
      tween.kill();
      triggers.forEach(function (t) { t.kill(); });
      gsap.set(fill, { clearProps: 'transform' });
      qsa('.xp-item').forEach(function (i) { i.classList.remove('is-active'); });
    });
  }

  /* ---------- 6. Tilt + spotlight, cursor glow ----------------------------------------- */
  function tiltCards(cleanups) {
    if (!finePointer) return;
    var MAX = 5;
    qsa('.tilt-card, .cert-card').forEach(function (card) {
      var rx = gsap.quickTo(card, 'rotationX', { duration: 0.45, ease: 'power2.out' });
      var ry = gsap.quickTo(card, 'rotationY', { duration: 0.45, ease: 'power2.out' });
      var rect = null;
      gsap.set(card, { transformPerspective: 900 });
      function enter() { rect = card.getBoundingClientRect(); }
      function move(e) {
        if (!rect) rect = card.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width, py = (e.clientY - rect.top) / rect.height;
        ry((px - 0.5) * 2 * MAX);
        rx((0.5 - py) * 2 * MAX);
        card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
        card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      }
      function leave() { rx(0); ry(0); rect = null; }
      card.addEventListener('pointerenter', enter);
      card.addEventListener('pointermove', move);
      card.addEventListener('pointerleave', leave);
      cleanups.push(function () {
        card.removeEventListener('pointerenter', enter);
        card.removeEventListener('pointermove', move);
        card.removeEventListener('pointerleave', leave);
        gsap.set(card, { clearProps: 'rotationX,rotationY,transformPerspective' });
      });
    });
  }

  function cursorGlow(cleanups) {
    var glow = qs('.cursor-glow');
    if (!glow || !finePointer) return;
    var xTo = gsap.quickTo(glow, 'x', { duration: 0.6, ease: 'power3' });
    var yTo = gsap.quickTo(glow, 'y', { duration: 0.6, ease: 'power3' });
    function move(e) { glow.classList.add('is-on'); xTo(e.clientX); yTo(e.clientY); }
    function out() { glow.classList.remove('is-on'); }
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('mouseleave', out);
    cleanups.push(function () {
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('mouseleave', out);
      glow.classList.remove('is-on');
    });
  }

  /* ---------- 7. Anchor scrolling ----------------------------------------------------- */
  function anchorScroll(cleanups) {
    function onClick(e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href');
      if (!id || id.length < 2) return;
      var target = null;
      try { target = qs(id); } catch (err) { return; }
      if (!target) return;

      e.preventDefault();
      e.stopImmediatePropagation(); // stops the old jQuery smooth-scroll from also running

      var bar = qs('nav.navbar') || qs('.header-area');
      var offset = bar ? Math.max(0, bar.offsetHeight - 24) : 0;
      var y = Math.max(0, target.getBoundingClientRect().top + window.pageYOffset - offset);
      var dist = Math.abs(y - window.pageYOffset);
      var dur = Math.min(1.7, Math.max(0.8, dist / 2000));

      if (window.jQuery) window.jQuery('.navbar-collapse.in').collapse('hide');

      if (window.ScrollToPlugin) {
        // GSAP's own autoKill is switched off (it can cancel on small layout shifts);
        // instead the tween stops as soon as the visitor scrolls, touches or presses a key.
        var tween = gsap.to(window, { duration: dur, scrollTo: { y: y, autoKill: false }, ease: 'power3.inOut' });
        var stop = function () {
          tween.kill();
          ['wheel', 'touchstart', 'keydown'].forEach(function (ev) { window.removeEventListener(ev, stop); });
        };
        ['wheel', 'touchstart', 'keydown'].forEach(function (ev) { window.addEventListener(ev, stop, { passive: true }); });
        tween.eventCallback('onComplete', stop);
      } else {
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
      if (history.replaceState) history.replaceState(null, '', id);
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
    document.addEventListener('click', onClick, true);
    cleanups.push(function () { document.removeEventListener('click', onClick, true); });
  }

  /* ---------- 8. Progress bar fallback ------------------------------------------------ */
  function progressFallback(cleanups) {
    var native = window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()');
    if (native) return;
    var bar = document.createElement('div');
    bar.setAttribute('aria-hidden', 'true');
    bar.style.cssText =
      'position:fixed;top:0;left:0;right:0;height:3px;z-index:10000;pointer-events:none;' +
      'transform-origin:0 50%;background:linear-gradient(90deg,#0060c7,#007bff,#6cc3ff)';
    document.body.appendChild(bar);
    var tween = gsap.fromTo(bar, { scaleX: 0 }, {
      scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true }
    });
    cleanups.push(function () { tween.kill(); bar.remove(); });
  }

  /* ---------- Boot -------------------------------------------------------------------- */
  var mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', function () {
    var cleanups = [];

    var hero = prepareHero();
    runLoader(function () { heroIntro(hero); });

    // These run behind the loader so everything is ready when it lifts.
    heroNetwork(cleanups);
    roleRotator(cleanups);
    heroParallax();
    scrollReveals();
    counters(cleanups);
    timeline(cleanups);
    tiltCards(cleanups);
    magneticButtons(cleanups);
    cursorGlow(cleanups);
    anchorScroll(cleanups);
    progressFallback(cleanups);

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }
    window.addEventListener('load', function () { ScrollTrigger.refresh(); }, { once: true });

    // Runs if the user switches reduced motion ON while the page is open.
    return function () {
      cleanups.forEach(function (fn) { fn(); });
      revealAll();
      fillFinalNumbers();
    };
  });
})();
