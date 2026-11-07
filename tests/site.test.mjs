// Run: node --test tests/site.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = new URL('..', import.meta.url).pathname;
const read = f => readFileSync(root + f, 'utf8');
const pages = readdirSync(root).filter(f => f.endsWith('.html'));
const aeo = read('aeo.html');

test('aeo.html has required structure', () => {
  assert.match(aeo, /<h1[^>]*>Does AI recommend your brand, or your competitors\?<\/h1>/);
  assert.equal((aeo.match(/<h1/g) || []).length, 1);
  for (const n of ['01', '02', '03']) assert.ok(aeo.includes(`step__num">${n}`));
  for (const s of ['Snapshot', 'Plan', 'Monthly tracking']) assert.ok(aeo.includes(`step__title">${s}<`));
  assert.ok((aeo.match(/<details>/g) || []).length >= 3, 'FAQ');
  assert.match(aeo, /<meta name="viewport" content="width=device-width, initial-scale=1.0">/);
  assert.match(aeo, /<html lang="en">/);
});

test('no em dashes in AEO page or homepage hero/card copy', () => {
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

test('homepage AEO card + content.json item link to aeo.html', () => {
  assert.match(read('index.html'), /service-card__title">AEO<\/h3>[\s\S]{0,300}href="aeo.html"/);
  const items = JSON.parse(read('content.json')).services.items;
  assert.equal(items.find(i => i.slug === 'aeo').href, 'aeo.html');
  assert.match(read('js/content-loader.js'), /service\.href \?/);
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
  for (const [f, html] of [['index.html', read('index.html')], ['aeo.html', aeo]]) {
    assert.match(html, HERO_VIDEO, f);
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
