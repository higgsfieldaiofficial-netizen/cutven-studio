/* Coverflow 3D for Avryx service cards (.cats > .reveal > .cat)
   - Sets --cfx/--cfd per card from scroll position (drives rotate/scale/blur in CSS)
   - Clickable progress dots, visible swipe hint, first-view nudge
   - Respects prefers-reduced-motion
   - FIX 2026-10-08: horizontal-only card centering (wrap.scrollTo) so the page
     is NEVER scrolled vertically; auto-advance runs only while #categories is
     actually in the viewport; interval raised 3s -> 5s.
*/
(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function waitForCards(cb) {
    var done = false, n = 0;
    function tryInit() {
      if (done) return;
      var wrap = document.querySelector('#categories .cats');
      if (wrap && wrap.querySelectorAll('.cat').length >= 2) {
        done = true;
        cb(wrap);
      }
    }
    tryInit();
    var timer = setInterval(function () {
      tryInit();
      if (done || ++n > 120) clearInterval(timer);
    }, 100);
  }

  function init(wrap) {
    var cards = Array.prototype.slice.call(wrap.querySelectorAll('.cat'));

    /* ---- horizontal-only centering: never moves the page vertically ---- */
    function centerCard(i) {
      var wr = wrap.getBoundingClientRect();
      var r = cards[i].getBoundingClientRect();
      var delta = (r.left + r.width / 2) - (wr.left + wr.width / 2);
      wrap.scrollTo({ left: wrap.scrollLeft + delta, behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    /* ---- progress dots ---- */
    var dotsBox = document.createElement('div');
    dotsBox.className = 'cf-dots';
    var dots = cards.map(function (card, i) {
      var d = document.createElement('button');
      d.className = 'cf-dot';
      d.type = 'button';
      d.setAttribute('aria-label', 'Go to card ' + (i + 1));
      d.addEventListener('click', function () { centerCard(i); });
      dotsBox.appendChild(d);
      return d;
    });
    wrap.parentNode.insertBefore(dotsBox, wrap.nextSibling);

    /* ---- swipe hint ---- */
    var hint = document.createElement('div');
    hint.className = 'cf-hint';
    hint.innerHTML = '<span>&larr;</span><span>swipe</span><span>&rarr;</span>';
    wrap.parentNode.insertBefore(hint, wrap);
    var hintGone = false;
    function hideHint() {
      if (hintGone) return;
      hintGone = true;
      hint.style.opacity = '0';
      setTimeout(function () { if (hint.parentNode) hint.parentNode.removeChild(hint); }, 450);
    }
    setTimeout(hideHint, 6000);

    /* ---- coverflow transform vars ---- */
    var ticking = false;
    function update() {
      ticking = false;
      var wr = wrap.getBoundingClientRect();
      var cx = wr.left + wr.width / 2;
      var active = 0, best = Infinity;
      cards.forEach(function (card, i) {
        var r = card.getBoundingClientRect();
        var ccx = r.left + r.width / 2;
        var d = (ccx - cx) / (r.width * 0.9);
        var cd = Math.max(-1, Math.min(1, d));
        var ad = Math.abs(cd);
        card.style.setProperty('--cfx', cd.toFixed(3));
        card.style.setProperty('--cfd', ad.toFixed(3));
        if (ad < best) { best = ad; active = i; }
      });
      dots.forEach(function (d, i) { d.classList.toggle('is-on', i === active); });
    }
    function onScroll() {
      hideHint();
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }
    wrap.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    update();

    /* ---- auto-scroll: next card every 5s, loops; pauses on user input ----
       Only advances while the #categories section is actually visible, so it
       never yanks the page back up when the user has scrolled past it. */
    var autoTimer = null, idleTimer = null, inView = true;
    function currentIndex() {
      var wr = wrap.getBoundingClientRect();
      var cx = wr.left + wr.width / 2;
      var best = 0, bestD = Infinity;
      cards.forEach(function (card, i) {
        var r = card.getBoundingClientRect();
        var d = Math.abs((r.left + r.width / 2) - cx);
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    }
    function goTo(i) { centerCard(i); }
    function startAuto() {
      if (reduceMotion || autoTimer) return;
      autoTimer = setInterval(function () {
        if (inView) goTo((currentIndex() + 1) % cards.length);
      }, 5000);
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    }
    function pauseForIdle() {
      stopAuto();
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(startAuto, 6000);
    }
    if ('IntersectionObserver' in window) {
      var sec = document.getElementById('categories');
      if (sec) {
        new IntersectionObserver(function (entries) {
          inView = entries[0].isIntersecting;
        }, { threshold: 0.15 }).observe(sec);
      }
    }
    wrap.addEventListener('pointerdown', pauseForIdle, { passive: true });
    wrap.addEventListener('wheel', pauseForIdle, { passive: true });
    wrap.addEventListener('touchstart', pauseForIdle, { passive: true });
    dots.forEach(function (d) { d.addEventListener('click', pauseForIdle); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopAuto(); else pauseForIdle();
    });
    startAuto();

    /* ---- first-view nudge: proves the row scrolls ---- */
    if (!reduceMotion && 'IntersectionObserver' in window) {
      var seen = false;
      var io = new IntersectionObserver(function (entries) {
        if (seen || !entries[0].isIntersecting) return;
        seen = true;
        io.disconnect();
        setTimeout(function () {
          var x0 = wrap.scrollLeft;
          if (wrap.scrollWidth <= wrap.clientWidth + 4) return; // not scrollable
          wrap.scrollTo({ left: x0 + 60, behavior: 'smooth' });
          setTimeout(function () { wrap.scrollTo({ left: x0, behavior: 'smooth' }); }, 650);
        }, 600);
      }, { threshold: 0.4 });
      io.observe(wrap);
    }
  }

  waitForCards(init);
})();



/* FIX 2026-10-08 (3): restore 3D coverflow styles lost in the CSS rebuild.    Injects the --cfx/--cfd transform rules + dots/hint styling. */ (function () {   var css = [     '#categories .cats{perspective:1400px;}',     '#categories .cats .cat{--cfx:0;--cfd:0;',     'transform:rotateY(calc(var(--cfx) * -28deg)) scale(calc(1 - var(--cfd) * 0.14));',     'filter:blur(calc(var(--cfd) * 2.5px)) brightness(calc(1 - var(--cfd) * 0.25));',     'transition:transform .35s ease,filter .35s ease;will-change:transform,filter;}',     '.cf-dots{display:flex;gap:8px;justify-content:center;margin-top:16px;}',     '.cf-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.25);border:none;padding:0;cursor:pointer;}',     '.cf-dot.is-on{background:#ff2222;}',     '.cf-hint{text-align:center;color:rgba(255,255,255,.5);font-size:12px;letter-spacing:2px;margin-bottom:8px;transition:opacity .4s;}'   ].join('\n');   var st = document.createElement('style');   st.id = 'cf-3d-restore';   st.textContent = css;   document.head.appendChild(st); })();
