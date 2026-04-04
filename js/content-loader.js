/* ==========================================================================
   content-loader.js — CMS Engine
   Reads content.json and injects content into the DOM for every page.
   Vanilla ES6+ — zero dependencies.
   ========================================================================== */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  /** Escape HTML to prevent XSS when inserting user-supplied text as HTML */
  function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  /** Safely set textContent on the first element matching a selector */
  function setText(selector, value, root) {
    if (value == null) return;
    const el = (root || document).querySelector(selector);
    if (el) el.textContent = value;
  }

  /** Safely set innerHTML — use ONLY for trusted/rich content like blog body */
  function setHTML(selector, value, root) {
    if (value == null) return;
    const el = (root || document).querySelector(selector);
    if (el) el.innerHTML = value;
  }

  /** Set an attribute on the first matching element */
  function setAttr(selector, attr, value, root) {
    if (value == null) return;
    const el = (root || document).querySelector(selector);
    if (el) el.setAttribute(attr, value);
  }

  /** Set href + text on a link element */
  function setLink(selector, href, text, root) {
    const el = (root || document).querySelector(selector);
    if (!el) return;
    if (href != null) el.setAttribute('href', href);
    if (text != null) {
      // If the link wraps a <span>, set the span's text; otherwise set the link text
      const span = el.querySelector('span');
      if (span) { span.textContent = text; } else { el.textContent = text; }
    }
  }

  /** Set image src + alt */
  function setImage(selector, src, alt, root) {
    const el = (root || document).querySelector(selector);
    if (!el) return;
    if (src != null) el.src = src;
    if (alt != null) el.alt = alt;
  }

  /** Read a URL search parameter */
  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  /** Detect the current page key from the URL pathname */
  function detectPage() {
    let path = window.location.pathname;
    // Strip trailing slash, strip leading path segments (GitHub Pages sub-path)
    let file = path.split('/').pop() || 'index.html';
    // Remove .html extension for matching
    return file.replace('.html', '') || 'index';
  }

  /** Safe deep property access */
  function get(obj, path, fallback) {
    if (!obj) return fallback;
    const keys = path.split('.');
    let cur = obj;
    for (const k of keys) {
      if (cur == null || typeof cur !== 'object') return fallback;
      cur = cur[k];
    }
    return cur !== undefined ? cur : fallback;
  }

  // ---------------------------------------------------------------------------
  // Core: Load Content
  // ---------------------------------------------------------------------------

  async function loadContent() {
    let data;

    // Dev mode: server.js injects window.__SITE_CONTENT__
    if (window.__SITE_CONTENT__) {
      data = window.__SITE_CONTENT__;
    } else {
      // Production: fetch content.json relative to site root
      try {
        // Determine base path (handles GitHub Pages sub-paths)
        const scripts = document.querySelectorAll('script[src*="content-loader"]');
        let basePath = '';
        if (scripts.length) {
          const src = scripts[0].getAttribute('src');
          basePath = src.replace(/js\/content-loader\.js.*$/, '');
        }
        const resp = await fetch(basePath + 'content.json');
        if (!resp.ok) throw new Error('content.json not found (' + resp.status + ')');
        data = await resp.json();
      } catch (err) {
        console.warn('[content-loader] Could not load content.json:', err.message);
        applyFooterYear();
        return;
      }
    }

    const page = detectPage();

    try { applyGlobal(data); } catch (e) { console.warn('[content-loader] applyGlobal error:', e); }
    try { applyPageContent(data, page); } catch (e) { console.warn('[content-loader] applyPageContent error:', e); }
    try { applySectionVisibility(data); } catch (e) { console.warn('[content-loader] applySectionVisibility error:', e); }
    try { applyPerPageSEO(data, page); } catch (e) { console.warn('[content-loader] applyPerPageSEO error:', e); }
    try { applyCustomCode(data); } catch (e) { console.warn('[content-loader] applyCustomCode error:', e); }
    try { applyIntegrations(data); } catch (e) { console.warn('[content-loader] applyIntegrations error:', e); }
  }

  // ---------------------------------------------------------------------------
  // 1. applyGlobal — logo, nav, footer, base meta (ALL pages)
  // ---------------------------------------------------------------------------

  function applyGlobal(data) {
    const site = data.site || {};
    const footer = data.footer || {};
    const contact = data.contact || {};

    // --- Logo ---
    if (site.logoImage) {
      document.querySelectorAll('.site-logo').forEach(img => {
        img.src = site.logoImage;
        if (site.title) img.alt = site.title;
      });
    }

    // --- Favicon ---
    if (site.favicon) {
      const link = document.querySelector('link[rel="icon"]');
      if (link) link.href = site.favicon;
    }

    // --- Nav CTA ---
    if (site.navCta || site.navCtaLink) {
      document.querySelectorAll('.nav-cta-link').forEach(el => {
        if (site.navCtaLink) el.href = site.navCtaLink;
        if (site.navCta) {
          const span = el.querySelector('.nav-cta-text');
          if (span) span.textContent = site.navCta;
          else el.textContent = site.navCta;
        }
      });
    }

    // --- Nav Links ---
    if (Array.isArray(site.navLinks)) {
      document.querySelectorAll('.nav__links, .nav__mobile').forEach(container => {
        const links = container.querySelectorAll('.nav-link, .nav__link:not(.nav-cta-link)');
        links.forEach((link, i) => {
          const item = site.navLinks[i];
          if (!item) return;
          if (item.label) link.textContent = item.label;
          if (item.href) link.href = item.href;
          if (item.visible === false) link.style.display = 'none';
        });
      });
    }

    // --- Footer ---
    applyFooterYear();

    if (footer.brandDesc) {
      setText('.footer-description', footer.brandDesc);
    }

    if (footer.email || contact.email) {
      const email = footer.email || contact.email;
      document.querySelectorAll('.footer-email').forEach(el => {
        el.textContent = email;
        el.href = 'mailto:' + email;
      });
    }

    if (footer.copyright) {
      setText('.footer-copyright-text', footer.copyright);
    }

    if (Array.isArray(footer.quickLinks) && footer.quickLinks.length) {
      const group = document.querySelector('.footer__links-group');
      if (group) {
        const existingLinks = group.querySelectorAll('a.footer-link, a:not(h4)');
        // Only rebuild if we have content
        if (footer.quickLinks.length) {
          existingLinks.forEach((a, i) => {
            const item = footer.quickLinks[i];
            if (!item) return;
            if (item.label) a.textContent = item.label;
            if (item.href) a.href = item.href;
          });
        }
      }
    }

    // --- Site-level meta (fallback — per-page SEO overrides these) ---
    if (site.title) setAttr('.meta-title', 'content', site.title);
    if (site.description) setAttr('.meta-description', 'content', site.description);
    if (site.ogTitle) setAttr('.og-title', 'content', site.ogTitle);
    if (site.ogDescription) setAttr('.og-description', 'content', site.ogDescription);
    if (site.ogImage) setAttr('.og-image', 'content', site.ogImage);

    // --- CTA section (shared across many pages) ---
    const cta = data.cta || {};
    if (cta.title) setText('.cta-title', cta.title);
    if (cta.ctaPrimary) setLink('.cta-btn1-link', cta.ctaPrimaryLink, cta.ctaPrimary);
    if (cta.ctaSecondary) setLink('.cta-btn2-link', cta.ctaSecondaryLink, cta.ctaSecondary);

    // --- Contact form action ---
    if (contact.formAction) {
      const form = document.querySelector('#contactForm');
      if (form) form.action = contact.formAction;
    }

    // --- Contact email on contact page ---
    if (contact.email) {
      document.querySelectorAll('.contact-email').forEach(el => {
        el.textContent = contact.email;
        el.href = 'mailto:' + contact.email;
      });
    }
  }

  function applyFooterYear() {
    const el = document.getElementById('currentYear');
    if (el) el.textContent = new Date().getFullYear();
  }

  // ---------------------------------------------------------------------------
  // 2. applyPageContent — page-specific injection
  // ---------------------------------------------------------------------------

  function applyPageContent(data, page) {
    switch (page) {
      case 'index':       applyHome(data); break;
      case 'about':       applyAbout(data); break;
      case 'contact':     applyContact(data); break;
      case 'services':    applyServicesPage(data); break;
      case 'service-single': applyServiceSingle(data); break;
      case 'work':        applyWorkPage(data); break;
      case 'work-single': applyWorkSingle(data); break;
      case 'blog':        applyBlogPage(data); break;
      case 'blog-single': applyBlogSingle(data); break;
      default: break;
    }
  }

  // ----- HOME (index.html) ----- //

  function applyHome(data) {
    const hero = data.hero || {};
    const services = data.services || {};
    const marquee = data.marquee || {};

    // Hero
    if (hero.tag) setText('.hero-tag', hero.tag);
    if (hero.titleLine1) setText('.hero-title-line1', hero.titleLine1);
    if (hero.titleAccent || hero.titleLine2) setText('.hero-title-line2', hero.titleAccent || hero.titleLine2);
    if (hero.titleLine3) setText('.hero-subtitle', hero.titleLine3);
    if (hero.description) setText('.hero-description', hero.description);
    if (hero.ctaPrimary) setLink('.hero-cta1-link', hero.ctaPrimaryLink, hero.ctaPrimary);
    if (hero.ctaSecondary) setLink('.hero-cta2-link', hero.ctaSecondaryLink, hero.ctaSecondary);

    // Pillars / stats (index-specific cards)
    const stats = data.stats || {};
    if (Array.isArray(stats.items)) {
      stats.items.forEach((item, i) => {
        const n = i + 1;
        if (item.label) setText('.pillar-' + n + '-title', item.label);
        if (item.number != null) setText('.pillar-' + n + '-description', item.number + (item.suffix || ''));
      });
    }

    // Services section on homepage
    if (services.title) setText('.services-section-title', services.title);

    // Render service cards into #servicesGrid (homepage preview)
    if (Array.isArray(services.items) && services.items.length) {
      const grid = document.getElementById('servicesGrid');
      if (grid) {
        renderServiceCards(grid, services.items);
      }
    }

    // Marquee
    if (Array.isArray(marquee.items) && marquee.items.length) {
      document.querySelectorAll('.marquee__track').forEach((track, tIdx) => {
        if (tIdx > 0) return; // Only first marquee on homepage
        const spans = track.querySelectorAll('.marquee-item');
        spans.forEach((span, i) => {
          const val = marquee.items[i % marquee.items.length];
          if (val) span.textContent = val;
        });
      });
    }

    // Growth section
    const growth = get(data, 'growth', null);
    if (growth) {
      if (growth.tag) setText('.growth-tag', growth.tag);
      if (growth.title) setText('.growth-title', growth.title);
      if (growth.description) setText('.growth-description', growth.description);
      if (growth.ctaText) setLink('.growth-cta-link', growth.ctaLink, growth.ctaText);
    }

    // Benefits section
    const benefits = get(data, 'benefits', null);
    if (benefits) {
      if (benefits.title) setText('.benefits-title', benefits.title);
      if (benefits.description) setText('.benefits-description', benefits.description);
      if (Array.isArray(benefits.items)) {
        benefits.items.forEach((item, i) => {
          const n = i + 1;
          if (item.title) setText('.benefit-' + n + '-title', item.title);
          if (item.description) setText('.benefit-' + n + '-description', item.description);
        });
      }
    }

    // FAQ section on homepage
    const faq = data.faq || {};
    if (faq.title) setText('.faq-section-title', faq.title);
    if (faq.description) setText('.faq-section-description', faq.description);
    if (Array.isArray(faq.items) && faq.items.length) {
      renderFAQItems(faq.items);
    }
  }

  // ----- ABOUT (about.html) ----- //

  function applyAbout(data) {
    const pageHero = get(data, 'pages.about.hero', {});
    const about = data.about || {};

    // Page hero
    if (pageHero.tag) setText('.about-hero-tag', pageHero.tag);
    if (pageHero.title) setText('.about-hero-title', pageHero.title);

    // What We Do section
    if (about.title) setText('.about-whatwedo-title', about.title);
    if (about.description || (Array.isArray(about.paragraphs) && about.paragraphs.length)) {
      const desc = about.description || about.paragraphs.join(' ');
      setText('.about-whatwedo-description', desc);
    }
    if (about.image) setImage('.about-image', about.image, about.imageAlt || 'About');

    // Vision
    const vision = get(data, 'vision', null) || {};
    if (vision.title) setText('.about-vision-title', vision.title);

    // Mission
    const mission = get(data, 'mission', null) || {};
    if (mission.title) setText('.about-mission-title', mission.title);
    if (mission.description) setText('.about-mission-description', mission.description);
    if (mission.image) setImage('.about-mission-image', mission.image, mission.imageAlt || 'Mission');
  }

  // ----- CONTACT (contact.html) ----- //

  function applyContact(data) {
    const pageHero = get(data, 'pages.contact.hero', {});
    const contact = data.contact || {};

    // Page hero
    if (pageHero.tag) setText('.contact-hero-tag', pageHero.tag);
    if (pageHero.title) setText('.contact-hero-title', pageHero.title);
    if (pageHero.description) setText('.contact-hero-description', pageHero.description);

    // Contact info
    if (contact.email) {
      document.querySelectorAll('.contact-email').forEach(el => {
        el.textContent = contact.email;
        el.href = 'mailto:' + contact.email;
      });
    }

    // Form action
    if (contact.formAction) {
      const form = document.getElementById('contactForm');
      if (form) form.action = contact.formAction;
    }
  }

  // ----- SERVICES listing (services.html) ----- //

  function applyServicesPage(data) {
    const pageHero = get(data, 'pages.services.hero', {});
    const services = data.services || {};

    // Page hero
    if (pageHero.tag) setText('.services-hero-tag', pageHero.tag);
    if (pageHero.title) setText('.services-hero-title', pageHero.title);
    if (pageHero.description) setText('.services-hero-description', pageHero.description);

    // Render full services grid
    if (Array.isArray(services.items) && services.items.length) {
      const grid = document.getElementById('servicesFullGrid');
      if (grid) {
        renderServiceCards(grid, services.items);
      }
    }
  }

  // ----- SERVICE SINGLE (service-single.html?service=slug) ----- //

  function applyServiceSingle(data) {
    const slug = getParam('service');
    if (!slug) { showNotFound('serviceTitle', 'Service not found.'); return; }

    const services = get(data, 'services.items', []);
    const service = services.find(s => slugify(s.title) === slug || s.slug === slug || s.link === slug);

    if (!service) { showNotFound('serviceTitle', 'Service not found.'); return; }

    setText('#serviceTitle', service.title);
    setText('#serviceDescription', service.description);

    if (service.image) {
      setImage('#serviceImage', service.image, service.title);
    }

    // Body content (HTML allowed)
    if (service.body) {
      setHTML('#serviceBody', service.body);
    } else if (service.description) {
      setHTML('#serviceBody', '<p>' + esc(service.description) + '</p>');
    }

    // Features grid
    if (Array.isArray(service.features) && service.features.length && service.features[0]) {
      const section = document.getElementById('serviceFeatures');
      const grid = document.getElementById('serviceFeaturesGrid');
      if (section && grid) {
        section.style.display = '';
        grid.innerHTML = service.features.map(f =>
          '<div class="card card--glass"><h3 class="card__title">' + esc(f) + '</h3></div>'
        ).join('');
      }
    }

    // Update page title
    if (service.title) {
      document.title = service.title + ' — ' + (get(data, 'site.title', 'The Sweet Brand'));
    }
  }

  // ----- WORK listing (work.html) ----- //

  function applyWorkPage(data) {
    const pageHero = get(data, 'pages.projects.hero', get(data, 'pages.work.hero', {}));
    const projects = data.projects || {};

    // Page hero
    if (pageHero.tag) setText('.work-hero-tag', pageHero.tag);
    if (pageHero.title) setText('.work-hero-title', pageHero.title);
    if (pageHero.description) setText('.work-hero-description', pageHero.description);

    // Render work cards
    if (Array.isArray(projects.items) && projects.items.length) {
      const grid = document.getElementById('workGridItems');
      if (grid) {
        renderWorkCards(grid, projects.items);
      }
    }
  }

  // ----- WORK SINGLE (work-single.html?project=slug) ----- //

  function applyWorkSingle(data) {
    const slug = getParam('project');
    if (!slug) { showNotFound('projectTitle', 'Project not found.'); return; }

    const items = get(data, 'projects.items', []);
    const project = items.find(p => slugify(p.title) === slug || p.slug === slug);

    if (!project) { showNotFound('projectTitle', 'Project not found.'); return; }

    setText('#projectTitle', project.title);
    setText('#projectDescription', project.description);
    setText('#projectCategory', project.category);
    setText('#projectClient', project.client);
    setText('#projectDate', project.date);
    setText('#projectCategoryDetail', project.category);

    if (project.image) {
      setImage('#projectImage', project.image, project.alt || project.title);
    }

    if (project.body) {
      setHTML('#projectBody', project.body);
    } else if (project.description) {
      setHTML('#projectBody', '<p>' + esc(project.description) + '</p>');
    }

    // Update page title
    if (project.title) {
      document.title = project.title + ' — ' + (get(data, 'site.title', 'The Sweet Brand'));
    }
  }

  // ----- BLOG listing (blog.html) ----- //

  function applyBlogPage(data) {
    const pageHero = get(data, 'pages.blog.hero', {});
    const blog = data.blog || {};

    // Page hero
    if (pageHero.tag) setText('.blog-hero-tag', pageHero.tag);
    if (pageHero.title) setText('.blog-hero-title', pageHero.title);
    if (pageHero.description) setText('.blog-hero-description', pageHero.description);

    // Render blog cards
    if (Array.isArray(blog.posts) && blog.posts.length) {
      const grid = document.getElementById('blogGridItems');
      if (grid) {
        renderBlogCards(grid, blog.posts);
      }
    }
  }

  // ----- BLOG SINGLE (blog-single.html?post=slug) ----- //

  function applyBlogSingle(data) {
    const slug = getParam('post');
    if (!slug) { showNotFound('blogPostTitle', 'Post not found.'); return; }

    const posts = get(data, 'blog.posts', []);
    const post = posts.find(p => p.slug === slug);

    if (!post) { showNotFound('blogPostTitle', 'Post not found.'); return; }

    setText('#blogPostTitle', post.title);
    setText('#blogPostTag', post.tag);
    setText('#blogPostAuthor', post.author);
    setText('#blogPostDate', post.date);

    if (post.image) {
      setImage('#blogPostImage', post.image, post.title);
    }

    // Body — HTML content
    if (post.body) {
      setHTML('#blogPostBody', post.body);
    }

    // Update page title & meta
    if (post.title) {
      document.title = post.title + ' — ' + (get(data, 'site.title', 'The Sweet Brand'));
    }
    if (post.description) {
      setAttr('meta[name="description"]', 'content', post.description);
      setAttr('meta[property="og:description"]', 'content', post.description);
    }
    if (post.title) {
      setAttr('meta[property="og:title"]', 'content', post.title);
    }
    if (post.image) {
      setAttr('meta[property="og:image"]', 'content', post.image);
    }
  }

  // ---------------------------------------------------------------------------
  // 3. applySectionVisibility — hide sections where visible === false
  // ---------------------------------------------------------------------------

  function applySectionVisibility(data) {
    // Map data-section-visibility attribute values to content.json keys
    const visibilityMap = {
      'hero':         get(data, 'hero.visible', true),
      'stats':        get(data, 'stats.visible', true),
      'services':     get(data, 'services.visible', true),
      'projects':     get(data, 'projects.visible', true),
      'about':        get(data, 'about.visible', true),
      'testimonials': get(data, 'testimonials.visible', true),
      'blog':         get(data, 'blog.visible', true),
      'cta':          get(data, 'cta.visible', true),
      'faq':          get(data, 'faq.visible', true),
      'gallery':      get(data, 'gallery.visible', true),
      'newsletter':   get(data, 'newsletter.visible', true),
      'pricing':      get(data, 'pricing.visible', true),
      'team':         get(data, 'team.visible', true),
      'process':      get(data, 'process.visible', true),
      'partners':     get(data, 'partners.visible', true),
      'contact':      get(data, 'contact.visible', true),
      'marquee':      get(data, 'marquee.visible', true),
      'benefits':     get(data, 'benefits.visible', true),
      'growth':       get(data, 'growth.visible', true),
    };

    document.querySelectorAll('[data-section-visibility]').forEach(section => {
      const key = section.getAttribute('data-section-visibility');
      if (key && visibilityMap[key] === false) {
        section.style.display = 'none';
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 4. applyPerPageSEO — per-page title, description, OG from seo.pages
  // ---------------------------------------------------------------------------

  function applyPerPageSEO(data, page) {
    // Map page file names to seo.pages keys
    const seoKeyMap = {
      'index': 'index',
      'about': 'about',
      'services': 'services',
      'work': 'projects',
      'contact': 'contact',
      'blog': 'blog',
      'shop': 'shop',
      'pricing': 'pricing',
      'faq': 'faq',
      'gallery': 'gallery',
    };

    const seoKey = seoKeyMap[page];
    if (!seoKey) return; // Single pages handle their own SEO

    const seo = get(data, 'seo.pages.' + seoKey, null);
    if (!seo) return;

    if (seo.title) {
      document.title = seo.title;
      // Also update the <title> element if it has the class
      const titleEl = document.querySelector('title.meta-title');
      if (titleEl) titleEl.textContent = seo.title;
    }

    if (seo.description) {
      setAttr('meta[name="description"]', 'content', seo.description);
      const classed = document.querySelector('.meta-description');
      if (classed) classed.setAttribute('content', seo.description);
    }

    if (seo.ogTitle) {
      setAttr('meta[property="og:title"]', 'content', seo.ogTitle);
      const classed = document.querySelector('.og-title');
      if (classed) classed.setAttribute('content', seo.ogTitle);
    }

    if (seo.ogDescription) {
      setAttr('meta[property="og:description"]', 'content', seo.ogDescription);
      const classed = document.querySelector('.og-description');
      if (classed) classed.setAttribute('content', seo.ogDescription);
    }

    if (seo.ogImage) {
      setAttr('meta[property="og:image"]', 'content', seo.ogImage);
      const classed = document.querySelector('.og-image');
      if (classed) classed.setAttribute('content', seo.ogImage);
    }
  }

  // ---------------------------------------------------------------------------
  // 5. applyCustomCode — inject head/body custom code
  // ---------------------------------------------------------------------------

  function applyCustomCode(data) {
    const custom = data.customCode || {};

    if (custom.headCode) {
      const marker = document.querySelector('meta[name="head-custom-code"]');
      if (marker) {
        const frag = document.createRange().createContextualFragment(custom.headCode);
        marker.parentNode.insertBefore(frag, marker);
      }
    }

    if (custom.bodyEndCode) {
      const marker = document.querySelector('meta[name="body-custom-code"]');
      if (marker) {
        const frag = document.createRange().createContextualFragment(custom.bodyEndCode);
        marker.parentNode.insertBefore(frag, marker);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 6. applyIntegrations — GA4, GTM, FB Pixel, Hotjar
  // ---------------------------------------------------------------------------

  function applyIntegrations(data) {
    const int = data.integrations || {};

    // Google Analytics 4
    if (int.googleAnalytics) {
      injectScript('https://www.googletagmanager.com/gtag/js?id=' + int.googleAnalytics, true);
      injectInlineScript(
        "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','" + int.googleAnalytics + "');"
      );
    }

    // Google Tag Manager
    if (int.googleTagManager) {
      injectInlineScript(
        "(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','" + int.googleTagManager + "');"
      );
    }

    // Facebook Pixel
    if (int.facebookPixel) {
      injectInlineScript(
        "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','" + int.facebookPixel + "');fbq('track','PageView');"
      );
    }

    // Hotjar
    if (int.hotjar) {
      injectInlineScript(
        "(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:" + int.hotjar + ",hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');"
      );
    }
  }

  /** Inject an external <script> tag into <head> */
  function injectScript(src, async) {
    const s = document.createElement('script');
    s.src = src;
    if (async) s.async = true;
    document.head.appendChild(s);
  }

  /** Inject an inline <script> tag into <head> */
  function injectInlineScript(code) {
    const s = document.createElement('script');
    s.textContent = code;
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------------------
  // Renderers — dynamic card/list generation
  // ---------------------------------------------------------------------------

  /** Render service cards into a container */
  function renderServiceCards(container, items) {
    container.innerHTML = items.map(service => {
      const slug = service.slug || service.link || slugify(service.title);
      const icon = service.icon
        ? '<div class="card__icon">' + service.icon + '</div>'
        : '';
      return (
        '<div class="card service-card" data-cursor="pointer">' +
          icon +
          '<h3 class="card__title service-card__title">' + esc(service.title) + '</h3>' +
          '<p class="card__description service-card__description">' + esc(service.description) + '</p>' +
          '<a href="service-single.html?service=' + esc(slug) + '" class="card__link">Learn More <span>&rarr;</span></a>' +
        '</div>'
      );
    }).join('');
  }

  /** Render work/project cards into a container */
  function renderWorkCards(container, items) {
    container.innerHTML = items.map(project => {
      const slug = project.slug || slugify(project.title);
      const img = project.image
        ? '<img src="' + esc(project.image) + '" alt="' + esc(project.alt || project.title) + '" class="work-card__image" loading="lazy">'
        : '';
      return (
        '<a href="work-single.html?project=' + esc(slug) + '" class="card work-card" data-cursor="pointer">' +
          img +
          '<div class="card__body">' +
            (project.category ? '<span class="card__tag">' + esc(project.category) + '</span>' : '') +
            '<h3 class="card__title work-card__title">' + esc(project.title) + '</h3>' +
            '<p class="card__description work-card__description">' + esc(project.description) + '</p>' +
          '</div>' +
        '</a>'
      );
    }).join('');
  }

  /** Render blog post cards into a container */
  function renderBlogCards(container, posts) {
    container.innerHTML = posts.map(post => {
      const img = post.image
        ? '<img src="' + esc(post.image) + '" alt="' + esc(post.title) + '" class="blog-card__image" loading="lazy">'
        : '';
      return (
        '<a href="blog-single.html?post=' + esc(post.slug) + '" class="card blog-card" data-cursor="pointer">' +
          img +
          '<div class="card__body">' +
            (post.tag ? '<span class="card__tag">' + esc(post.tag) + '</span>' : '') +
            '<h3 class="card__title blog-card__title">' + esc(post.title) + '</h3>' +
            '<p class="card__description blog-card__description">' + esc(post.description) + '</p>' +
            '<div class="card__meta">' +
              (post.author ? '<span>' + esc(post.author) + '</span>' : '') +
              (post.date ? '<span>' + esc(post.date) + '</span>' : '') +
              (post.readTime ? '<span>' + esc(post.readTime) + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</a>'
      );
    }).join('');
  }

  /** Render FAQ items into #faqList */
  function renderFAQItems(items) {
    const list = document.getElementById('faqList');
    if (!list) return;

    list.innerHTML = items.map(item => (
      '<div class="faq-item">' +
        '<button class="faq-item__question">' +
          '<span class="faq-question-text">' + esc(item.question) + '</span>' +
          '<span class="faq-item__icon"></span>' +
        '</button>' +
        '<div class="faq-item__answer">' +
          '<div class="faq-item__answer-inner faq-answer-text">' + esc(item.answer) + '</div>' +
        '</div>' +
      '</div>'
    )).join('');
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Generate a URL-safe slug from a string */
  function slugify(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  /** Show a "not found" message on dynamic single pages */
  function showNotFound(titleId, message) {
    const el = document.getElementById(titleId);
    if (el) el.textContent = message || 'Not found.';
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  // Run on DOMContentLoaded if DOM not ready, otherwise immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadContent);
  } else {
    loadContent();
  }

})();
