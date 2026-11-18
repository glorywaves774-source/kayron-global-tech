/* Phone navigation, following Android (Material) and iPhone (Apple) conventions:
 *  - the menu slides in from the left over a dimmed page (modal navigation drawer);
 *  - it closes with ×, a tap on the dimmed page, Escape, or the phone's Back button;
 *  - choosing a page closes the menu and opens that page at the top;
 *  - a "Find a page" box filters long menus.
 * Markup: the menu element has [data-pn-drawer]; any button with [data-pn-open] opens it; the page content has [data-pn-main].
 * Only active at phone widths (max-width: 760px). External file, so it works under a strict Content-Security-Policy. */
(function () {
  "use strict";
  var drawer = document.querySelector("[data-pn-drawer]");
  if (!drawer) return;
  var html = document.documentElement, body = document.body;
  var phone = window.matchMedia("(max-width: 760px)");
  var openers = Array.prototype.slice.call(document.querySelectorAll("[data-pn-open]"));
  var main = document.querySelector("[data-pn-main]");
  var lastOpener = null, pushed = false;

  html.classList.add("pn-ready");
  if (!drawer.id) drawer.id = "pn-drawer";
  drawer.setAttribute("aria-label", drawer.getAttribute("aria-label") || "Menu");

  var scrim = document.createElement("div");
  scrim.className = "pn-scrim"; scrim.setAttribute("aria-hidden", "true");
  drawer.parentNode.insertBefore(scrim, drawer);   // same layer as the menu, so the menu always sits above it

  var close = document.createElement("button");
  close.type = "button"; close.className = "pn-close"; close.setAttribute("aria-label", "Close menu");
  close.innerHTML = '<span aria-hidden="true">&times;</span>';
  drawer.insertBefore(close, drawer.firstChild);

  // "Find a page" filter for long menus
  var nav = drawer.querySelector("nav");
  var filterBox = null;
  if (nav && nav.querySelectorAll("a").length > 8) {
    filterBox = document.createElement("div"); filterBox.className = "pn-filter";
    var input = document.createElement("input");
    input.type = "search"; input.placeholder = "Find a page…"; input.setAttribute("aria-label", "Find a page in the menu");
    input.autocomplete = "off";
    filterBox.appendChild(input);
    nav.parentNode.insertBefore(filterBox, nav);
    var fold = function (s) { return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " "); };
    input.addEventListener("input", function () {
      var q = fold(input.value).trim();
      nav.querySelectorAll("a").forEach(function (a) { a.hidden = !!q && fold(a.textContent).indexOf(q) < 0; });
      nav.querySelectorAll("details").forEach(function (d) {
        if (q) { d.setAttribute("data-pn-was-open", d.open ? "1" : ""); d.open = true;
                 d.hidden = !Array.prototype.some.call(d.querySelectorAll("a"), function (a) { return !a.hidden; }); }
        else { d.hidden = false; if (d.hasAttribute("data-pn-was-open")) { d.open = d.getAttribute("data-pn-was-open") === "1"; d.removeAttribute("data-pn-was-open"); } }
      });
    });
  }

  function setOpenState(open) {
    html.classList.toggle("pn-open", open);
    drawer.setAttribute("aria-hidden", open ? "false" : "true");
    openers.forEach(function (b) { b.setAttribute("aria-expanded", open ? "true" : "false"); });
    if (main) { if (open) main.setAttribute("inert", ""); else main.removeAttribute("inert"); }
  }

  function open(e) {
    if (!phone.matches) return;
    lastOpener = e && e.currentTarget || openers[0];
    setOpenState(true);
    try { history.pushState({ pnDrawer: 1 }, ""); pushed = true; } catch (err) { pushed = false; }
    var current = drawer.querySelector('[aria-current="page"], a.active');
    if (current) { var d = current.closest("details"); if (d) d.open = true; current.scrollIntoView({ block: "center" }); }
    else drawer.scrollTop = 0;
    close.focus({ preventScroll: true });
  }

  function shut(viaBack) {
    if (!html.classList.contains("pn-open")) return;
    setOpenState(false);
    if (pushed && !viaBack) { pushed = false; history.back(); }
    pushed = false;
    if (lastOpener) lastOpener.focus({ preventScroll: true });
  }

  openers.forEach(function (b) {
    b.setAttribute("aria-controls", drawer.id); b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", function (e) { if (!phone.matches) return; e.preventDefault(); html.classList.contains("pn-open") ? shut() : open(e); });
  });
  close.addEventListener("click", function () { shut(); });
  scrim.addEventListener("click", function () { shut(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && html.classList.contains("pn-open")) { e.preventDefault(); shut(); } });
  window.addEventListener("popstate", function () { if (html.classList.contains("pn-open")) { pushed = false; shut(true); } });

  // Choosing a page: close the menu (removing its Back step) and then open the page, so Back later returns to the previous page.
  drawer.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || !html.classList.contains("pn-open") || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || a.target === "_blank") return;
    var url = a.href;
    if (!pushed) { setOpenState(false); return; }
    e.preventDefault();
    var go = function () { window.removeEventListener("popstate", go); location.href = url; };
    window.addEventListener("popstate", go);
    pushed = false; setOpenState(false); history.back();
    setTimeout(go, 400);                     // in case the browser does not report the Back step
  });
  // forms inside the menu (sign out, language) close it first too
  drawer.addEventListener("submit", function () { setOpenState(false); });

  if (phone.addEventListener) phone.addEventListener("change", function () { if (!phone.matches) shut(); });
  setOpenState(false);
  if (!phone.matches) drawer.removeAttribute("aria-hidden");
  if (phone.addEventListener) phone.addEventListener("change", function () { if (!phone.matches) drawer.removeAttribute("aria-hidden"); else if (!html.classList.contains("pn-open")) drawer.setAttribute("aria-hidden", "true"); });
})();
