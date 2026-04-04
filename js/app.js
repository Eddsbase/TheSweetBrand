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
    // Bail on touch devices
    const isTouch =
      'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouch) return;

    const dot = document.querySelector('.cursor__dot');
    const circle = document.querySelector('.cursor__circle');
    if (!dot || !circle) return;

    // State
    const mouse = { x: 0, y: 0 };
    const pos = { x: 0, y: 0 };       // circle lerp position
    const LERP = 0.15;

    // Sizes
    const DOT_DEFAULT = 8;
    const CIRCLE_DEFAULT = 40;
    const CIRCLE_HOVER = 60;
    const CIRCLE_TEXT = 80;

    let currentCircleSize = CIRCLE_DEFAULT;
    let targetCircleSize = CIRCLE_DEFAULT;
    let dotScale = 1;
    let targetDotScale = 1;
    let isHovering = false;
    let scrollTimer = null;

    // Track mouse
    document.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    // Hover targets
    const interactiveSelector =
      'a, button, [data-cursor], input[type="submit"], .btn';
    const textSelector = 'h1, h2, h3, h4, h5, h6';

    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest(interactiveSelector);
      const textTarget = e.target.closest(textSelector);

      if (target) {
        targetCircleSize = CIRCLE_HOVER;
        targetDotScale = 0;
        circle.classList.add('cursor__circle--active');
        isHovering = true;
      } else if (textTarget) {
        targetCircleSize = CIRCLE_TEXT;
        targetDotScale = 0;
        circle.classList.add('cursor__circle--text');
        isHovering = true;
      }
    });

    document.addEventListener('mouseout', (e) => {
      const target = e.target.closest(interactiveSelector);
      const textTarget = e.target.closest(textSelector);

      if (target || textTarget) {
        targetCircleSize = CIRCLE_DEFAULT;
        targetDotScale = 1;
        circle.classList.remove('cursor__circle--active', 'cursor__circle--text');
        isHovering = false;
      }
    });

    // Hide during scroll
    window.addEventListener(
      'scroll',
      () => {
        dot.style.opacity = '0';
        circle.style.opacity = '0';
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
          dot.style.opacity = '1';
          circle.style.opacity = '1';
        }, 150);
      },
      { passive: true }
    );

    // Magnetic effect
    const magneticEls = document.querySelectorAll('.magnetic');
    const MAGNETIC_RADIUS = 100;

    const applyMagnetic = () => {
      magneticEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = mouse.x - cx;
        const dy = mouse.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < MAGNETIC_RADIUS) {
          const pull = (MAGNETIC_RADIUS - dist) / MAGNETIC_RADIUS;
          el.style.transform = `translate(${dx * pull * 0.3}px, ${dy * pull * 0.3}px)`;
        } else {
          el.style.transform = '';
        }
      });
    };

    // Animation loop
    const lerp = (a, b, t) => a + (b - a) * t;

    const tick = () => {
      pos.x = lerp(pos.x, mouse.x, LERP);
      pos.y = lerp(pos.y, mouse.y, LERP);

      currentCircleSize = lerp(currentCircleSize, targetCircleSize, LERP);
      dotScale = lerp(dotScale, targetDotScale, LERP);

      dot.style.transform = `translate(${mouse.x - DOT_DEFAULT / 2}px, ${mouse.y - DOT_DEFAULT / 2}px) scale(${dotScale})`;
      circle.style.transform = `translate(${pos.x - currentCircleSize / 2}px, ${pos.y - currentCircleSize / 2}px)`;
      circle.style.width = `${currentCircleSize}px`;
      circle.style.height = `${currentCircleSize}px`;

      applyMagnetic();
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
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
