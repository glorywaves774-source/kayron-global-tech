/* Light / dark screen switch (shared with AHMIS, Kendra, AVIEL and MINDI).
 * Loaded in <head> without defer so the right colours are set before the page is drawn (no white flash).
 * Until the person chooses, it follows the device's own light/dark setting. The choice is remembered on this
 * device. Printing always uses the light colours. External file, so it works with strict Content-Security-Policies.
 * Any element with [data-theme-toggle] switches the mode. */
(function () {
  "use strict";
  var KEY = "screen-theme", root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function saved() {
    try { var v = localStorage.getItem(KEY); if (v === "dark" || v === "light") return v; } catch (e) { /* storage off */ }
    var m = document.cookie.match(/(?:^|;\s*)screen_theme=(dark|light)/);
    return m ? m[1] : null;
  }
  function current() { return saved() || (media && media.matches ? "dark" : "light"); }
  function apply(mode) {
    root.setAttribute("data-theme", mode);
    root.setAttribute("data-bs-theme", mode);          // Bootstrap 5.3 components follow along
    root.style.colorScheme = mode;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      if (!meta.getAttribute("data-light")) meta.setAttribute("data-light", meta.getAttribute("content") || "");
      meta.setAttribute("content", mode === "dark" ? "#050b18" : meta.getAttribute("data-light"));
    }
    label(mode);
  }
  function label(mode) {
    var dark = mode === "dark";
    Array.prototype.forEach.call(document.querySelectorAll("[data-theme-toggle]"), function (b) {
      b.setAttribute("aria-pressed", dark ? "true" : "false");
      var to = dark ? (b.getAttribute("data-label-light") || "Light mode") : (b.getAttribute("data-label-dark") || "Dark mode");
      b.setAttribute("aria-label", to); b.setAttribute("title", to);
      var icon = b.querySelector(".tt-icon"), text = b.querySelector(".tt-text");
      if (icon) icon.textContent = dark ? "☀" : "☾";   // sun shows in dark mode, moon in light mode
      if (text) text.textContent = to;
    });
  }
  function choose(mode) {
    try { localStorage.setItem(KEY, mode); } catch (e) { /* storage off */ }
    document.cookie = "screen_theme=" + mode + ";path=/;max-age=31536000;SameSite=Lax";
    apply(mode);
  }

  apply(current());
  if (media) {
    var follow = function () { if (!saved()) apply(media.matches ? "dark" : "light"); };
    if (media.addEventListener) media.addEventListener("change", follow); else if (media.addListener) media.addListener(follow);
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-theme-toggle]");
    if (!b) return;
    e.preventDefault();
    choose(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
  });
  document.addEventListener("DOMContentLoaded", function () { label(root.getAttribute("data-theme")); });
  // paper is always white
  window.addEventListener("beforeprint", function () { root.setAttribute("data-bs-theme", "light"); root.setAttribute("data-theme", "light"); });
  window.addEventListener("afterprint", function () { apply(current()); });
  window.ScreenTheme = { set: choose, get: function () { return root.getAttribute("data-theme"); } };
})();
