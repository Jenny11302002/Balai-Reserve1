/**
 * Real-time notifications (polling)
 * ---------------------------------
 * Polls GET /notifications/feed every few seconds and:
 *   - updates the bell badge count
 *   - refreshes the dropdown list
 *   - pops a toast for any newly-arrived notification
 *
 * Works on BOTH layouts:
 *   - Portal:  #portalNotifBadge / #portalNotifList / #portalNotifMarkAll
 *   - Staff:   .notif-badge (in navbar) — badge only, list handled server-side
 *
 * Degrades gracefully: if the user is not logged in, /feed returns 401/empty
 * and polling quietly stops.
 */
(function () {
  'use strict';

  var POLL_MS = 15000;                 // 15s
  var seenIds = null;                  // Set of notification ids we've already shown
  var pollTimer = null;

  // Elements (portal). Staff badge handled separately below.
  var portalBadge = document.getElementById('portalNotifBadge');
  var portalList  = document.getElementById('portalNotifList');
  var markAllBtn  = document.getElementById('portalNotifMarkAll');

  // Staff navbar badge (class-based)
  var staffBadge  = document.querySelector('.notif-badge');

  // Only run if there's somewhere to show notifications
  if (!portalBadge && !staffBadge && !portalList) return;

  // Ensure a toast container exists
  var toastWrap = document.getElementById('toastContainer');
  if (!toastWrap) {
    toastWrap = document.createElement('div');
    toastWrap.id = 'toastContainer';
    document.body.appendChild(toastWrap);
  }

  function iconFor(type) {
    switch (type) {
      case 'payment':     return 'fa-money-bill-wave';
      case 'reservation': return 'fa-calendar-check';
      case 'inquiry':     return 'fa-question-circle';
      case 'inventory':   return 'fa-exclamation-triangle';
      default:            return 'fa-bell';
    }
  }

  function timeAgo(iso) {
    try {
      var then = new Date(iso.replace(' ', 'T') + (iso.indexOf('Z') < 0 ? 'Z' : ''));
      var diff = Math.floor((Date.now() - then.getTime()) / 1000);
      if (isNaN(diff)) return '';
      if (diff < 60)   return 'just now';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400)return Math.floor(diff / 3600) + 'h ago';
      return Math.floor(diff / 86400) + 'd ago';
    } catch (e) { return ''; }
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function showToast(n) {
    var el = document.createElement('div');
    el.className = 'rt-toast type-' + (n.type || 'system');
    el.innerHTML =
      '<div class="rt-toast-icon"><i class="fas ' + iconFor(n.type) + '"></i></div>' +
      '<div class="rt-toast-body">' +
        '<div class="rt-toast-title">' + escapeHtml(n.title) + '</div>' +
        '<div class="rt-toast-msg">' + escapeHtml(n.message) + '</div>' +
      '</div>' +
      '<button class="rt-toast-close" aria-label="Dismiss">&times;</button>';

    // Clicking the toast body navigates to the link
    if (n.link) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', function (e) {
        if (e.target.classList.contains('rt-toast-close')) return;
        window.location.href = n.link;
      });
    }
    el.querySelector('.rt-toast-close').addEventListener('click', function (e) {
      e.stopPropagation();
      el.remove();
    });

    toastWrap.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 7000);
  }

  function updateBadge(count) {
    // Portal badge
    if (portalBadge) {
      if (count > 0) {
        portalBadge.textContent = count > 9 ? '9+' : String(count);
        portalBadge.style.display = '';
      } else {
        portalBadge.style.display = 'none';
      }
    }
    // Staff badge (may not exist if count was 0 at render — create if needed)
    var bellBtn = document.getElementById('notifDropdown');
    if (staffBadge) {
      if (count > 0) {
        staffBadge.textContent = count > 9 ? '9+' : String(count);
        staffBadge.style.display = '';
      } else {
        staffBadge.style.display = 'none';
      }
    } else if (bellBtn && count > 0) {
      var b = document.createElement('span');
      b.className = 'notif-badge';
      b.textContent = count > 9 ? '9+' : String(count);
      bellBtn.appendChild(b);
      staffBadge = b;
    }
  }

  function renderPortalList(items) {
    if (!portalList) return;
    if (!items || items.length === 0) {
      portalList.innerHTML = '<div class="portal-notif-empty">No notifications yet</div>';
      return;
    }
    var html = '';
    items.forEach(function (n) {
      html +=
        '<a href="' + (n.link || '/portal/notifications') + '" class="portal-notif-item ' + (n.is_read ? '' : 'unread') + '">' +
          '<div class="portal-notif-icon notif-' + (n.type || 'system') + '"><i class="fas ' + iconFor(n.type) + '"></i></div>' +
          '<div class="portal-notif-text">' +
            '<div class="portal-notif-title">' + escapeHtml(n.title) + '</div>' +
            '<div class="portal-notif-msg">' + escapeHtml(n.message) + '</div>' +
            '<div class="portal-notif-time">' + timeAgo(n.created_at) + '</div>' +
          '</div>' +
        '</a>';
    });
    portalList.innerHTML = html;
  }

  function poll() {
    fetch('/notifications/feed', { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('not ok');
        return r.json();
      })
      .then(function (data) {
        if (!data || !data.success) return;

        updateBadge(data.unread || 0);
        renderPortalList(data.items || []);

        // First poll: record what we've already seen, don't toast old items
        if (seenIds === null) {
          seenIds = new Set((data.items || []).map(function (n) { return n.id; }));
          return;
        }

        // Toast any UNREAD item we haven't seen yet
        (data.items || []).forEach(function (n) {
          if (!seenIds.has(n.id)) {
            seenIds.add(n.id);
            if (!n.is_read) showToast(n);
          }
        });
      })
      .catch(function () { /* offline / not logged in — ignore this cycle */ });
  }

  // Mark-all-read (portal)
  if (markAllBtn) {
    markAllBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      fetch('/notifications/read-all', { method: 'POST', credentials: 'same-origin' })
        .then(function () {
          updateBadge(0);
          // Grey-out unread styling in the currently rendered list
          if (portalList) {
            portalList.querySelectorAll('.portal-notif-item.unread').forEach(function (el) {
              el.classList.remove('unread');
            });
          }
        })
        .catch(function () {});
    });
  }

  // Kick off
  poll();
  pollTimer = setInterval(poll, POLL_MS);

  // Pause polling when tab is hidden, resume when visible (saves requests)
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      clearInterval(pollTimer);
    } else {
      poll();
      pollTimer = setInterval(poll, POLL_MS);
    }
  });

})();
