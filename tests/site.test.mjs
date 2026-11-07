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
  for (const f of ['css/tokens.css','css/pages.css','css/global.css']) assert.ok(!/Anton|family-links/.test(read(f)), f);
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

test('homepage hero video: markup, poster, assets, overlay', () => {
  const idx = read('index.html');
  assert.match(idx, /<video class="hero__video" id="heroVideo" poster="videos\/hero-poster.jpg" muted loop playsinline preload="none"/);
  assert.doesNotMatch(idx.match(/<video class="hero__video"[^>]*>/)[0], /autoplay/);
  assert.match(idx, /<source src="videos\/hero.mp4" type="video\/mp4">/);
  for (const f of ['videos/hero.mp4', 'videos/hero-poster.jpg', 'css/hero-video.css', 'js/hero-video.js']) assert.ok(existsSync(root + f), f);
  assert.match(read('css/hero-video.css'), /object-position: center 30%[\s\S]*rgba\(10,10,10,\.20\)[\s\S]*rgba\(10,10,10,\.85\)/);
  for (const t of ['DIGITAL', 'MARKETING', 'that helps sweet brands stand out.']) assert.ok(idx.includes(t));
  assert.ok(!/—/.test(read('css/hero-video.css') + read('js/hero-video.js')));
});

test('hero video respects reduced motion', () => {
  const { init } = require(root + 'js/hero-video.js');
  const mk = () => { const v = { muted: false, autoplay: false, preload: 'none', played: 0, play() { this.played++; return Promise.resolve(); } }; return { v, doc: { getElementById: () => v } }; };
  let a = mk();
  assert.equal(init(a.doc, () => ({ matches: true })), 'poster');
  assert.equal(a.v.played, 0); assert.equal(a.v.autoplay, false); assert.equal(a.v.preload, 'none');
  a = mk();
  assert.equal(init(a.doc, () => ({ matches: false })), 'playing');
  assert.equal(a.v.played, 1); assert.equal(a.v.muted, true); assert.equal(a.v.autoplay, true);
});
