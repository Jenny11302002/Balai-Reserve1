/**
 * Xianfire Template Helpers
 * 
 * Functions made available in every .xian template via app.locals.
 * Import and attach with: app.use(xianHelpers);
 */

'use strict';

const dayjs = require('dayjs');

// ─── Date / Time ─────────────────────────────────────────────────────────────

/**
 * Format a date value using dayjs.
 * @param {string|Date} date
 * @param {string} fmt  — dayjs format string, default 'MMM D, YYYY'
 */
function formatDate(date, fmt = 'MMM D, YYYY') {
  if (!date) return '—';
  return dayjs(date).format(fmt);
}

/**
 * Format a datetime value.
 */
function formatDateTime(date, fmt = 'MMM D, YYYY h:mm A') {
  if (!date) return '—';
  return dayjs(date).format(fmt);
}

/**
 * Returns 'active' if the current path starts with the given prefix.
 * Useful for sidebar nav highlighting.
 */
function activeNav(currentPath, prefix) {
  return currentPath && currentPath.startsWith(prefix) ? 'active' : '';
}

// ─── Currency ─────────────────────────────────────────────────────────────────

/**
 * Format a number as Philippine Peso.
 */
function formatPeso(amount) {
  if (amount == null || amount === '') return '—';
  return '₱' + Number(amount).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  // Reservation
  pending:           'badge-warning',
  awaiting_payment:  'badge-info',
  confirmed:         'badge-success',
  checked_in:        'badge-primary',
  completed:         'badge-secondary',
  cancelled:         'badge-danger',
  rejected:          'badge-danger',
  no_show:           'badge-dark',
  // Room
  available:         'badge-success',
  reserved:          'badge-warning',
  occupied:          'badge-primary',
  cleaning:          'badge-info',
  maintenance:       'badge-secondary',
  unavailable:       'badge-danger',
  // Payment
  unpaid:            'badge-danger',
  partially_paid:    'badge-warning',
  fully_paid:        'badge-success',
  refunded:          'badge-info',
  // Equipment condition
  excellent:         'badge-success',
  good:              'badge-primary',
  needs_maintenance: 'badge-warning',
  damaged:           'badge-danger',
  lost:              'badge-dark',
  // Tickets
  open:              'badge-warning',
  in_progress:       'badge-info',
  resolved:          'badge-success',
  closed:            'badge-secondary',
};

/**
 * Returns an HTML badge span for a given status string.
 */
function statusBadge(status) {
  if (!status) return '';
  const key   = status.toLowerCase().replace(/\s+/g, '_');
  const cls   = STATUS_COLORS[key] || 'badge-secondary';
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  return `<span class="badge ${cls}">${label}</span>`;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

/**
 * Build a simple pagination object.
 * @param {number} total   — total records
 * @param {number} page    — current page (1-indexed)
 * @param {number} limit   — records per page
 */
function paginate(total, page, limit = 20) {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    offset: (page - 1) * limit,
    hasPrev: page > 1,
    hasNext: page < totalPages,
    prevPage: page - 1,
    nextPage: page + 1,
  };
}

// ─── Express middleware — attach helpers to res.locals ────────────────────────

function xianHelpersMiddleware(req, res, next) {
  // Attach pure helper functions — these never change per-request
  res.locals.formatDate     = formatDate;
  res.locals.formatDateTime = formatDateTime;
  res.locals.formatPeso     = formatPeso;
  res.locals.statusBadge    = statusBadge;
  res.locals.activeNav      = activeNav;
  res.locals.paginate       = paginate;
  // NOTE: currentUser, currentPath, and flash are set in the
  // dedicated global middleware block in app.js so there is a
  // single authoritative place.  Do NOT set or clear them here.
  next();
}

module.exports = {
  formatDate,
  formatDateTime,
  formatPeso,
  statusBadge,
  activeNav,
  paginate,
  xianHelpersMiddleware,
};
