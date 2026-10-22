/* ==========================================================================
   motion.js  -  Step 2 of the portfolio upgrade
   Needs: GSAP 3 + ScrollTrigger (loaded from cdnjs in index.html) and the
   .motion-ready flag set by the small inline script in <head>.

   What it does
   1. Hero intro (staggered) + gentle scroll-linked parallax
   2. Scroll reveals for every [data-reveal] element, batched and staggered
   3. Skill percentages count up in sync with the existing bar animation
   4. Magnetic hover on the hero button (mouse devices only)
   5. Scroll-progress bar fallback for browsers without CSS scroll timelines

   Safety
   - If GSAP fails to load, reduced motion is on, or the head failsafe fired,
     the script exits and every element stays visible.
   - Only opacity and transforms are animated, so there is no layout thrash.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var ready = window.gsap && window.ScrollTrigger && root.classList.contains('motion-ready');

  if (!ready) {
    root.classList.remove('motion-ready');
    return;
  }

  window.__motionBooted = true; // tells the head failsafe not to un-hide anything
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  var heroStarted = false;

  function qsa(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector));
  }

  /* Used when motion is switched off at runtime: show everything as-is. */
  function revealAll() {
    root.classList.remove('motion-ready');
    qsa('[data-reveal]').forEach(function (el) {
      el.removeAttribute('data-reveal');
    });
  }

  /* ---------- 1. Hero ---------------------------------------------------- */
  function heroIntro() {
    if (heroStarted) return;
    var items = qsa('.header-text [data-reveal="hero"]');
    if (!items.length) return;

    var start = function () {
      if (heroStarted) return;
      heroStarted = true;
      gsap.fromTo(
        items,
        { opacity: 0, y: 42 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: 'power3.out',
          stagger: 0.14,
          delay: 0.05,
          onComplete: function () {
            items.forEach(function (el) {
              el.removeAttribute('data-reveal');
              gsap.set(el, { clearProps: 'opacity,transform' });
            });
          }
        }
      );
    };

    // Wait for the banner image, but never longer than 1.5s.
    if (document.readyState === 'complete') {
      start();
    } else {
      window.addEventListener('load', start, { once: true });
      window.setTimeout(start, 1500);
    }
  }

  function heroParallax() {
    if (!document.querySelector('#welcome-hero .header-text')) return;
    gsap.to('#welcome-hero .header-text', {
      yPercent: 18,
      opacity: 0.15,
      ease: 'none',
      scrollTrigger: {
        trigger: '#welcome-hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true
      }
    });
  }

  /* ---------- 2. Scroll reveals ----------------------------------------- */
  var FROM = {
    up: { x: 0, y: 36, s: 1 },
    left: { x: -48, y: 0, s: 1 },
    right: { x: 48, y: 0, s: 1 },
    scale: { x: 0, y: 24, s: 0.94 }
  };

  function fromFor(el) {
    var f = FROM[el.getAttribute('data-reveal')] || FROM.up;
    // On narrow screens, slide up instead of sideways to avoid horizontal overflow.
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
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.1,
        onComplete: function () {
          batch.forEach(function (el) {
            el.removeAttribute('data-reveal');
            // clear only what GSAP set; the page uses other inline styles
            gsap.set(el, { clearProps: 'opacity,transform' });
          });
        }
      }
    );
  }

  function scrollReveals() {
    ScrollTrigger.batch('[data-reveal]:not([data-reveal="hero"])', {
      start: 'top 88%',
      once: true,
      interval: 0.1,
      onEnter: revealBatch
    });
  }

  /* ---------- 3. Skill counters ----------------------------------------- */
  function skillCounters(cleanups) {
    qsa('.single-progress-txt h3').forEach(function (el) {
      var original = el.textContent;
      var target = parseInt(original, 10);
      if (isNaN(target)) return;

      var state = { v: 0 };
      var tween = null;
      el.textContent = '0%';

      var st = ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
        once: true,
        onEnter: function () {
          // 1.5s matches the existing bar width transition in style.css
          tween = gsap.to(state, {
            v: target,
            duration: 1.5,
            ease: 'power2.out',
            onUpdate: function () { el.textContent = Math.round(state.v) + '%'; },
            onComplete: function () { el.textContent = original; }
          });
        }
      });

      cleanups.push(function () {
        st.kill();
        if (tween) tween.kill();
        el.textContent = original;
      });
    });
  }

  /* ---------- 4. Magnetic hero button ------------------------------------ */
  function magneticCta(cleanups) {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var btn = document.querySelector('.header-text a');
    if (!btn) return;

    var xTo = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3' });
    var yTo = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3' });
    var rect = null;

    function enter() { rect = btn.getBoundingClientRect(); } // one read, not one per move
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
  }

  /* ---------- 5. Progress bar fallback ----------------------------------- */
  function progressFallback(cleanups) {
    var native = window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()');
    if (native) return; // motion.css already draws it

    var bar = document.createElement('div');
    bar.setAttribute('aria-hidden', 'true');
    bar.style.cssText =
      'position:fixed;top:0;left:0;right:0;height:3px;z-index:10000;' +
      'pointer-events:none;transform-origin:0 50%;' +
      'background:linear-gradient(90deg,#0060c7,#007bff,#6cc3ff)';
    document.body.appendChild(bar);

    var tween = gsap.fromTo(
      bar,
      { scaleX: 0 },
      { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } }
    );

    cleanups.push(function () {
      tween.kill();
      bar.remove();
    });
  }

  /* ---------- Boot: only when the user has not asked for reduced motion -- */
  var mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', function () {
    var cleanups = [];

    heroIntro();
    heroParallax();
    scrollReveals();
    skillCounters(cleanups);
    magneticCta(cleanups);
    progressFallback(cleanups);

    // Web fonts can change layout height; re-measure trigger positions once.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }

    // Runs if the user switches reduced motion ON while the page is open.
    return function () {
      cleanups.forEach(function (fn) { fn(); });
      revealAll();
    };
  });
})();