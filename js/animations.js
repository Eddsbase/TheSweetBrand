/* ============================================
   ANIMATIONS.JS — Scroll Reveal + Parallax
   ============================================ */

(function() {
  'use strict';

  // ---- Scroll Reveal (IntersectionObserver) ----
  function initScrollReveal() {
    const revealElements = document.querySelectorAll('[data-reveal]');
    const staggerElements = document.querySelectorAll('[data-reveal-stagger]');

    if (!revealElements.length && !staggerElements.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(el => observer.observe(el));
    staggerElements.forEach(el => observer.observe(el));
  }

  // ---- Parallax Effect ----
  function initParallax() {
    const parallaxElements = document.querySelectorAll('[data-parallax]');
    if (!parallaxElements.length) return;

    let ticking = false;

    function updateParallax() {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;

      parallaxElements.forEach(el => {
        const speed = parseFloat(el.dataset.parallax) || 0.1;
        const rect = el.getBoundingClientRect();
        const elementCenter = rect.top + rect.height / 2;
        const distanceFromCenter = elementCenter - windowHeight / 2;

        // Only apply parallax when element is in or near viewport
        if (rect.bottom > -200 && rect.top < windowHeight + 200) {
          const offset = distanceFromCenter * speed;
          el.style.transform = `translateY(${offset}px)`;
        }
      });

      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }, { passive: true });

    // Initial run
    updateParallax();
  }

  // ---- Image Reveal Animation ----
  function initImageReveal() {
    const imageReveals = document.querySelectorAll('.image-reveal');
    if (!imageReveals.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    imageReveals.forEach(el => observer.observe(el));
  }

  // ---- Text Reveal Animation ----
  function initTextReveal() {
    const textReveals = document.querySelectorAll('.text-reveal');
    if (!textReveals.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    textReveals.forEach(el => observer.observe(el));
  }

  // ---- Smooth Number Counting ----
  function initNumberAnimation() {
    const numbers = document.querySelectorAll('[data-count]');
    if (!numbers.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.dataset.count, 10);
          const suffix = el.dataset.countSuffix || '';
          const duration = 2000;
          const start = performance.now();

          function animate(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(target * eased) + suffix;
            if (progress < 1) requestAnimationFrame(animate);
          }
          requestAnimationFrame(animate);
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    numbers.forEach(el => observer.observe(el));
  }

  // ---- Tilt Effect on Cards ----
  function initTiltEffect() {
    const cards = document.querySelectorAll('.card');
    if (!cards.length) return;

    // Only on non-touch devices
    if (window.matchMedia('(hover: none)').matches) return;

    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / centerY * -3;
        const rotateY = (x - centerX) / centerX * 3;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        card.style.transition = 'transform 0.5s ease';
        setTimeout(() => { card.style.transition = ''; }, 500);
      });
    });
  }

  // ---- Marquee Pause on Hover ----
  function initMarqueePause() {
    const marquees = document.querySelectorAll('.marquee');
    marquees.forEach(marquee => {
      const track = marquee.querySelector('.marquee__track');
      if (!track) return;

      marquee.addEventListener('mouseenter', () => {
        track.style.animationPlayState = 'paused';
      });
      marquee.addEventListener('mouseleave', () => {
        track.style.animationPlayState = 'running';
      });
    });
  }

  // ---- Gradient Glow Follow Mouse ----
  function initGlowFollow() {
    const glows = document.querySelectorAll('.hero__bg-glow, .page-hero__bg-glow, .cta-section__glow');
    if (!glows.length) return;
    if (window.matchMedia('(hover: none)').matches) return;

    document.addEventListener('mousemove', (e) => {
      const x = e.clientX;
      const y = e.clientY;

      glows.forEach(glow => {
        const rect = glow.parentElement.getBoundingClientRect();
        const relX = x - rect.left;
        const relY = y - rect.top;

        if (relX >= -200 && relX <= rect.width + 200 && relY >= -200 && relY <= rect.height + 200) {
          glow.style.left = relX + 'px';
          glow.style.top = relY + 'px';
          glow.style.transform = 'translate(-50%, -50%)';
        }
      });
    }, { passive: true });
  }

  // ---- Init All ----
  document.addEventListener('DOMContentLoaded', () => {
    initScrollReveal();
    initParallax();
    initImageReveal();
    initTextReveal();
    initNumberAnimation();
    initTiltEffect();
    initMarqueePause();
    initGlowFollow();
  });

})();
