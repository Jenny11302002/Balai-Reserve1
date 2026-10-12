/**
 * Booking Reference Generator
 */
'use strict';

const db = require('../config/database');

function generateBookingRef() {
  const year = new Date().getFullYear();
  const row  = db.prepare(`
    SELECT COUNT(*) AS cnt FROM reservations WHERE booking_ref LIKE ?
  `).get(`BK-${year}-%`);
  const seq  = String((row.cnt || 0) + 1).padStart(4, '0');
  return `BK-${year}-${seq}`;
}

function generateTicketNumber() {
  const row = db.prepare(`SELECT COUNT(*) AS cnt FROM support_tickets`).get();
  const seq = String((row.cnt || 0) + 1).padStart(3, '0');
  return `TKT-${seq}`;
}

function generateCustomerCode() {
  const row = db.prepare(`SELECT COUNT(*) AS cnt FROM customers`).get();
  const seq = String((row.cnt || 0) + 1).padStart(3, '0');
  return `CUS-${seq}`;
}

module.exports = { generateBookingRef, generateTicketNumber, generateCustomerCode };
