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
    '.service-detail-list > *', '.about-content > *', '.contact-layout > *'];
  var SINGLES = ['.section-heading', '.feature-layout', '.cta-inner', '.values-band > .wrap', '.portfolio-empty'];
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
