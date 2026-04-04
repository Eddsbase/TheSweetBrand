/* ==========================================================================
   The Sweet Brand - Core UI (app.js)
   Vanilla ES6+ | No dependencies
   ========================================================================== */

(function () {
  'use strict';

  /* -----------------------------------------------------------------------
     1. CUSTOM CURSOR
     ----------------------------------------------------------------------- */
  const initCursor = () => {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouch) return;

    const cursor = document.getElementById('cursor');
    const cursorDot = document.getElementById('cursorDot');
    if (!cursor || !cursorDot) return;

    let mouseX = 0, mouseY = 0;
    let ringX = 0, ringY = 0;
    let dotX = 0, dotY = 0;
    const RING_LERP = 0.12;
    const DOT_LERP = 0.35;

    // Trail particles
    const TRAIL_COUNT = 8;
    const trails = [];
    for (let i = 0; i < TRAIL_COUNT; i++) {
      const t = document.createElement('div');
      t.className = 'cursor-trail';
      const size = 6 + (TRAIL_COUNT - i) * 1.5;
      t.style.width = size + 'px';
      t.style.height = size + 'px';
      t.style.opacity = (0.35 - i * 0.04).toString();
      document.body.appendChild(t);
      trails.push({ el: t, x: 0, y: 0 });
    }

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }, { passive: true });

    // Hover detection
    const interactive = 'a, button, [data-cursor], input[type="submit"], .btn, .card, .faq-item__question';
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(interactive)) cursor.classList.add('cursor--hover');
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(interactive)) cursor.classList.remove('cursor--hover');
    });

    // Magnetic effect on .magnetic elements
    const magneticEls = document.querySelectorAll('.magnetic');
    function applyMagnetic() {
      magneticEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = mouseX - cx;
        const dy = mouseY - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          const pull = (100 - dist) / 100;
          el.style.transform = 'translate(' + (dx * pull * 0.25) + 'px,' + (dy * pull * 0.25) + 'px)';
        } else {
          el.style.transform = '';
        }
      });
    }

    // Animation loop
    function animate() {
      // Ring follows with smooth lerp
      ringX += (mouseX - ringX) * RING_LERP;
      ringY += (mouseY - ringY) * RING_LERP;
      cursor.style.left = ringX + 'px';
      cursor.style.top = ringY + 'px';

      // Dot follows faster (closer to instant)
      dotX += (mouseX - dotX) * DOT_LERP;
      dotY += (mouseY - dotY) * DOT_LERP;
      cursorDot.style.left = dotX + 'px';
      cursorDot.style.top = dotY + 'px';

      // Trail particles — each follows the one before it
      for (let i = 0; i < trails.length; i++) {
        const target = i === 0 ? { x: ringX, y: ringY } : trails[i - 1];
        const t = trails[i];
        t.x += (target.x - t.x) * (0.2 - i * 0.015);
        t.y += (target.y - t.y) * (0.2 - i * 0.015);
        t.el.style.left = t.x + 'px';
        t.el.style.top = t.y + 'px';
      }

      applyMagnetic();
      requestAnimationFrame(animate);
    }
    animate();
  };

  /* -----------------------------------------------------------------------
     2. NAVIGATION SCROLL BEHAVIOR
     ----------------------------------------------------------------------- */
  const initNavScroll = () => {
    const nav = document.getElementById('nav');
    if (!nav) return;

    const THRESHOLD = 50;

    window.addEventListener(
      'scroll',
      () => {
        if (window.scrollY > THRESHOLD) {
          nav.classList.add('nav--scrolled');
        } else {
          nav.classList.remove('nav--scrolled');
        }
      },
      { passive: true }
    );
  };

  /* -----------------------------------------------------------------------
     3. MOBILE MENU TOGGLE
     ----------------------------------------------------------------------- */
  const initMobileMenu = () => {
    const toggle = document.getElementById('navToggle');
    const mobile = document.getElementById('navMobile');
    if (!toggle || !mobile) return;

    const open = () => {
      toggle.classList.add('nav__toggle--active');
      mobile.classList.add('nav__mobile--open');
      document.body.style.overflow = 'hidden';
    };

    const close = () => {
      toggle.classList.remove('nav__toggle--active');
      mobile.classList.remove('nav__mobile--open');
      document.body.style.overflow = '';
    };

    toggle.addEventListener('click', () => {
      const isOpen = mobile.classList.contains('nav__mobile--open');
      isOpen ? close() : open();
    });

    // Close on link click
    mobile.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', close);
    });
  };

  /* -----------------------------------------------------------------------
     4. SMOOTH SCROLL FOR ANCHOR LINKS
     ----------------------------------------------------------------------- */
  const initSmoothScroll = () => {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        const id = anchor.getAttribute('href');
        if (id === '#' || id === '#!') return;

        const target = document.querySelector(id);
        if (!target) return;

        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  };

  /* -----------------------------------------------------------------------
     5. BACK TO TOP BUTTON
     ----------------------------------------------------------------------- */
  const initBackToTop = () => {
    const btn = document.querySelector('.back-to-top');
    if (!btn) return;

    const SHOW_AT = 500;

    window.addEventListener(
      'scroll',
      () => {
        if (window.scrollY > SHOW_AT) {
          btn.classList.add('back-to-top--visible');
        } else {
          btn.classList.remove('back-to-top--visible');
        }
      },
      { passive: true }
    );

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  /* -----------------------------------------------------------------------
     6. SCROLL PROGRESS BAR
     ----------------------------------------------------------------------- */
  const initScrollProgress = () => {
    const bar = document.getElementById('scrollProgress');
    if (!bar) return;

    const update = () => {
      const scrollTop = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      bar.style.width = `${pct}%`;
    };

    window.addEventListener('scroll', update, { passive: true });
    update();
  };

  /* -----------------------------------------------------------------------
     7. PAGE LOADER
     ----------------------------------------------------------------------- */
  const initLoader = () => {
    const loader = document.getElementById('loader');
    if (!loader) return;

    window.addEventListener('load', () => {
      setTimeout(() => {
        loader.classList.add('loader--hidden');
      }, 300);
    });
  };

  /* -----------------------------------------------------------------------
     8. CURRENT YEAR
     ----------------------------------------------------------------------- */
  const initYear = () => {
    const el = document.getElementById('currentYear');
    if (el) el.textContent = new Date().getFullYear();
  };

  /* -----------------------------------------------------------------------
     BOOT
     ----------------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    initCursor();
    initNavScroll();
    initMobileMenu();
    initSmoothScroll();
    initBackToTop();
    initScrollProgress();
    initLoader();
    initYear();
  });
})();
