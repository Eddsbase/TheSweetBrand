/* Plays the hero video only when the visitor has not asked for reduced motion.
   With reduced motion the video is never loaded and only the poster shows. */
(function (root) {
  function init(doc, mm) {
    var v = doc.getElementById('heroVideo');
    if (!v) return 'none';
    if (mm && mm('(prefers-reduced-motion: reduce)').matches) return 'poster';
    v.muted = true;
    v.autoplay = true;
    v.preload = 'auto';
    var p = v.play && v.play();
    if (p && p.catch) p.catch(function () {});
    return 'playing';
  }
  if (typeof module !== 'undefined') module.exports = { init: init };
  if (root.document) init(root.document, root.matchMedia && root.matchMedia.bind(root));
})(typeof window !== 'undefined' ? window : globalThis);
