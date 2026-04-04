/* ============================================
   COMPONENTS.JS — FAQ Accordion, Filters, Lightbox, Carousel
   ============================================ */

(function() {
  'use strict';

  // ---- FAQ Accordion ----
  function initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');
    if (!faqItems.length) return;

    faqItems.forEach(item => {
      const question = item.querySelector('.faq-item__question');
      if (!question) return;

      question.addEventListener('click', () => {
        const isActive = item.classList.contains('faq-item--active');

        // Close all others
        faqItems.forEach(other => {
          if (other !== item) {
            other.classList.remove('faq-item--active');
          }
        });

        // Toggle current
        item.classList.toggle('faq-item--active', !isActive);
      });
    });
  }

  // ---- Filter Tabs ----
  function initFilterTabs() {
    const filterBtns = document.querySelectorAll('[data-filter-btn]');
    const filterItems = document.querySelectorAll('[data-filter-category]');
    if (!filterBtns.length || !filterItems.length) return;

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const category = btn.dataset.filterBtn;

        // Update active button
        filterBtns.forEach(b => b.classList.remove('btn--primary'));
        btn.classList.add('btn--primary');

        // Filter items
        filterItems.forEach(item => {
          if (category === 'all' || item.dataset.filterCategory === category) {
            item.style.display = '';
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            requestAnimationFrame(() => {
              item.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
              item.style.opacity = '1';
              item.style.transform = 'translateY(0)';
            });
          } else {
            item.style.display = 'none';
          }
        });
      });
    });
  }

  // ---- Lightbox ----
  function initLightbox() {
    const lightboxTriggers = document.querySelectorAll('[data-lightbox]');
    if (!lightboxTriggers.length) return;

    // Create lightbox overlay
    const overlay = document.createElement('div');
    overlay.className = 'lightbox';
    overlay.innerHTML = '<img src="" alt="">';
    document.body.appendChild(overlay);

    const lightboxImg = overlay.querySelector('img');

    lightboxTriggers.forEach(trigger => {
      trigger.addEventListener('click', () => {
        const src = trigger.dataset.lightbox || trigger.src || trigger.querySelector('img')?.src;
        if (!src) return;
        lightboxImg.src = src;
        lightboxImg.alt = trigger.alt || '';
        overlay.classList.add('lightbox--open');
        document.body.style.overflow = 'hidden';
      });
    });

    overlay.addEventListener('click', () => {
      overlay.classList.remove('lightbox--open');
      document.body.style.overflow = '';
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('lightbox--open')) {
        overlay.classList.remove('lightbox--open');
        document.body.style.overflow = '';
      }
    });
  }

  // ---- Counter Animation ----
  function initCounters() {
    const counters = document.querySelectorAll('.counter');
    if (!counters.length) return;

    const animateCounter = (el) => {
      const target = parseInt(el.dataset.target || el.textContent, 10);
      if (isNaN(target)) return;

      const duration = 2000;
      const start = performance.now();

      function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased);
        if (progress < 1) requestAnimationFrame(update);
        else el.textContent = target;
      }
      requestAnimationFrame(update);
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(c => observer.observe(c));
  }

  // ---- Carousel / Testimonials ----
  function initCarousel() {
    const carousel = document.querySelector('[data-carousel]');
    if (!carousel) return;

    const track = carousel.querySelector('[data-carousel-track]');
    const slides = carousel.querySelectorAll('[data-carousel-slide]');
    const prevBtn = carousel.querySelector('[data-carousel-prev]');
    const nextBtn = carousel.querySelector('[data-carousel-next]');
    const dots = carousel.querySelector('[data-carousel-dots]');

    if (!track || !slides.length) return;

    let current = 0;
    const total = slides.length;

    // Create dots
    if (dots) {
      slides.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = `carousel-dot${i === 0 ? ' carousel-dot--active' : ''}`;
        dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
        dot.addEventListener('click', () => goTo(i));
        dots.appendChild(dot);
      });
    }

    function goTo(index) {
      current = ((index % total) + total) % total;
      track.style.transform = `translateX(-${current * 100}%)`;

      if (dots) {
        dots.querySelectorAll('.carousel-dot').forEach((d, i) => {
          d.classList.toggle('carousel-dot--active', i === current);
        });
      }
    }

    if (prevBtn) prevBtn.addEventListener('click', () => goTo(current - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => goTo(current + 1));

    // Auto-advance
    let autoTimer = setInterval(() => goTo(current + 1), 5000);
    carousel.addEventListener('mouseenter', () => clearInterval(autoTimer));
    carousel.addEventListener('mouseleave', () => {
      autoTimer = setInterval(() => goTo(current + 1), 5000);
    });
  }

  // ---- Contact Form Handler ----
  function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const action = form.action;
      const successEl = document.getElementById('formSuccess');
      const errorEl = document.getElementById('formError');

      // If no action URL, show success (demo mode)
      if (!action) {
        if (successEl) { successEl.style.display = 'block'; }
        form.style.display = 'none';
        return;
      }

      try {
        const response = await fetch(action, {
          method: 'POST',
          body: formData,
          headers: { 'Accept': 'application/json' }
        });
        if (response.ok) {
          if (successEl) successEl.style.display = 'block';
          form.style.display = 'none';
        } else {
          throw new Error('Submission failed');
        }
      } catch (err) {
        if (errorEl) errorEl.style.display = 'block';
        console.error('Form submission error:', err);
      }
    });
  }

  // ---- Toast Notifications ----
  window.showToast = function(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('toast--visible');
    });

    setTimeout(() => {
      toast.classList.remove('toast--visible');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  // ---- Init All ----
  document.addEventListener('DOMContentLoaded', () => {
    initFaqAccordion();
    initFilterTabs();
    initLightbox();
    initCounters();
    initCarousel();
    initContactForm();
  });

})();
