/* Garage Kremer Bettendorf — Interaktionen */
(function () {
  'use strict';

  /* --- Mobile-Navigation --- */
  var toggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('main-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    });
    // Menü nach Klick auf einen Link schließen
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* --- Aktuelles Jahr im Footer --- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* --- Back-to-top-Button --- */
  var backBtn = document.getElementById('back-to-top');
  if (backBtn) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 500) backBtn.classList.add('show');
      else backBtn.classList.remove('show');
    }, { passive: true });
  }

  /* --- Reveal-Animation beim Scrollen --- */
  var revealTargets = document.querySelectorAll('.card, .feature, .about-content, .about-media, .section-head, .hours-content, .hours-table, .contact-info, .contact-form');
  revealTargets.forEach(function (el) { el.classList.add('reveal'); });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealTargets.forEach(function (el) { io.observe(el); });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('visible'); });
  }

  /* --- Zähler-Animation (Trust-Bar) --- */
  function formatNumber(n) {
    return n.toLocaleString('de-DE');
  }
  var counters = document.querySelectorAll('.trust-item strong[data-count]');
  if ('IntersectionObserver' in window && counters.length) {
    var cObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var target = parseInt(el.getAttribute('data-count'), 10) || 0;
        var start = 0, duration = 1400, startTime = null;
        function step(ts) {
          if (!startTime) startTime = ts;
          var progress = Math.min((ts - startTime) / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          el.textContent = formatNumber(Math.floor(eased * target));
          if (progress < 1) requestAnimationFrame(step);
          else el.textContent = formatNumber(target);
        }
        requestAnimationFrame(step);
        cObserver.unobserve(el);
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { cObserver.observe(el); });
  }

  /* --- Kontaktformular (clientseitige Validierung + Demo-Rückmeldung) --- */
  var form = document.getElementById('contact-form');
  var status = document.getElementById('form-status');

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.className = 'form-status';
      status.textContent = '';

      var name = form.name.value.trim();
      var email = form.email.value.trim();
      var message = form.message.value.trim();
      var emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      if (!name || !emailValid || !message) {
        status.classList.add('err');
        status.textContent = 'Bitte füllen Sie Name, eine gültige E-Mail und Ihre Nachricht aus.';
        return;
      }

      // Hinweis: In der Live-Version wird die Anfrage an das Backend/E-Mail gesendet.
      status.classList.add('ok');
      status.textContent = 'Vielen Dank, ' + name + '! Ihre Anfrage wurde erfasst – wir melden uns in Kürze.';
      form.reset();
    });
  }
})();
