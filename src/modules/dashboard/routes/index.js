/**
 * Dashboard Routes - Postgres Compatible
 */
'use strict';

const express = require('express');
const db      = require('../../../config/database');
const { requireAuth } = require('../../../middleware/auth');

const router = express.Router();

// ── Entry point ────────────────────────────────────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  const role = req.session.user.role;
  try {
    switch (role) {
      case 'admin':    return await renderAdmin(req, res);
      case 'staff':    return await renderStaff(req, res);
      case 'customer': return res.redirect('/portal');
      default:         return await renderStaff(req, res);
    }
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Dashboard Error: ' + error.message);
  }
});

// ── Admin Dashboard ─────────────────────────────────────────────────────────
async function renderAdmin(req, res) {
  const today = new Date().toISOString().slice(0, 10);
  
  // Simple stats - just show zeros for now since tables are empty
  const stats = {
    totalReservations: 0,
    todayCheckIns: 0,
    pendingRes: 0,
    pendingPayments: 0,
    availableRooms: 0,
    occupiedRooms: 0,
    totalRooms: 0,
    availableVenues: 0,
    totalVenues: 0,
    occupiedVenues: 0,
    availableCottages: 0,
    totalCottages: 0,
    occupiedCottages: 0,
    upcomingEvents: 0,
    openInquiries: 0,
    totalCustomers: 0,
    avgRating: 0,
    monthRevenue: 0,
    totalRevenue: 0,
    revChange: null,
  };

  try {
    stats.totalReservations = (await db.prepare(`SELECT COUNT(*) AS c FROM reservations`).get())?.c || 0;
    stats.totalRooms = (await db.prepare(`SELECT COUNT(*) AS c FROM rooms WHERE is_active=1`).get())?.c || 0;
    stats.totalVenues = (await db.prepare(`SELECT COUNT(*) AS c FROM venues WHERE is_active=1`).get())?.c || 0;
    stats.totalCottages = (await db.prepare(`SELECT COUNT(*) AS c FROM cottages WHERE is_active=1`).get())?.c || 0;
    stats.totalCustomers = (await db.prepare(`SELECT COUNT(*) AS c FROM customers`).get())?.c || 0;
  } catch (error) {
    console.error('Error fetching stats:', error);
  }

  res.render('dashboard/admin', {
    title:  'Admin Dashboard – Balai-Reserve',
    layout: 'layouts/main',
    stats,
    recentReservations: [],
    upcomingEventsList: [],
    invAlerts: [],
    insights: [],
    revenueChartJson: JSON.stringify([]),
    statusDistJson:   JSON.stringify([]),
  });
}

// ── Staff Dashboard ─────────────────────────────────────────────────────────
async function renderStaff(req, res) {
  const today = new Date().toISOString().slice(0, 10);

  const stats = {
    pendingRes: 0,
    confirmedRes: 0,
    checkedInToday: 0,
    checkOutsToday: 0,
    pendingPayments: 0,
    availableRooms: 0,
    openInquiries: 0,
    upcomingEvents: 0,
  };

  try {
    stats.pendingRes = (await db.prepare(`SELECT COUNT(*) AS c FROM reservations WHERE status='pending'`).get())?.c || 0;
    stats.confirmedRes = (await db.prepare(`SELECT COUNT(*) AS c FROM reservations WHERE status='confirmed'`).get())?.c || 0;
    stats.availableRooms = (await db.prepare(`SELECT COUNT(*) AS c FROM rooms WHERE status='available' AND is_active=1`).get())?.c || 0;
  } catch (error) {
    console.error('Error fetching staff stats:', error);
  }

  res.render('dashboard/reservation-staff', {
    title:  'Reservations Dashboard',
    layout: 'layouts/main',
    stats,
    arrivals: [],
    departures: [],
    pendingList: [],
    recentInquiries: [],
    today,
  });
}

module.exports = router;
