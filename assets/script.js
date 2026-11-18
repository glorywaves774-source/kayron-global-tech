// Kayron public site: footer year, contact form, and scroll animations.
(function () {
  'use strict';

  document.querySelectorAll('#year').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // ---------- Motion: sections and cards ease in as they scroll into view ----------
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canObserve = 'IntersectionObserver' in window;
  var observer = null;
  if (!reduce && canObserve) {
    document.documentElement.classList.add('motion');
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); observer.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  }
  // Groups: items in the same group come in one after another.
  var GROUPS = ['.service-grid > *', '.process-grid > *', '.values-grid > *', '.portfolio-grid > *', '.strip-inner > *',
    '.service-detail-list > *', '.about-content > *', '.contact-layout > *', '.industry-grid > *', '.product-grid > *', '.client-list > *'];
  var SINGLES = ['.legal-body', '.product-note', '.section-heading', '.feature-layout', '.cta-inner', '.values-band > .wrap', '.portfolio-empty'];
  function reveal(nodes) {
    if (!observer) return;
    Array.prototype.forEach.call(nodes, function (el, i) {
      if (el.hasAttribute('data-reveal')) return;
      el.setAttribute('data-reveal', '');
      el.style.setProperty('--d', String(Math.min(i, 6)));
      observer.observe(el);
    });
  }
  GROUPS.forEach(function (sel) { reveal(document.querySelectorAll(sel)); });
  SINGLES.forEach(function (sel) { document.querySelectorAll(sel).forEach(function (el) { reveal([el]); }); });
  window.kayronReveal = reveal;   // used by the Work page after it loads the projects

  // ---------- Contact form ----------
  var form = document.querySelector('#contactForm');
  if (!form) return;
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var button = form.querySelector('button[type=submit]');
    var note = document.querySelector('#formNote');
    button.disabled = true; button.textContent = 'Sending…';
    try {
      var data = Object.fromEntries(new FormData(form));
      var response = await fetch('/api/enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      var result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to send enquiry');
      form.reset();
      note.textContent = 'Thank you. Your enquiry has been received. Kayron will follow up using the email address you provided.';
    } catch (error) {
      note.textContent = error.message === 'Failed to fetch' ? 'The enquiry service is not connected yet. Please email info@kayronglobaltech.com directly.' : error.message;
    } finally {
      button.disabled = false; button.innerHTML = 'Send enquiry <span>↗</span>';
    }
  });
})();

// ---------- Hero showcase: cycles through screenshots of our work ----------
(function () {
  'use strict';
  var box = document.querySelector('[data-showcase]');
  if (!box) return;
  var count = box.querySelectorAll('.shot-browser .shot').length;
  var caption = box.querySelector('[data-caption]');
  var dots = box.querySelectorAll('[data-go]');
  var i = 0, timer = null;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function show(n) {
    i = (n + count) % count;
    box.querySelectorAll('.shot').forEach(function (img) { img.classList.toggle('is-active', Number(img.getAttribute('data-slide')) === i); });
    dots.forEach(function (d) { if (Number(d.getAttribute('data-go')) === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
    if (caption) caption.textContent = box.getAttribute('data-cap' + i) || '';
  }
  function start() { if (!reduce && !timer && count > 1) timer = setInterval(function () { show(i + 1); }, 5000); }
  function stop() { clearInterval(timer); timer = null; }
  dots.forEach(function (d) { d.addEventListener('click', function () { stop(); show(Number(d.getAttribute('data-go'))); start(); }); });
  box.addEventListener('mouseenter', stop); box.addEventListener('mouseleave', start);
  box.addEventListener('focusin', stop); box.addEventListener('focusout', start);
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  start();
})();

// ---------- Contact details from assets/config.js (only the ones that are filled in) ----------
(function () {
  'use strict';
  var cfg = window.KAYRON_CONFIG || {};
  var items = [];
  if (cfg.contactEmail) items.push(['Email', cfg.contactEmail, 'mailto:' + cfg.contactEmail]);
  if (cfg.phone) items.push(['Phone', cfg.phone, 'tel:' + cfg.phone.replace(/[^\d+]/g, '')]);
  if (cfg.whatsapp) items.push(['WhatsApp', cfg.whatsapp, 'https://wa.me/' + cfg.whatsapp.replace(/\D/g, '')]);
  if (cfg.address) items.push(['Address', cfg.address, null]);
  if (items.length < 2) return;            // only an email: the pages already show it
  document.querySelectorAll('[data-contact-details]').forEach(function (box) {
    box.textContent = '';
    items.forEach(function (it) {
      var li = document.createElement('li');
      var label = document.createElement('span'); label.className = 'cd-label'; label.textContent = it[0];
      var val = it[2] ? document.createElement('a') : document.createElement('span');
      if (it[2]) { val.href = it[2]; if (it[0] === 'WhatsApp') { val.target = '_blank'; val.rel = 'noopener'; } }
      val.textContent = it[1];
      li.append(label, val); box.appendChild(li);
    });
    box.hidden = false;
  });
})();

// ---------- Testimonials (added by Kayron in the admin; the section stays hidden until there is one) ----------
(function () {
  'use strict';
  var box = document.querySelector('[data-testimonials]');
  if (!box) return;
  fetch('/api/testimonials', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : { testimonials: [] }; })
    .then(function (d) {
      var list = Array.isArray(d.testimonials) ? d.testimonials : [];
      if (!list.length) return;
      var grid = box.querySelector('[data-testimonial-grid]');
      list.forEach(function (t) {
        var fig = document.createElement('figure'); fig.className = 'testimonial';
        var q = document.createElement('blockquote'); q.textContent = t.quote;
        var cap = document.createElement('figcaption');
        var name = document.createElement('strong'); name.textContent = t.name;
        cap.appendChild(name);
        if (t.role) { var role = document.createElement('span'); role.textContent = t.role; cap.appendChild(role); }
        fig.append(q, cap); grid.appendChild(fig);
      });
      box.hidden = false;
      if (window.kayronReveal) window.kayronReveal(grid.children);
    })
    .catch(function () { /* leave hidden */ });
})();
