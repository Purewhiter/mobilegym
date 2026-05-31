// Populate the hero "Star" button with the live GitHub star count.
//
// Data source is shields.io's cached endpoint — NOT api.github.com directly.
// shields fetches + caches the count server-side and sends CORS headers
// (access-control-allow-origin: *), so the visitor's browser can read it with
// no per-IP GitHub rate limit. We borrow only shields' *number* and render it
// in our own button styling. The `.json` variant returns e.g.
//   { "label": "stars", "message": "253", "value": "253", ... }
// where `message` is already formatted (e.g. "1.2k" for large counts).
// On any failure the count pill stays [hidden] and the button degrades to a
// plain "Star on GitHub" link.
(function () {
  var REPO = 'Purewhiter/mobilegym';
  var el = document.getElementById('gh-star-count');
  if (!el) return;

  fetch('https://img.shields.io/github/stars/' + REPO + '.json')
    .then(function (res) {
      if (!res.ok) {
        console.warn('[gh-stars] HTTP ' + res.status + ' from shields.io');
        return null;
      }
      return res.json();
    })
    .then(function (data) {
      var text = data && (data.message != null ? data.message : data.value);
      // Skip non-numeric responses like "not found" / "inaccessible".
      if (typeof text !== 'string' || !/\d/.test(text)) return;
      el.textContent = text;
      el.hidden = false;
    })
    .catch(function (err) {
      console.warn('[gh-stars] fetch failed:', err && err.message ? err.message : err);
    });
})();
