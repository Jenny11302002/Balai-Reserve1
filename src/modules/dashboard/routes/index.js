/**
 * Dashboard Routes
 *
 * Dispatches to a role-specific handler.
 *
 *  admin    → full business overview: revenue, occupancy, AI insights
 *  staff    → operational dashboard: bookings, check-ins, payments, inquiries
 *  customer → redirected to /portal (their self-service area)
 */
'use strict';

const express = require('express');
const db      = require('../../../config/database');
const { requireAuth } = require('../../../middleware/auth');

const router = express.Router();

// ── Entry point ────────────────────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const role = req.session.user.role;
  switch (role) {
    case 'admin':    return renderAdmin(req, res);
    case 'staff':    return renderStaff(req, res);
    case 'customer': return res.redirect('/portal');
    default:         return renderStaff(req, res);   // fallback for any staff-like role
  }
});

// ── Admin Dashboard ─────────────────────────────────────────────────────────
function renderAdmin(req, res) {
  const today     = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1))
    .toISOString().slice(0, 7);

  const totalReservations = db.prepare(`SELECT COUNT(*) AS c FROM reservations`).get().c;
  const todayCheckIns     = db.prepare(`SELECT COUNT(*) AS c FROM reservations WHERE DATE(check_in_date)=? AND status IN ('confirmed','checked_in')`).get(today).c;
  const pendingRes        = db.prepare(`SELECT COUNT(*) AS c FROM reservations WHERE status='pending'`).get().c;
  const pendingPayments   = db.prepare(`SELECT COUNT(*) AS c FROM reservations WHERE payment_status IN ('unpaid','partially_paid') AND status NOT IN ('cancelled','rejected')`).get().c;
  const availableRooms    = db.prepare(`SELECT COUNT(*) AS c FROM rooms WHERE status='available' AND is_active=1`).get().c;
  const occupiedRooms     = db.prepare(`SELECT COUNT(*) AS c FROM rooms WHERE status='occupied'`).get().c;
  const totalRooms        = db.prepare(`SELECT COUNT(*) AS c FROM rooms WHERE is_active=1`).get().c;
  const availableVenues   = db.prepare(`SELECT COUNT(*) AS c FROM venues WHERE status='available' AND is_active=1`).get().c;
  const totalVenues       = db.prepare(`SELECT COUNT(*) AS c FROM venues WHERE is_active=1`).get().c;
  const occupiedVenues    = db.prepare(`SELECT COUNT(*) AS c FROM venues WHERE status IN ('reserved','occupied') AND is_active=1`).get().c;
  const availableCottages = db.prepare(`SELECT COUNT(*) AS c FROM cottages WHERE status='available' AND is_active=1`).get().c;
  const totalCottages     = db.prepare(`SELECT COUNT(*) AS c FROM cottages WHERE is_active=1`).get().c;
  const occupiedCottages  = db.prepare(`SELECT COUNT(*) AS c FROM cottages WHERE status IN ('reserved','occupied') AND is_active=1`).get().c;
  const upcomingEvents    = db.prepare(`SELECT COUNT(*) AS c FROM events WHERE event_date>=? AND status NOT IN ('completed','cancelled')`).get(today).c;
  const openInquiries     = db.prepare(`SELECT COUNT(*) AS c FROM inquiries WHERE status IN ('open','in_progress')`).get().c;
  const totalCustomers    = db.prepare(`SELECT COUNT(*) AS c FROM customers`).get().c;
  const avgRating         = db.prepare(`SELECT ROUND(AVG(rating),1) AS a FROM feedback`).get().a || 0;

  // Revenue counts both 'received' and 'verified' payments (a verified payment
  // is real, collected money). Refunded/rejected payments are excluded.
  const monthRevRow  = db.prepare(`SELECT COALESCE(SUM(amount),0) AS t FROM payments WHERE status IN ('received','verified') AND strftime('%Y-%m',payment_date)=?`).get(thisMonth);
  const lastMonthRev = db.prepare(`SELECT COALESCE(SUM(amount),0) AS t FROM payments WHERE status IN ('received','verified') AND strftime('%Y-%m',payment_date)=?`).get(lastMonth).t;
  const totalRevRow  = db.prepare(`SELECT COALESCE(SUM(amount),0) AS t FROM payments WHERE status IN ('received','verified')`).get();
  const revChange    = lastMonthRev > 0
    ? Math.round(((monthRevRow.t - lastMonthRev) / lastMonthRev) * 100) : null;

  const revenueChart = db.prepare(`
    SELECT strftime('%Y-%m',payment_date) AS month, SUM(amount) AS revenue
    FROM payments WHERE status IN ('received','verified') AND payment_date>=date('now','-6 months')
    GROUP BY month ORDER BY month`).all();

  const statusDist = db.prepare(`SELECT status, COUNT(*) AS cnt FROM reservations GROUP BY status`).all();

  const recentReservations = db.prepare(`
    SELECT r.*, c.first_name||' '||c.last_name AS customer_name
    FROM reservations r JOIN customers c ON c.id=r.customer_id
    ORDER BY r.created_at DESC LIMIT 8`).all();

  const invAlerts = db.prepare(`
    SELECT name, available_qty, reorder_level
    FROM inventory_items WHERE available_qty<=reorder_level AND is_active=1 LIMIT 5`).all();

  const insights = db.prepare(`
    SELECT * FROM ai_insights WHERE is_dismissed=0 ORDER BY created_at DESC LIMIT 4`).all();

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const upcomingEventsList = db.prepare(`
    SELECT e.*, c.first_name||' '||c.last_name AS customer_name, v.name AS venue_name
    FROM events e JOIN customers c ON c.id=e.customer_id
    LEFT JOIN venues v ON v.id=e.venue_id
    WHERE e.event_date BETWEEN ? AND ? AND e.status NOT IN ('completed','cancelled')
    ORDER BY e.event_date LIMIT 5`).all(today, nextWeek.toISOString().slice(0, 10));

  res.render('dashboard/admin', {
    title:  'Admin Dashboard – Balai-Reserve',
    layout: 'layouts/main',
    stats: {
      totalReservations, todayCheckIns, pendingRes, pendingPayments,
      availableRooms, occupiedRooms, totalRooms,
      availableVenues, totalVenues, occupiedVenues,
      availableCottages, totalCottages, occupiedCottages,
      upcomingEvents, openInquiries, totalCustomers, avgRating,
      monthRevenue: monthRevRow.t,
      totalRevenue: totalRevRow.t,
      revChange,
    },
    recentReservations,
    upcomingEventsList,
    invAlerts,
    insights,
    revenueChartJson: JSON.stringify(revenueChart),
    statusDistJson:   JSON.stringify(statusDist),
  });
}

// ── Staff Dashboard (unified) ──────────────────────────────────────────────
function renderStaff(req, res) {
  const today = new Date().toISOString().slice(0, 10);

  const pendingRes      = db.prepare(`SELECT COUNT(*) AS c FROM reservations WHERE status='pending'`).get().c;
  const confirmedRes    = db.prepare(`SELECT COUNT(*) AS c FROM reservations WHERE status='confirmed'`).get().c;
  const checkedInToday  = db.prepare(`SELECT COUNT(*) AS c FROM reservations WHERE DATE(check_in_date)=? AND status='checked_in'`).get(today).c;
  const checkOutsToday  = db.prepare(`SELECT COUNT(*) AS c FROM reservations WHERE DATE(check_out_date)=? AND status='checked_in'`).get(today).c;
  const pendingPayments = db.prepare(`SELECT COUNT(*) AS c FROM reservations WHERE payment_status IN ('unpaid','partially_paid') AND status NOT IN ('cancelled','rejected','completed')`).get().c;
  const availableRooms  = db.prepare(`SELECT COUNT(*) AS c FROM rooms WHERE status='available' AND is_active=1`).get().c;
  const openInquiries   = db.prepare(`SELECT COUNT(*) AS c FROM inquiries WHERE status IN ('open','in_progress')`).get().c;
  const upcomingEvents  = db.prepare(`SELECT COUNT(*) AS c FROM events WHERE event_date>=? AND status NOT IN ('completed','cancelled')`).get(today).c;

  // Today's arrivals
  const arrivals = db.prepare(`
    SELECT r.*, c.first_name||' '||c.last_name AS customer_name, c.phone AS customer_phone
    FROM reservations r JOIN customers c ON c.id=r.customer_id
    WHERE DATE(r.check_in_date)=? AND r.status IN ('confirmed','awaiting_payment','pending')
    ORDER BY r.check_in_date LIMIT 10`).all(today);

  // Today's departures
  const departures = db.prepare(`
    SELECT r.*, c.first_name||' '||c.last_name AS customer_name
    FROM reservations r JOIN customers c ON c.id=r.customer_id
    WHERE DATE(r.check_out_date)=? AND r.status='checked_in'
    ORDER BY r.check_out_date LIMIT 10`).all(today);

  // Pending reservations needing attention
  const pendingList = db.prepare(`
    SELECT r.*, c.first_name||' '||c.last_name AS customer_name
    FROM reservations r JOIN customers c ON c.id=r.customer_id
    WHERE r.status='pending'
    ORDER BY r.created_at ASC LIMIT 8`).all();

  // Recent inquiries
  const recentInquiries = db.prepare(`
    SELECT * FROM inquiries WHERE status IN ('open','in_progress')
    ORDER BY created_at DESC LIMIT 6`).all();

  res.render('dashboard/reservation-staff', {
    title:  'Reservations Dashboard',
    layout: 'layouts/main',
    stats: { pendingRes, confirmedRes, checkedInToday, checkOutsToday, pendingPayments, availableRooms, openInquiries, upcomingEvents },
    arrivals,
    departures,
    pendingList,
    recentInquiries,
    today,
  });
}

module.exports = router;
