/**
 * Balai-Reserve – Landing Page JavaScript
 */
(function () {
  'use strict';

  // ── Sticky navbar: darken on scroll ─────────────────────────────────────
  var nav = document.getElementById('topNav');
  if (nav) {
    window.addEventListener('scroll', function () {
      nav.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });
    // Apply on load in case page is already scrolled
    nav.classList.toggle('scrolled', window.scrollY > 60);
  }

  // ── Mobile menu ──────────────────────────────────────────────────────────
  var toggle    = document.getElementById('navToggle');
  var mobileMenu= document.getElementById('mobileMenu');
  var menuClose = document.getElementById('menuClose');

  if (toggle && mobileMenu) {
    toggle.addEventListener('click', function () {
      mobileMenu.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
  }
  if (menuClose && mobileMenu) {
    menuClose.addEventListener('click', function () {
      mobileMenu.classList.remove('open');
      document.body.style.overflow = '';
    });
  }
  window.closeMobileMenu = function () {
    if (mobileMenu) mobileMenu.classList.remove('open');
    document.body.style.overflow = '';
  };

  // Close on outside click
  if (mobileMenu) {
    mobileMenu.addEventListener('click', function (e) {
      if (e.target === mobileMenu) window.closeMobileMenu();
    });
  }

  // ── Hero booking widget: route by type ───────────────────────────────────
  var heroType    = document.getElementById('heroType');
  var heroSearchBtn = document.getElementById('heroSearchBtn');
  var heroCheckin   = document.getElementById('heroCheckin');
  var heroCheckout  = document.getElementById('heroCheckout');

  if (heroType && heroSearchBtn) {
    var heroForm = heroSearchBtn.closest('form');

    heroType.addEventListener('change', function () {
      var type = this.value;
      // Show/hide date inputs based on type
      if (heroCheckin && heroCheckout) {
        var showDates = (type === 'rooms' || type === 'cottages');
        heroCheckin.closest('.col-6').style.display = showDates ? '' : 'none';
        heroCheckout.closest('.col-6').style.display = showDates ? '' : 'none';
      }
    });

    heroForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var type     = heroType ? heroType.value : 'rooms';
      var checkin  = heroCheckin  ? heroCheckin.value  : '';
      var checkout = heroCheckout ? heroCheckout.value : '';
      var guests   = heroForm.querySelector('[name="guests"]');
      var guestVal = guests ? guests.value : '';

      var base = '/portal/' + type;
      var params = new URLSearchParams();
      if (checkin)  params.set('checkin',  checkin);
      if (checkout) params.set('checkout', checkout);
      if (guestVal) params.set('guests',   guestVal);

      var qs = params.toString();
      window.location.href = base + (qs ? '?' + qs : '');
    });
  }

  // ── Set min dates on hero date inputs ────────────────────────────────────
  var today = new Date().toISOString().slice(0, 10);
  if (heroCheckin)  { heroCheckin.min  = today; }
  if (heroCheckout) { heroCheckout.min = today; }
  if (heroCheckin && heroCheckout) {
    heroCheckin.addEventListener('change', function () {
      heroCheckout.min = this.value;
      if (heroCheckout.value && heroCheckout.value <= this.value) heroCheckout.value = '';
    });
  }

  // ── Smooth scroll for anchor links ──────────────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ── Animate numbers on scroll (intersection observer) ───────────────────
  var statNumbers = document.querySelectorAll('.stat-number, .hero-stat-val');
  if ('IntersectionObserver' in window && statNumbers.length) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el    = entry.target;
        var raw   = el.textContent.trim();
        var num   = parseFloat(raw.replace(/[^0-9.]/g, ''));
        var suffix= raw.replace(/[0-9.,\s]/g, '');
        if (!isNaN(num) && num > 0) {
          var start = 0;
          var dur   = 800;
          var begin = performance.now();
          function tick(now) {
            var p = Math.min((now - begin) / dur, 1);
            var cur = Math.round(p * num);
            el.textContent = cur + suffix;
            if (p < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        }
        observer.unobserve(el);
      });
    }, { threshold: 0.5 });

    statNumbers.forEach(function (el) { observer.observe(el); });
  }

  // ── Facility cards entrance animation ───────────────────────────────────
  var fadeEls = document.querySelectorAll('.facility-card, .accom-card, .event-card, .step-card');
  if ('IntersectionObserver' in window && fadeEls.length) {
    var fadeObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          fadeObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    fadeEls.forEach(function (el, i) {
      el.style.opacity    = '0';
      el.style.transform  = 'translateY(20px)';
      el.style.transition = 'opacity .5s ease ' + (i % 4 * 0.08) + 's, transform .5s ease ' + (i % 4 * 0.08) + 's';
      fadeObserver.observe(el);
    });
  }

})();
