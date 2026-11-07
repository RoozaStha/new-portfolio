/* ==========================================================================
   advanced.js  -  the "wow" layer (needs motion.js to have started first)

   1. Decks          swappable 3D card decks: drag / swipe / arrows / keys / dots
   2. Stacked cards  experience cards that pile up as you scroll
   3. Ro             a small animated guide character with speech bubbles
   4. Side dots      section indicator;  5. cursor ring;  6. split headings
   7. About photo parallax

   Everything is progressive: without GSAP, with reduced motion, or if
   motion.js did not start, the page keeps its plain grids and lists.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var ok = window.gsap && window.ScrollTrigger && window.__motionBooted && root.classList.contains('motion-ready');
  if (!ok) return;

  gsap.registerPlugin(ScrollTrigger);

  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ======================================================================
     1. DECKS
     ====================================================================== */
  function makeDeck(deckEl) {
    var stage = qs('.deck-stage', deckEl);
    var cards = Array.prototype.slice.call(stage.children);
    var n = cards.length;
    if (n < 2) return function () {};

    var prevBtn = qs('.deck-prev', deckEl), nextBtn = qs('.deck-next', deckEl);
    var dotsBox = qs('.deck-dots', deckEl), toggle = qs('.deck-toggle', deckEl), live = qs('.deck-live', deckEl);
    var autoplay = deckEl.hasAttribute('data-autoplay');

    var cur = 0, gapX = 280, maxVis = 2;
    var hovering = false, userTouched = false, inView = false, timer = null, drag = null, introDone = false;
    var cleanups = [];

    deckEl.classList.add('deck-enhanced');

    /* dots */
    var dots = cards.map(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'deck-dot';
      b.setAttribute('aria-label', 'Show ' + c.getAttribute('data-title'));
      b.addEventListener('click', function () { go(i, true); });
      dotsBox.appendChild(b);
      return b;
    });

    cards.forEach(function (c, i) {
      c.setAttribute('role', 'group');
      c.setAttribute('aria-roledescription', 'slide');
      c.setAttribute('aria-label', (i + 1) + ' of ' + n);
      gsap.set(c, { transformPerspective: 1500, xPercent: -50 });
    });

    function measure() {
      deckEl.classList.add('deck-active');
      cards.forEach(function (c) { c.style.height = ''; });
      var h = 0;
      cards.forEach(function (c) { h = Math.max(h, c.offsetHeight); });
      deckEl.style.setProperty('--deck-card-h', h + 'px');
      deckEl.style.setProperty('--deck-h', (h + 50) + 'px');
      var w = stage.clientWidth;
      maxVis = w < 700 ? 1 : 2;
      gapX = w < 700 ? w * 0.62 : Math.min(300, w * 0.29);
    }

    function signed(k) {
      var d = k - cur;
      if (d > n / 2) d -= n;
      if (d < -n / 2) d += n;
      return d;
    }

    function place(instant, stagger) {
      cards.forEach(function (c, k) {
        var d = signed(k), a = Math.abs(d), show = a <= maxVis;
        gsap.to(c, {
          x: d * gapX,
          z: -a * 150,
          rotationY: -d * 26,
          scale: 1 - a * 0.09,
          opacity: show ? (a <= 1 ? 1 : 0.55) : 0,
          zIndex: 50 - Math.round(a * 10),
          duration: instant ? 0 : 0.85,
          delay: stagger ? a * 0.08 : 0,
          ease: 'power3.out',
          overwrite: true
        });
        c.classList.toggle('is-front', a === 0);
        c.setAttribute('aria-hidden', a === 0 ? 'false' : 'true');
        try { c.inert = a !== 0; } catch (e) { /* older browsers */ }
        c.style.pointerEvents = show ? 'auto' : 'none';
      });
      dots.forEach(function (d, i) { d.setAttribute('aria-current', String(i === cur)); });
    }

    function go(i, byUser) {
      cur = (i + n) % n;
      if (byUser) userTouched = true;
      place(false, false);
      if (live) live.textContent = (cur + 1) + ' of ' + n + ': ' + cards[cur].getAttribute('data-title');
      document.dispatchEvent(new CustomEvent('deck:change', { detail: { deck: deckEl.getAttribute('data-deck'), index: cur } }));
    }

    /* autoplay: only while visible, not hovered, and until the visitor interacts */
    function tick() {
      if (autoplay && inView && !hovering && !userTouched && !document.hidden) go(cur + 1, false);
    }
    if (autoplay) timer = window.setInterval(tick, 4800);

    /* controls */
    function onPrev() { go(cur - 1, true); }
    function onNext() { go(cur + 1, true); }
    prevBtn.addEventListener('click', onPrev);
    nextBtn.addEventListener('click', onNext);

    function onKey(e) {
      if (!deckEl.classList.contains('deck-active')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(cur - 1, true); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(cur + 1, true); }
      else if (e.key === 'Home') { e.preventDefault(); go(0, true); }
      else if (e.key === 'End') { e.preventDefault(); go(n - 1, true); }
    }
    stage.addEventListener('keydown', onKey);

    /* drag / swipe */
    function onDown(e) {
      if (!deckEl.classList.contains('deck-active')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, dx: 0, moved: false, id: e.pointerId };
    }
    function onMove(e) {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dx = e.clientX - drag.x;
      if (Math.abs(drag.dx) > 6 && !drag.moved) {
        drag.moved = true;
        try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
      if (drag.moved) {
        var front = cards[cur];
        gsap.to(front, { x: drag.dx, rotationZ: drag.dx * 0.025, duration: 0.15, overwrite: 'auto' });
      }
    }
    function onUp(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag; drag = null;
      gsap.to(cards[cur], { rotationZ: 0, duration: 0.4 });
      if (d.moved) {
        userTouched = true;
        if (d.dx < -55) go(cur + 1, true);
        else if (d.dx > 55) go(cur - 1, true);
        else place(false, false);
      } else {
        // a plain click on a side card brings it to the front
        var card = e.target.closest && e.target.closest('.deck-card');
        var k = cards.indexOf(card);
        if (k > -1 && k !== cur && !e.target.closest('a,button')) go(k, true);
      }
    }
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);

    function enter() { hovering = true; }
    function leave() { hovering = false; }
    deckEl.addEventListener('pointerenter', enter);
    deckEl.addEventListener('pointerleave', leave);
    deckEl.addEventListener('focusin', enter);
    deckEl.addEventListener('focusout', leave);

    /* grid <-> cards toggle */
    function setActive(on) {
      if (on) {
        measure();
        place(true, false);
        toggle.setAttribute('aria-pressed', 'false');
        toggle.textContent = 'Show all as a grid';
      } else {
        deckEl.classList.remove('deck-active');
        cards.forEach(function (c) {
          gsap.set(c, { clearProps: 'x,z,rotationY,rotationZ,scale,opacity,zIndex,xPercent' });
          c.style.height = '';
          c.style.pointerEvents = '';
          c.setAttribute('aria-hidden', 'false');
          try { c.inert = false; } catch (e) { /* ignore */ }
        });
        toggle.setAttribute('aria-pressed', 'true');
        toggle.textContent = 'Back to swipeable cards';
        ScrollTrigger.refresh();
      }
    }
    function onToggle() { setActive(!deckEl.classList.contains('deck-active')); }
    toggle.addEventListener('click', onToggle);

    /* resize */
    var rt = null;
    function onResize() {
      window.clearTimeout(rt);
      rt = window.setTimeout(function () {
        if (!deckEl.classList.contains('deck-active')) return;
        measure(); place(true, false);
      }, 160);
    }
    window.addEventListener('resize', onResize);

    /* first view: the cards fan out of one pile */
    measure();
    gsap.set(cards, { x: 0, z: -60, rotationY: 0, scale: 0.8, opacity: 0 });
    place(true, false);
    gsap.set(cards, { x: 0, z: -60, rotationY: 0, scale: 0.8, opacity: 0 });

    var st = ScrollTrigger.create({
      trigger: deckEl, start: 'top 78%', end: 'bottom 12%',
      onEnter: function () { if (!introDone) { introDone = true; place(false, true); } },
      onToggle: function (self) { inView = self.isActive; }
    });
    // if the deck is already on screen at load
    if (st.isActive && !introDone) { introDone = true; place(false, true); }

    return function destroy() {
      window.clearInterval(timer);
      window.clearTimeout(rt);
      st.kill();
      prevBtn.removeEventListener('click', onPrev);
      nextBtn.removeEventListener('click', onNext);
      stage.removeEventListener('keydown', onKey);
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onUp);
      deckEl.removeEventListener('pointerenter', enter);
      deckEl.removeEventListener('pointerleave', leave);
      deckEl.removeEventListener('focusin', enter);
      deckEl.removeEventListener('focusout', leave);
      toggle.removeEventListener('click', onToggle);
      window.removeEventListener('resize', onResize);
      deckEl.classList.remove('deck-active', 'deck-enhanced');
      cards.forEach(function (c) {
        gsap.killTweensOf(c);
        gsap.set(c, { clearProps: 'all' });
        c.removeAttribute('role'); c.removeAttribute('aria-roledescription'); c.removeAttribute('aria-label');
        c.setAttribute('aria-hidden', 'false'); c.style.height = ''; c.style.pointerEvents = '';
        try { c.inert = false; } catch (e) { /* ignore */ }
      });
      dots.forEach(function (d) { d.remove(); });
    };
  }

  /* ======================================================================
     2. STACKED EXPERIENCE CARDS (desktop)
     ====================================================================== */
  function makeStack() {
    var items = qsa('.xs-item');
    if (items.length < 2) return function () {};
    var cards = items.map(function (i) { return qs('.xs-card', i); });

    function equalise() {
      cards.forEach(function (c) { c.style.minHeight = ''; });
      var h = 0;
      cards.forEach(function (c) { h = Math.max(h, c.offsetHeight); });
      cards.forEach(function (c) { c.style.minHeight = h + 'px'; });
    }
    equalise();
    var rt = null;
    function onResize() { window.clearTimeout(rt); rt = window.setTimeout(function () { equalise(); ScrollTrigger.refresh(); }, 180); }
    window.addEventListener('resize', onResize);

    var tweens = [];
    items.forEach(function (item, i) {
      if (i === items.length - 1) return;
      var next = items[i + 1];
      tweens.push(gsap.to(item, {
        scale: 0.93 - 0.01 * i, y: -14, ease: 'none',
        scrollTrigger: { trigger: next, start: 'top 92%', end: 'top ' + (108 + (i + 1) * 16) + 'px', scrub: true }
      }));
      tweens.push(gsap.to(item, {
        '--dim': 0.38, ease: 'none',
        scrollTrigger: { trigger: next, start: 'top 80%', end: 'top ' + (108 + (i + 1) * 16) + 'px', scrub: true }
      }));
    });

    return function destroy() {
      window.removeEventListener('resize', onResize);
      window.clearTimeout(rt);
      tweens.forEach(function (t) { if (t.scrollTrigger) t.scrollTrigger.kill(); t.kill(); });
      items.forEach(function (i) { gsap.set(i, { clearProps: 'transform,--dim' }); });
      cards.forEach(function (c) { c.style.minHeight = ''; });
    };
  }

  /* ======================================================================
     3. RO - the guide character
     ====================================================================== */
  var SECTION_TIPS = {
    'welcome-hero': 'Hi! I\u2019m Ro, Roja\u2019s portfolio guide. Scroll down and I\u2019ll show you around.',
    about: 'Roja is an ERP Business Analyst who turns business requirements into working Odoo solutions.',
    education: 'Bachelor in Information Management, completed at St. Xavier\u2019s College, Kathmandu.',
    skills: 'Try dragging these cards! Ten Odoo modules, from CRM to Manufacturing.',
    experience: 'Scroll slowly: every role stacks on top of the one before it.',
    projects: 'Three projects built end to end. Swipe the cards or use the arrows.',
    portfolio: 'Click any certificate to open it full size. Filter by topic above.',
    profiles: 'You can find Roja on GitHub and LinkedIn too.',
    contact: 'Want to work together? Say hello with the form here.'
  };
  var EXTRA_TIPS = [
    'Psst: the dots on the right jump between sections.',
    'Roja\u2019s Odoo 18 Functional Certification is in the Certificates section.',
    'Requirement gathering, gap analysis, UAT and user training: that\u2019s the daily work.',
    'You can hide me with the little \u00d7 if I get in the way.'
  ];

  function makeGuide() {
    var guide = qs('.guide'), launcher = qs('.guide-launcher');
    if (!guide) return function () {};

    var btn = qs('.guide-char', guide), bubble = qs('.guide-bubble', guide), text = qs('.guide-text', guide), closeBtn = qs('.guide-close', guide);
    var svg = qs('svg', guide);
    var floatG = qs('.ro-float', svg), shadow = qs('.ro-shadow', svg), glow = qs('.ro-glow', svg), bulb = qs('.ro-bulb', svg);
    var eyes = qs('.ro-eyes', svg), pupils = qsa('.ro-pupil', svg), mouth = qs('.ro-mouth', svg);
    var armR = qs('.ro-arm-r', svg), armL = qs('.ro-arm-l', svg);

    var tw = null, hideCall = null, blinkCall = null, lastSection = null, extraIdx = 0;
    var alive = false, started = false, closed = false;
    try { closed = window.sessionStorage.getItem('guideClosed') === '1'; } catch (e) { /* ignore */ }

    gsap.set(guide, { yPercent: 130, opacity: 0 });
    gsap.set(eyes, { svgOrigin: '90 80' });
    gsap.set(armR, { svgOrigin: '137.5 146' });
    gsap.set(armL, { svgOrigin: '42.5 146' });
    gsap.set(mouth, { svgOrigin: '90 102' });
    if (closed) guide.style.display = 'none';

    /* idle life (paused while Ro is hidden) */
    var idle = gsap.timeline({ paused: true });
    idle.to(floatG, { y: -7, duration: 1.5, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0)
        .to(shadow, { scaleX: 0.86, opacity: 0.7, svgOrigin: '90 222', duration: 1.5, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0)
        .to(glow, { opacity: 0.35, scale: 1.25, svgOrigin: '90 14', duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0)
        .to(armL, { rotation: 4, duration: 1.5, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0);

    function blink() {
      if (!alive) return;
      gsap.timeline({ onComplete: function () { if (alive) blinkCall = gsap.delayedCall(rand(2.2, 5.5), blink); } })
        .to(eyes, { scaleY: 0.08, duration: 0.07, ease: 'power1.in' })
        .to(eyes, { scaleY: 1, duration: 0.12, ease: 'power1.out' });
    }

    /* eyes follow the cursor */
    var px = pupils.map(function (p) { return gsap.quickTo(p, 'x', { duration: 0.25, ease: 'power3' }); });
    var py = pupils.map(function (p) { return gsap.quickTo(p, 'y', { duration: 0.25, ease: 'power3' }); });
    function look(e) {
      if (!alive) return;
      var r = btn.getBoundingClientRect();
      var cx = r.left + r.width * 0.5, cy = r.top + r.height * 0.36;
      var dx = e.clientX - cx, dy = e.clientY - cy;
      var dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      var k = Math.min(1, dist / 260) * 5;
      px.forEach(function (f) { f((dx / dist) * k); }); py.forEach(function (f) { f((dy / dist) * k); });
    }
    if (finePointer) window.addEventListener('pointermove', look, { passive: true });

    function wave() {
      gsap.timeline()
        .to(armR, { rotation: -128, duration: 0.3, ease: 'back.out(2)' })
        .to(armR, { rotation: -98, duration: 0.17, yoyo: true, repeat: 5, ease: 'sine.inOut' })
        .to(armR, { rotation: 0, duration: 0.35, ease: 'power2.inOut' });
      gsap.fromTo(bulb, { fill: '#fff3b0' }, { fill: '#ffd166', duration: 0.8 });
    }
    function talk(on) {
      gsap.to(mouth, on ? { scaleY: 1.6, duration: 0.13, yoyo: true, repeat: -1, ease: 'sine.inOut' } : { scaleY: 1, duration: 0.2, overwrite: true });
    }
    function hide() {
      gsap.to(bubble, { opacity: 0, y: 8, scale: 0.94, duration: 0.3, ease: 'power2.in', onComplete: function () { bubble.style.visibility = 'hidden'; } });
    }
    function say(msg, doWave) {
      if (!alive) return;
      if (hideCall) hideCall.kill();
      if (tw) tw.kill();
      bubble.style.visibility = 'visible';
      gsap.fromTo(bubble, { opacity: 0, y: 12, scale: 0.9, transformOrigin: '0% 100%' }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.8)', overwrite: true });
      var o = { n: 0 };
      text.textContent = '';
      tw = gsap.to(o, {
        n: msg.length, duration: Math.min(1.4, msg.length * 0.022), ease: 'none',
        onStart: function () { talk(true); },
        onUpdate: function () { text.textContent = msg.slice(0, Math.round(o.n)); },
        onComplete: function () { text.textContent = msg; talk(false); }
      });
      if (doWave) wave();
      hideCall = gsap.delayedCall(window.innerWidth < 768 ? 4.2 : Math.max(5.5, msg.length * 0.07), hide);
    }

    /* the small button that brings Ro back after the x */
    function showLauncher() {
      if (!launcher) return;
      launcher.classList.add('is-on');
      gsap.fromTo(launcher, { scale: 0, rotation: -40 }, { scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(2.2)' });
    }
    function hideLauncher() {
      if (!launcher) return;
      gsap.to(launcher, { scale: 0, duration: 0.25, ease: 'power2.in', onComplete: function () { launcher.classList.remove('is-on'); } });
    }

    function openGuide(first) {
      if (alive) return;
      alive = true; closed = false;
      try { window.sessionStorage.removeItem('guideClosed'); } catch (e) { /* ignore */ }
      hideLauncher();
      guide.style.display = 'block';
      gsap.set(guide, { yPercent: 130, opacity: 0 });
      gsap.to(guide, {
        yPercent: 0, opacity: 1, duration: 0.9, ease: 'back.out(1.5)', delay: first ? 0.6 : 0.15,
        onComplete: function () {
          idle.play(); blink(); wave();
          var cur = lastSection && SECTION_TIPS[lastSection] ? lastSection : 'welcome-hero';
          say(first ? SECTION_TIPS['welcome-hero'] : (cur === 'welcome-hero' ? 'I\u2019m back! Scroll down and I\u2019ll show you around.' : 'I\u2019m back! ' + SECTION_TIPS[cur]), false);
        }
      });
    }
    function closeGuide() {
      if (!alive) return;
      alive = false; closed = true;
      try { window.sessionStorage.setItem('guideClosed', '1'); } catch (e) { /* ignore */ }
      if (hideCall) hideCall.kill();
      if (tw) tw.kill();
      if (blinkCall) blinkCall.kill();
      idle.pause();
      gsap.to(guide, { yPercent: 130, opacity: 0, duration: 0.5, ease: 'power3.in', onComplete: function () { guide.style.display = 'none'; showLauncher(); } });
    }

    /* section-aware tips */
    var sts = Object.keys(SECTION_TIPS).map(function (id) {
      var el = document.getElementById(id);
      if (!el) return null;
      return ScrollTrigger.create({
        trigger: el, start: 'top 55%', end: 'bottom 55%',
        onToggle: function (self) {
          if (!self.isActive) return;
          if (started && alive && lastSection !== id) say(SECTION_TIPS[id], lastSection !== null);
          lastSection = id;
        }
      });
    });

    function onDeck(e) {
      if (!alive || !e.detail || e.detail.index == null) return;
      if (Math.random() < 0.35) wave();
    }
    document.addEventListener('deck:change', onDeck);

    function nextTip() {
      if (!alive) return;
      var msg = EXTRA_TIPS[extraIdx % EXTRA_TIPS.length];
      extraIdx++;
      say(msg, true);
    }
    btn.addEventListener('click', nextTip);
    closeBtn.addEventListener('click', closeGuide);
    if (launcher) launcher.addEventListener('click', function () { openGuide(false); });

    /* enter once the page has finished its intro */
    function start() {
      if (started) return;
      started = true;
      if (closed) { showLauncher(); return; }
      lastSection = 'welcome-hero';
      openGuide(true);
    }
    if (window.__portfolioReady) start(); else document.addEventListener('portfolio:ready', start, { once: true });

    return function destroy() {
      alive = false;
      idle.kill();
      sts.forEach(function (s) { if (s) s.kill(); });
      window.removeEventListener('pointermove', look);
      document.removeEventListener('deck:change', onDeck);
      document.removeEventListener('portfolio:ready', start);
      if (hideCall) hideCall.kill();
      if (tw) tw.kill();
      if (blinkCall) blinkCall.kill();
      gsap.killTweensOf([guide, bubble, launcher, floatG, shadow, glow, bulb, eyes, mouth, armR, armL].concat(pupils));
    };
  }

  /* ======================================================================
     4. SIDE DOTS
     ====================================================================== */
  function makeSideNav() {
    var nav = qs('.side-nav');
    if (!nav) return function () {};
    var links = qsa('a', nav), sts = [];
    links.forEach(function (a) {
      var sec = document.getElementById((a.getAttribute('href') || '').slice(1));
      if (!sec) return;
      sts.push(ScrollTrigger.create({
        trigger: sec, start: 'top 50%', end: 'bottom 50%',
        onToggle: function (self) {
          if (self.isActive) links.forEach(function (l) { l.classList.toggle('is-active', l === a); });
        }
      }));
    });
    return function () { sts.forEach(function (s) { s.kill(); }); };
  }

  /* ======================================================================
     5. CURSOR RING
     ====================================================================== */
  function makeCursorRing() {
    var ring = qs('.cursor-ring');
    if (!ring || !finePointer) return function () {};
    var xTo = gsap.quickTo(ring, 'x', { duration: 0.28, ease: 'power3' });
    var yTo = gsap.quickTo(ring, 'y', { duration: 0.28, ease: 'power3' });
    function move(e) {
      ring.classList.add('is-on');
      xTo(e.clientX); yTo(e.clientY);
      var t = e.target;
      var drag = t.closest && t.closest('.deck-active .deck-stage');
      var hov = t.closest && t.closest('a, button, summary, [role="button"], .cert-open');
      ring.classList.toggle('is-drag', !!drag && !hov);
      ring.classList.toggle('is-hover', !!hov && !drag);
    }
    function out() { ring.classList.remove('is-on'); }
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('mouseleave', out);
    return function () {
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('mouseleave', out);
      ring.classList.remove('is-on', 'is-hover', 'is-drag');
    };
  }

  /* ======================================================================
     6. SPLIT HEADINGS   7. ABOUT PHOTO PARALLAX
     ====================================================================== */
  function makeHeadings() {
    var saved = [], sts = [];
    qsa('.section-heading h2').forEach(function (h) {
      var txt = h.textContent.trim();
      saved.push({ el: h, html: h.innerHTML });
      h.setAttribute('aria-label', txt);
      var wrap = document.createElement('span');
      wrap.setAttribute('aria-hidden', 'true');
      var chars = txt.split('').map(function (c) {
        var s = document.createElement('span');
        s.className = 'ch';
        s.textContent = c;
        wrap.appendChild(s);
        return s;
      });
      h.textContent = '';
      h.appendChild(wrap);
      gsap.set(chars, { opacity: 0, yPercent: 90, rotationX: -70, transformOrigin: '50% 100%' });
      sts.push(ScrollTrigger.create({
        trigger: h, start: 'top 90%', once: true,
        onEnter: function () {
          gsap.to(chars, { opacity: 1, yPercent: 0, rotationX: 0, duration: 0.9, stagger: 0.035, ease: 'back.out(1.7)', delay: 0.1 });
        }
      }));
    });
    return function () {
      sts.forEach(function (s) { s.kill(); });
      saved.forEach(function (s) { s.el.innerHTML = s.html; s.el.removeAttribute('aria-label'); });
    };
  }

  function makeParallax() {
    var img = qs('.single-about-img img');
    if (!img) return function () {};
    var t = gsap.fromTo(img, { yPercent: -6, scale: 1.14 }, {
      yPercent: 6, scale: 1.14, ease: 'none',
      scrollTrigger: { trigger: '.single-about-img', start: 'top bottom', end: 'bottom top', scrub: true }
    });
    return function () { if (t.scrollTrigger) t.scrollTrigger.kill(); t.kill(); gsap.set(img, { clearProps: 'transform' }); };
  }

  /* ======================================================================
     Boot
     ====================================================================== */
  var mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', function () {
    var cleanups = [];
    qsa('[data-deck]').forEach(function (d) { cleanups.push(makeDeck(d)); });
    cleanups.push(makeGuide());
    cleanups.push(makeSideNav());
    cleanups.push(makeCursorRing());
    cleanups.push(makeHeadings());
    cleanups.push(makeParallax());
    window.addEventListener('load', function () { ScrollTrigger.refresh(); }, { once: true });
    return function () { cleanups.forEach(function (fn) { fn(); }); };
  });

  mm.add('(prefers-reduced-motion: no-preference) and (min-width: 768px)', function () {
    var destroy = makeStack();
    return destroy;
  });
})();