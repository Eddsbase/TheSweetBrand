# AEO landing page (scope per Edward, Nov 6 2026)
Keep thesweetbrand.co looking the same; add only an AEO page with a capture form.

- aeo.html uses the existing header, footer, tokens and typography; page-only styles in css/aeo.css.
- Homepage gets one AEO card in the existing service-card style (static + content.json; loader honors optional `href`).
- Form posts to the URL in `data-endpoint` on `#aeoForm` and shows success only on an OK response.
  No backend exists yet (site is GitHub Pages; contact form has no action). Until an endpoint is approved
  and set, the submit button stays disabled and the page says requests aren't open yet.
