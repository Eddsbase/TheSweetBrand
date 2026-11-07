# Approved design: Sweet family alignment + AEO landing page

Approved by Edward Young (Nov 6, 2026).

## Design
- Typography: Anton (display headings) + Inter (body), matching sweetsuite.co / sweetdata.co. Existing dark/pink tokens (#0a0a0a, #e81a6b, #ff2d7f) kept unchanged.
- Numbered steps (01/02/03) pattern, as on sweetdata.co.
- "The Sweet family" footer group linking sweetsuite.co and sweetdata.co on every page.
- Homepage AEO service card linking to aeo.html.
- aeo.html: hero "Does AI recommend your brand—or your competitors?", plain explanation, Snapshot -> Plan -> Monthly tracking, FAQ, capture form (name, work email, website, optional competitor).

## Copy rules
No numeric marketing claims, testimonials, client names or guaranteed placement.

## Lead capture
The existing contact form has no backend (empty action; JS shows success in "demo mode").
The AEO form therefore ships in an honest pending state: fields are shown but submit is disabled,
with a notice and a mailto fallback. To enable, set `data-endpoint` on `#aeoForm` to an approved backend;
the script then POSTs and only shows success on an OK response.

## Plan
1. tokens.css: load Anton+Inter, set --font-primary to Inter, add --font-display Anton for headings.
2. Add .steps, .family-links, .aeo-* styles in pages.css.
3. Add AEO service to index.html static grid and content.json; loader honors an optional `href`.
4. Add family footer group to all pages.
5. Create aeo.html + js/aeo-form.js.
6. tests/site.test.mjs (node:test, no deps): structure, viewport, links, form behavior.
