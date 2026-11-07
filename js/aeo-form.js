/* AEO snapshot form. Submits only when a real endpoint is configured via
   data-endpoint; otherwise stays disabled (pending) and never fakes success. */
(function (root) {
  function init(doc, fetchFn) {
    var form = doc.getElementById('aeoForm');
    if (!form) return null;
    var endpoint = (form.getAttribute('data-endpoint') || '').trim();
    var btn = doc.getElementById('aeoSubmit');
    var pending = doc.getElementById('aeoPending');
    var ok = doc.getElementById('aeoSuccess');
    var err = doc.getElementById('aeoError');
    if (!endpoint) { btn.disabled = true; return { enabled: false }; }
    btn.disabled = false;
    if (pending) pending.hidden = true;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity && form.reportValidity(); return; }
      btn.disabled = true;
      return fetchFn(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error('bad status'); ok.hidden = false; form.reset(); })
        .catch(function () { err.hidden = false; btn.disabled = false; });
    });
    return { enabled: true };
  }
  if (typeof module !== 'undefined') module.exports = { init: init };
  if (root.document) init(root.document, root.fetch && root.fetch.bind(root));
})(typeof window !== 'undefined' ? window : globalThis);
