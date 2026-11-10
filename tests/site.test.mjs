// Run: node --test tests/site.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = new URL('..', import.meta.url).pathname;
const read = f => readFileSync(root + f, 'utf8');
const pages = readdirSync(root).filter(f => f.endsWith('.html'));
const aeo = read('aeo.html');

test('aeo.html has required structure', () => {
  assert.match(aeo, /<h1 class="page-hero__title"><span class="aeo-h1-line">Does AI recommend<\/span> <span class="aeo-h1-line">your brand,<\/span> <span class="aeo-h1-line">or your competitors\?<\/span><\/h1>/);
  assert.equal((aeo.match(/<h1/g) || []).length, 1);
  for (const n of ['01', '02', '03']) assert.ok(aeo.includes(`step__num">${n}`));
  for (const s of ['Snapshot', 'Plan', 'Monthly tracking']) assert.ok(aeo.includes(`step__title">${s}<`));
  assert.ok((aeo.match(/<details>/g) || []).length >= 3, 'FAQ');
  assert.match(aeo, /<meta name="viewport" content="width=device-width, initial-scale=1.0">/);
  assert.match(aeo, /<html lang="en">/);
});

test('no em dashes in AEO page copy', () => {
  assert.ok(!/—|&mdash;|&#8212;/.test(aeo));
  assert.match(aeo, /class="aeo-eyebrow">AI Visibility \/ AEO</);
  assert.match(read('css/aeo.css'), /\.aeo-eyebrow \{[^}]*font-weight: var\(--fw-bold\)/);
});

test('form fields: required name/work email/website, optional competitor', () => {
  const field = id => (aeo.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`)) || [''])[0];
  assert.match(field('aeoName'), /required/);
  assert.match(field('aeoEmail'), /type="email"[^>]*required/);
  assert.match(field('aeoWebsite'), /type="url"[^>]*required/);
  assert.doesNotMatch(field('aeoCompetitor'), /required/);
  for (const id of ['aeoName', 'aeoEmail', 'aeoWebsite', 'aeoCompetitor']) assert.match(aeo, new RegExp(`<label[^>]*for="${id}"`));
});

test('no unverified claims: no percentages, multipliers, testimonials or guarantees', () => {
  const text = aeo.replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(text, /\d+\s?%|\d+x\b|\$\d|billion|million/i);
  assert.doesNotMatch(text, /testimonial|trusted by/i);
  assert.doesNotMatch(text.replace(/can you guarantee|no one can guarantee|anyone who does/gi, ''), /guarantee/i);
});

function fakeDoc(endpoint) {
  const el = { hidden: false, disabled: true };
  const listeners = {};
  const form = { getAttribute: () => endpoint, addEventListener: (t, f) => (listeners[t] = f), checkValidity: () => true, reset() {} };
  const els = { aeoForm: form, aeoSubmit: { ...el }, aeoPending: { ...el }, aeoSuccess: { hidden: true }, aeoError: { hidden: true } };
  return { doc: { getElementById: id => els[id] }, els, listeners };
}
globalThis.FormData = class { constructor() {} };
const { init } = require(root + 'js/aeo-form.js');

test('form stays disabled and never fakes success without an endpoint', () => {
  const { doc, els, listeners } = fakeDoc('');
  let called = false;
  assert.deepEqual(init(doc, () => { called = true; }), { enabled: false });
  assert.equal(els.aeoSubmit.disabled, true);
  assert.equal(els.aeoSuccess.hidden, true);
  assert.equal(listeners.submit, undefined);
  assert.equal(called, false);
  assert.match(aeo, /data-endpoint=""/);
  assert.match(aeo, /id="aeoSubmit" disabled/);
});

test('with endpoint: success only on OK, error on failure', async () => {
  for (const ok of [true, false]) {
    const { doc, els, listeners } = fakeDoc('https://example.invalid/x');
    init(doc, async () => ({ ok }));
    assert.equal(els.aeoSubmit.disabled, false);
    await listeners.submit({ preventDefault() {} });
    assert.equal(els.aeoSuccess.hidden, !ok);
    assert.equal(els.aeoError.hidden, ok);
  }
});

// Pre-existing on master, unrelated to this change; tracked, not hidden.
const KNOWN_MISSING = new Set(['about.html images/Working-Image.webp']);

test('all local links and assets resolve', () => {
  for (const p of pages) {
    const html = read(p);
    for (const [, u] of html.matchAll(/(?:href|src)="([^"#?]+)[^"]*"/g)) {
      if (/^(https?:|mailto:|tel:|\/\/|data:)/.test(u)) continue;
      if (KNOWN_MISSING.has(`${p} ${u}`)) continue;
      assert.ok(existsSync(root + u.replace(/^\//, '')), `${p}: missing ${u}`);
    }
  }
});


test('global typography and tokens untouched; no family footer added', () => {
  for (const f of ['css/tokens.css','css/pages.css','css/global.css','css/components.css']) assert.ok(!/Anton|family-links/.test(read(f)), f);
  for (const p of pages) assert.ok(!read(p).includes('family-links'), p);
  assert.match(aeo, /css\/aeo.css/);
});

test('mobile-safe: steps grid uses min() and form inputs are max-width 100%', () => {
  const css = read('css/aeo.css');
  assert.match(css, /minmax\(min\(100%, 240px\), 1fr\)/);
  assert.match(css, /\.aeo-form \.form__input \{[^}]*max-width: 100%/);
});

test('JS and JSON parse', () => {
  JSON.parse(read('content.json'));
  for (const f of readdirSync(root + 'js')) new Function(read('js/' + f).replace(/^\s*import .*$/gm, ''));
});

const HERO_VIDEO = /<video class="hero__video js-hero-video"[^>]*poster="videos\/hero-poster.jpg" muted loop playsinline preload="none"[^>]*>\s*<source src="videos\/hero.mp4" type="video\/mp4">/;

test('both heroes use the same video background, no autoplay attribute', () => {
  assert.match(read('index.html'), /<video class="hero__video js-hero-video" id="heroVideo" poster="videos\/aeo-hero-v2-poster.jpg" muted loop playsinline preload="none"[^>]*>\s*<source src="videos\/aeo-hero-v2.mp4\?v=1" type="video\/mp4">/);
  assert.match(aeo, /<video class="hero__video js-hero-video"[^>]*poster="videos\/aeo-hero-v2-poster.jpg" muted loop playsinline preload="none"[^>]*>\s*<source src="videos\/aeo-hero-v2.mp4\?v=1" type="video\/mp4">/);
  for (const f of ['videos/aeo-hero-v2.mp4', 'videos/aeo-hero-v2-poster.jpg']) assert.ok(existsSync(root + f), f);
  for (const [f, html] of [['index.html', read('index.html')], ['aeo.html', aeo]]) {
    assert.doesNotMatch(html.match(/<video class="hero__video[^>]*>/)[0], /autoplay/, f);
    assert.equal((html.match(/js-hero-video/g) || []).length, 1, f);
    assert.match(html, /hero__video-overlay/, f);
    assert.match(html, /css\/hero-video.css/, f);
    assert.match(html, /js\/hero-video.js/, f);
  }
  for (const f of ['videos/hero.mp4', 'videos/hero-poster.jpg']) assert.ok(existsSync(root + f), f);
  const idx = read('index.html');
  for (const t of ['DIGITAL', 'MARKETING', 'that helps sweet brands stand out.']) assert.ok(idx.includes(t));
});

test('AEO video stays inside the hero section', () => {
  const hero = aeo.match(/<section class="page-hero section--dark aeo-hero">[\s\S]*?<\/section>/)[0];
  assert.match(hero, /js-hero-video/);
  assert.match(hero, /class="aeo-eyebrow">AI Visibility \/ AEO</);
  assert.ok(!aeo.slice(aeo.indexOf(hero) + hero.length).includes('hero__video'));
});

test('overlay is balanced (dimmed, not obscured) and no em dashes', () => {
  const css = read('css/hero-video.css');
  assert.match(css, /object-position: center 30%/);
  const alphas = [...css.match(/\.hero__video-overlay \{[^}]*\}/)[0].matchAll(/rgba\(10,10,10,(\.\d+)\)/g)].map(m => +m[1]);
  assert.deepEqual(alphas, [0.65, 0.75, 0.9]);
  assert.ok(!/—/.test(css + read('js/hero-video.js') + aeo));
});

test('hero videos respect reduced motion (multiple videos)', () => {
  const { init } = require(root + 'js/hero-video.js');
  const mk = () => { const vs = [0, 1].map(() => ({ muted: false, autoplay: false, preload: 'none', played: 0, play() { this.played++; return Promise.resolve(); } })); return { vs, doc: { querySelectorAll: () => vs } }; };
  let a = mk();
  assert.equal(init(a.doc, () => ({ matches: true })), 'poster');
  for (const v of a.vs) { assert.equal(v.played, 0); assert.equal(v.autoplay, false); assert.equal(v.preload, 'none'); }
  a = mk();
  assert.equal(init(a.doc, () => ({ matches: false })), 'playing');
  for (const v of a.vs) { assert.equal(v.played, 1); assert.equal(v.muted, true); assert.equal(v.autoplay, true); }
  assert.equal(init({ querySelectorAll: () => [] }, () => ({ matches: false })), 'none');
});

test('Anton display headline scoped to the two heroes only', () => {
  const css = read('css/hero-video.css');
  assert.ok(existsSync(root + 'fonts/Anton-Regular.ttf'));
  const rule = css.match(/\.hero \.hero__title, \.aeo-hero \.page-hero__title \{[^}]*\}/)[0];
  assert.match(rule, /font-family: 'Anton'/); assert.match(rule, /text-transform: uppercase/);
  assert.equal((css.match(/font-family: 'Anton', /g) || []).length, 1);
  assert.match(css, /\.hero \.hero__title \{ font-size: clamp\(/);
  assert.match(css, /\.aeo-hero \.page-hero__title \{ font-size: clamp\(/);
  for (const p of readdirSync(root).filter(f => f.endsWith('.html'))) assert.equal(read(p).includes('hero-video.css'), ['index.html', 'aeo.html'].includes(p), p);
});

test('overlay layered above video and below text', () => {
  const css = read('css/hero-video.css');
  const z = sel => +css.match(new RegExp(sel.replace(/[.>]/g, m => '\\' + m) + ' \\{[^}]*z-index: (\\d+)'))[1];
  assert.ok(z('.hero__video') < z('.hero__video-overlay'));
  assert.ok(z('.hero__video-overlay') < z('.hero__content'));
  assert.ok(z('.hero__video-overlay') < z('.aeo-hero > .container'));
});

// ---- Homepage scope guard: only the hero may differ from master ----
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' });
const BASE = '944df54'; // original site before the hero/AEO work
const atBase = f => git('show', `${BASE}:${f}`);
const stripHero = h => h
  .replace(/<section class="hero section--dark" id="hero">[\s\S]*?<\/section>/, '<!--HERO-->')
  .replace(/\n\s*<link rel="stylesheet" href="css\/hero-video\.css\?v=\d+">/, '')
  .replace(/\n\s*<script src="js\/hero-video\.js\?v=\d+"><\/script>/, '');

test('homepage outside the hero is byte-identical to master', () => {
  // Allowed exceptions outside the hero: experience card title (t107u), content-loader cache version,
  // the inline SVG loader plus compressed logo <picture> (perf/fast-logo-loader), the AEO nav tab (t240u),
  // and hiding the Work nav tab (t243u).
  const allow = h => h
    .replace('<h3 class="card__title pillar-1-title">Ten Years of Battle-Tested Experience</h3>', '<h3 class="card__title pillar-1-title">Get Discovered</h3>')
    .replace('js/content-loader.js?v=5', 'js/content-loader.js?v=2')
    .replace('\n        <a href="https://aeo.thesweetbrand.co" class="nav__link nav-link" data-nav="aeo">AEO</a>', '')
    .replace('\n    <a href="https://aeo.thesweetbrand.co" class="nav__link nav-link">AEO</a>', '')
    .replace('<a href="services.html" class="nav__link nav-link" data-nav="services">Services</a>\n        <a href="blog.html" class="nav__link nav-link" data-nav="blog">Blog</a>',
      '<a href="services.html" class="nav__link nav-link" data-nav="services">Services</a>\n        <a href="work.html" class="nav__link nav-link" data-nav="work">Work</a>\n        <a href="blog.html" class="nav__link nav-link" data-nav="blog">Blog</a>')
    .replace('<a href="services.html" class="nav__link nav-link">Services</a>\n    <a href="blog.html" class="nav__link nav-link">Blog</a>',
      '<a href="services.html" class="nav__link nav-link">Services</a>\n    <a href="work.html" class="nav__link nav-link">Work</a>\n    <a href="blog.html" class="nav__link nav-link">Blog</a>')
    .replace(/<style id="loader-critical">[\s\S]*?<\/style>\n/, '')
    .replace(/<div class="loader" id="loader"[^>]*>[\s\S]*?<\/div>\s*<script>\(function\(\)\{var l=document\.getElementById\('loader'\)[\s\S]*?<\/script>/,
      '<div class="loader" id="loader">\n    <img src="images/sweet-brand-logo.png" alt="Loading" class="loader__logo">\n  </div>')
    .replace(/<picture><source type="image\/webp" srcset="images\/sweet-brand-logo\.webp"><img src="images\/sweet-brand-logo\.png" alt="The Sweet Brand" class="([^"]+)" width="616" height="394"( style="[^"]*")?><\/picture>/g,
      '<img src="images/sweet-brand-logo.png" alt="The Sweet Brand" class="$1"$2>');
  assert.equal(allow(stripHero(read('index.html'))), noDash(stripHero(atBase('index.html'))));
  assert.ok(!read('index.html').includes('aeo.html'));
});

test('homepage hero text unchanged; only video/overlay added inside hero', () => {
  const hero = h => h.match(/<section class="hero section--dark" id="hero">[\s\S]*?<\/section>/)[0];
  const cleaned = hero(read('index.html')).replace(/\s*<video class="hero__video[\s\S]*?<\/video>/, '').replace(/\s*<div class="hero__video-overlay"><\/div>/, '');
  assert.equal(cleaned, hero(atBase('index.html')));
});

test('content.json, content-loader and global CSS/JS unchanged from master', () => {
  const changed = git('diff', '--name-only', BASE, '--').split('\n').filter(Boolean); // working tree vs base
  for (const f of ['js/app.js', 'js/components.js', 'js/animations.js',
    'css/tokens.css', 'css/reset.css', 'css/components.css', 'css/pages.css', 'css/animations.css'])
    assert.ok(!changed.includes(f), f);
});


test('two white bands (SEO vs AEO, steps) with dark text and pink accents; others stay dark', () => {
  assert.match(aeo, /<section class="section aeo-section aeo-light" id="what">/);
  assert.match(aeo, /<section class="section aeo-section aeo-light" id="how">/);
  assert.equal((aeo.match(/aeo-light/g) || []).length, 2);
  for (const id of ['levers', 'faq', 'snapshot']) assert.doesNotMatch(aeo.match(new RegExp(`<section[^>]*id="${id}"`))[0], /aeo-light/);
  const css = read('css/aeo.css');
  assert.match(css, /\.aeo-light \{ background: #ffffff; color: #0a0a0a; \}/);
  assert.match(css, /\.aeo-light \.section__title, \.aeo-light h3 \{ color: #0a0a0a; \}/);
  assert.match(css, /\.aeo-light \.section__tag \{ color: var\(--color-accent-dark\); \}/);
  const text = aeo.replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(text, /—|\d+\s?%/);
});

test('AEO-only overlay fades from darkest top to lightest bottom; homepage gradient unchanged', () => {
  const rule = read('css/aeo.css').match(/\.aeo-hero \.hero__video-overlay \{[^}]*\}/)[0];
  const a = [...rule.matchAll(/rgba\(10,10,10,(\.\d+)\)/g)].map(m => +m[1]);
  assert.deepEqual(a, [0.85, 0.65, 0.2]);
  assert.ok(a[0] > a[1] && a[1] > a[2]);
  assert.match(read('css/hero-video.css'), /rgba\(10,10,10,\.65\) 0%, rgba\(10,10,10,\.75\) 55%, rgba\(10,10,10,\.90\) 100%/);
  assert.match(read('css/hero-video.css'), /\.hero \.hero__video \{ object-position: center center; background-image: url\("..\/videos\/aeo-hero-v2-poster.jpg"\)/);
});



const MOBILE_LOGO = `
/* Mobile header logo: compact size (desktop unchanged). Footer logo is not inside .nav. */
@media (max-width: 768px) {
  .nav .nav__logo { height: 40px; width: auto; max-width: 45vw; object-fit: contain; }
  .nav .nav__logo-link { display: inline-flex; align-items: center; min-height: 44px; }
}

/* Footer policy links: small print. */
.footer__legal a { font-size: .75rem; display: inline-block; padding-block: .5rem; }
`;
test('global.css differs from original only by the mobile header logo rule', () => {
  assert.equal(read('css/global.css'), atBase('css/global.css') + MOBILE_LOGO);
  assert.match(atBase('css/global.css'), /\.nav__logo \{\n  height: 120px;/);
});

test('shared left-aligned hero: homepage and AEO use nav container edge and Sweet Data scale', () => {
  const hv = read('css/hero-video.css'), ac = read('css/aeo.css');
  assert.match(hv, /\.hero \.hero__content \{ max-width: var\(--container-wide\);[^}]*padding-inline: var\(--container-padding\);[^}]*text-align: left; \}/);
  assert.match(hv, /\.hero \{ align-items: flex-end; padding: calc\(100px \+ 3rem\) 0 9rem; \}/);
  assert.match(hv, /\.hero \.hero__scroll-indicator \{ bottom: 1\.5rem; \}/);
  assert.match(hv, /\.hero \.hero__title \{ font-size: clamp\(2\.6rem, 1\.5rem \+ 4\.2vw, 5\.6rem\); line-height: \.98;/);
  assert.match(hv, /\.hero \.hero__ctas \{ justify-content: flex-start; margin-top: 2\.25rem;/);
  assert.match(ac, /\.aeo-hero > \.container \{ max-width: var\(--container-wide\);[^}]*padding-inline: var\(--container-padding\);[^}]*text-align: left; \}/);
  assert.match(ac, /\.aeo-hero \.page-hero__title \{ font-size: clamp\(2\.6rem, 1\.5rem \+ 4\.2vw, 4\.6rem\); line-height: \.98;[^}]*text-align: left; \}/);
  assert.match(ac, /\.aeo-hero \.aeo-h1-line \{ display: block; \}/);
  assert.ok(!/aeo-h1-line[^}]*nowrap/.test(ac), 'no forced nowrap, so narrow screens wrap instead of clipping');
  assert.match(ac, /\.aeo-hero \.aeo-eyebrow \{[^}]*font-family: 'Anton'[^}]*font-size: clamp\(1\.4rem/);
  assert.match(ac, /\.aeo-hero p\.aeo-prose \{ color: #ffffff; max-width: 56ch;/);
  assert.ok(!/align-items: center; text-align: center/.test(ac), 'old centered AEO column removed');
  assert.match(ac, /rgba\(10,10,10,\.85\) 0%, rgba\(10,10,10,\.65\) 50%, rgba\(10,10,10,\.20\) 100%/);
  assert.match(aeo, /<span class="aeo-h1-line">Does AI recommend<\/span> <span class="aeo-h1-line">your brand,<\/span> <span class="aeo-h1-line">or your competitors\?<\/span>/);
  assert.match(aeo, /hero-video\.css\?v=7/); assert.match(aeo, /aeo\.css\?v=8/); assert.match(read('index.html'), /hero-video\.css\?v=10/);
  const tail = hv.slice(hv.indexOf('/* Homepage hero layout matched'));
  for (const sel of tail.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+(?=\{)/g).map(s => s.trim()).filter(s => s && !s.startsWith('@'))) assert.match(sel, /^\.hero\b/, sel);
});

test('privacy policy covers both sites and makes no unsupported claims', () => {
  const p = read('privacy-policy.html'), text = p.replace(/<[^>]+>/g, ' ');
  for (const s of ['thesweetbrand.co', 'aeo.thesweetbrand.co', 'GitHub Pages', 'Vercel', 'info@thesweetbrand.co', 'request form on the AEO page is turned off', 'November 7, 2026']) assert.ok(text.includes(s), s);
  assert.doesNotMatch(text, /newsletter|appropriate security measures|third-party analytics and marketing tools|do not sell|have not added|—/i);
  for (const f of pages.filter(f => read(f).includes('<footer'))) assert.match(read(f), /href="privacy-policy\.html"/, f);
  assert.match(aeo, /href="privacy-policy\.html"/);
});

test('homepage hero CTAs share identical box dimensions and centering, desktop and mobile', () => {
  const css = read('css/hero-video.css');
  const rule = css.match(/\.hero \.hero__ctas \.btn \{([^}]*)\}/)[1];
  for (const d of ['box-sizing: border-box', 'display: inline-flex', 'align-items: center', 'justify-content: center', 'text-align: center', 'width: 15rem', 'height: 3.75rem', 'padding: 0 1rem', 'border: 2px solid transparent']) assert.ok(rule.includes(d), d);
  assert.match(css, /\.hero \.hero__ctas \.btn--primary \{ border-color: var\(--color-accent\); \}/);
  const mob = css.slice(css.lastIndexOf('@media (max-width: 600px)'));
  assert.match(mob, /\.hero \.hero__ctas \{ flex-direction: column; align-items: flex-start;/);
  assert.match(mob, /\.hero \.hero__ctas \.btn \{ width: min\(100%, 18rem\); \}/);
  assert.doesNotMatch(css, /\.hero \.hero__ctas \.btn--lg\s*\{/);
  const idx = read('index.html');
  assert.match(idx, /css\/hero-video.css\?v=10/);
  assert.match(idx, /<a href="contact.html" class="btn btn--primary btn--lg magnetic hero-cta1-link"><span class="hero-cta1-text">Book a Call<\/span><\/a>/);
  assert.match(idx, /<a href="services.html" class="btn btn--outline btn--lg magnetic hero-cta2-link"><span class="hero-cta2-text">Our Services<\/span><\/a>/);
  assert.doesNotMatch(read('aeo.html'), /hero__ctas/);
});

test('blog shows Coming soon with no sample posts', () => {
  const b = read('blog.html'); const d = JSON.parse(read('content.json'));
  assert.match(b, /<h1 class="page-hero__title blog-hero-title">Coming soon<\/h1>/);
  assert.match(b, /<p class="blog-coming-soon">Coming soon\.<\/p>/);
  assert.deepEqual(d.blog.posts, []);
  assert.equal(d.pages.blog.hero.title, 'Coming soon');
  const base = JSON.parse(noDash(git('show', BASE + ':content.json')));
  base.blog.posts = []; base.pages.blog.hero.title = 'Coming soon';
  base.pages.blog.hero.subtitle = 'No posts have been published yet. Check back soon.';
  base.stats.items[0] = { value: '10', label: 'Ten Years of Battle-Tested Experience' };
  base.services.items.push({
    title: 'AEO',
    slug: 'aeo',
    description: 'Help buyers find you when they ask AI who to hire and what to buy.',
    icon: '',
    image: '',
    link: 'https://aeo.thesweetbrand.co',
    features: [],
    body: ''
  });
  assert.deepEqual(d, base, 'content.json differs from original only in blog fields, the experience stat, and the AEO service');
  assert.ok(!read('content.json').includes('Years Experience'));
});

test('content-loader revalidates content.json so stale cached copies (old blog posts, old stat) are not used', async () => {
  const vm = await import('node:vm');
  const calls = [];
  const document = { readyState: 'complete', querySelectorAll: () => [], getElementById: () => null, querySelector: () => null, addEventListener() {} };
  const ctx = { document, console: { warn() {} }, location: { pathname: '/blog.html' },
    fetch: (url, init) => { calls.push({ url, init }); return Promise.resolve({ ok: false, status: 500 }); } };
  ctx.window = ctx;
  vm.runInNewContext(read('js/content-loader.js'), ctx);
  await new Promise(r => setTimeout(r, 10));
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /content\.json$/);
  assert.equal(calls[0].init && calls[0].init.cache, 'no-cache', 'must bypass the 10 minute HTTP cache');
  for (const f of ['index.html', 'about.html', 'aeo.html', 'blog.html', 'blog-single.html', 'contact.html', 'services.html', 'service-single.html', 'work.html', 'work-single.html'])
    { const h = read(f); if (h.includes('content-loader.js')) assert.match(h, /js\/content-loader\.js\?v=5/, f); }
});

test('Our Services hero pill keeps a visible 2px outline (not overridden to transparent)', () => {
  const css = read('css/hero-video.css');
  assert.match(css, /\.hero \.hero__ctas \.btn--outline \{ border-color: var\(--color-accent\); \}/);
  assert.ok(css.indexOf('.hero .hero__ctas .btn--outline') > css.indexOf('border: 2px solid transparent'));
  assert.match(read('index.html'), /<h3 class="card__title pillar-1-title">Ten Years of Battle-Tested Experience<\/h3>/);
});

function noDash(s) { for (const [a, b] of [['work — not just', 'work, not just'], ['metrics — just', 'metrics, just'], ['universal — we adapt', 'universal, and we adapt'], ['The Sweet Brand — a digital', 'The Sweet Brand, a digital'], [' — ', ' | ']]) s = s.split(a).join(b); return s; }

test('no em dashes in user-visible site content (HTML, content.json, generated titles), any encoding', () => {
  const EM = /\u2014|&mdash;|&#8212;|&#x2014;/i;
  for (const f of readdirSync(root).filter(f => f.endsWith('.html')).concat(['content.json'])) assert.doesNotMatch(read(f), EM, f);
  assert.doesNotMatch(read('js/content-loader.js'), /'[^'\n]*\u2014[^'\n]*'/, 'string literals in loader');
  assert.doesNotMatch(read('css/hero-video.css') + read('css/aeo.css'), /content:\s*['"][^'"]*\u2014/);
});

test('inline loader is all white with no pink frosting', () => {
  for (const f of ['index.html', 'about.html', 'services.html', 'aeo.html', 'contact.html']) {
    const h = read(f);
    const style = h.match(/<style id="loader-critical">[\s\S]*?<\/style>/)[0];
    const body = h.match(/<div class="loader" id="loader"[\s\S]*?<\/script>/)[0];
    assert.match(style, /#loader \.loader__mark\{[^}]*color:#ffffff/);
    assert.match(style, /#loader \.loader__frosting\{color:#ffffff\}/);
    assert.doesNotMatch(style + body, /#e81a6b/);
    assert.match(body, /dropEndMs=667/);
    assert.match(body, /minMs=reduce\?600:dropEndMs/);
    assert.match(body, /maxMs=reduce\?600:dropEndMs\+400/);
    assert.match(body, /Date\.now\(\)-t0<minMs/);
    assert.match(body, /setTimeout\(hide,600\)/);
    assert.doesNotMatch(body, /loader__drop--side/);
    assert.doesNotMatch(body, /setTimeout\(hide,1200\)/);
    assert.doesNotMatch(body, /addEventListener\('DOMContentLoaded',hide\)/);
    assert.match(style, /prefers-reduced-motion:reduce/);
  }
});

test('Work tab is hidden from desktop and mobile nav on every page', () => {
  for (const f of readdirSync(root).filter(x => x.endsWith('.html'))) {
    const h = read(f);
    if (!h.includes('class="nav__links"')) continue;
    const desk = h.match(/<div class="nav__links">([\s\S]*?)<\/div>/)[1];
    const mob = h.match(/<div class="nav__mobile"[^>]*>([\s\S]*?)<\/div>/)[1];
    assert.doesNotMatch(desk, /href="[^"]*work\.html"[^>]*>Work</, f + ' desktop');
    assert.doesNotMatch(mob, /href="[^"]*work\.html"[^>]*>Work</, f + ' mobile');
  }
  assert.ok(existsSync(root + 'work.html'), 'work page should remain');
  assert.ok(existsSync(root + 'work-single.html'), 'work-single page should remain');
});

test('every page nav (desktop and mobile) includes an AEO tab to aeo.thesweetbrand.co', () => {
  for (const f of readdirSync(root).filter(x => x.endsWith('.html'))) {
    const h = read(f);
    if (!h.includes('class="nav__links"')) continue;
    const desk = h.match(/<div class="nav__links">([\s\S]*?)<\/div>/)[1];
    const mob = h.match(/<div class="nav__mobile"[^>]*>([\s\S]*?)<\/div>/)[1];
    assert.match(desk, /href="https:\/\/aeo\.thesweetbrand\.co"[^>]*>AEO</, f + ' desktop');
    assert.match(mob, /href="https:\/\/aeo\.thesweetbrand\.co"[^>]*>AEO</, f + ' mobile');
    const foot = h.match(/<footer[\s\S]*?<\/footer>/);
    if (foot) assert.doesNotMatch(foot[0], /<a href="https:\/\/aeo\.thesweetbrand\.co"[^>]*>AEO</, f + ' footer');
  }
});

test('services include an AEO entry that links to aeo.thesweetbrand.co and names no AI companies', () => {
  const d = JSON.parse(read('content.json'));
  const item = d.services.items.find(s => s.slug === 'aeo' || s.title === 'AEO');
  assert.ok(item, 'AEO service missing');
  assert.equal(item.title, 'AEO');
  assert.equal(item.description, 'Help buyers find you when they ask AI who to hire and what to buy.');
  assert.equal(item.link, 'https://aeo.thesweetbrand.co');
  assert.doesNotMatch(item.description, /ChatGPT|Perplexity|Gemini|Claude|Copilot|OpenAI/i);
  const js = read('js/content-loader.js');
  assert.match(js, /service\.link && \/\^https\?:\\\/\\\//);
});
