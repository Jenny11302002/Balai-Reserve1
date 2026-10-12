/**
 * Venue Management Routes
 */
'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');
const db      = require('../../../config/database');
const { requireAuth, requireRole } = require('../../../middleware/auth');

const router  = express.Router();
const CAN_MANAGE = ['admin', 'staff'];

// Only venue_types that exist on at least one active venue
function getActiveVenueTypes() {
  return db.prepare(
    `SELECT DISTINCT venue_type FROM venues WHERE is_active = 1 ORDER BY venue_type`
  ).all().map(r => r.venue_type);
}

// GET /venues
router.get('/', requireAuth, (req, res) => {
  const { search = '', status = '', type = '', page = 1 } = req.query;
  const limit  = 12;
  const offset = (parseInt(page) - 1) * limit;
  let   where  = 'WHERE is_active = 1';
  const params = [];

  if (search) { where += ` AND (name LIKE ? OR description LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }
  if (status) { where += ` AND status = ?`;     params.push(status); }
  if (type)   { where += ` AND venue_type = ?`; params.push(type); }

  const total  = db.prepare(`SELECT COUNT(*) AS cnt FROM venues ${where}`).get(...params).cnt;
  const venues = db.prepare(`SELECT * FROM venues ${where} ORDER BY name LIMIT ? OFFSET ?`).all(...params, limit, offset);

  const venueTypes = getActiveVenueTypes();
  const statuses   = ['available','reserved','maintenance','unavailable'];

  res.render('venues/index', {
    title: 'Venues – Balai-Reserve',
    layout: 'layouts/main',
    venues, venueTypes, statuses,
    filters: { search, status, type },
    pagination: { total, page: parseInt(page), limit, totalPages: Math.ceil(total / limit) },
  });
});

// GET /venues/new
router.get('/new', requireAuth, requireRole(...CAN_MANAGE), (req, res) => {
  const venueTypes = getActiveVenueTypes();
  res.render('venues/form', { title: 'Add Venue', layout: 'layouts/main', venue: null, venueTypes, errors: [], old: {} });
});

// POST /venues
router.post('/',
  requireAuth, requireRole(...CAN_MANAGE),
  [
    body('name').trim().notEmpty().withMessage('Venue name is required.'),
    body('venue_type').notEmpty().withMessage('Venue type is required.'),
    body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1.'),
    body('price').isFloat({ min: 0 }).withMessage('Enter a valid price.'),
  ],
  (req, res) => {
    const venueTypes = getActiveVenueTypes();
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('venues/form', { title: 'Add Venue', layout: 'layouts/main', venue: null, venueTypes, errors: errors.array(), old: req.body });
    }
    const { name, venue_type, capacity, description, location, price, price_note, amenities, status } = req.body;
    const amenitiesJson = amenities ? JSON.stringify(amenities.split(',').map(a => a.trim()).filter(Boolean)) : '[]';

    db.prepare(`
      INSERT INTO venues (name, venue_type, capacity, description, location, price, price_note, amenities, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, venue_type, capacity, description || '', location || '', price, price_note || '', amenitiesJson, status || 'available');

    req.audit('create', 'venues', null, null, { name, venue_type });
    req.session.flash = { success: `Venue "${name}" created successfully.` };
    res.redirect('/venues');
  }
);

// GET /venues/:id
router.get('/:id', requireAuth, (req, res) => {
  const venue = db.prepare(`SELECT * FROM venues WHERE id = ?`).get(req.params.id);
  if (!venue) { req.session.flash = { error: 'Venue not found.' }; return res.redirect('/venues'); }
  try { venue.amenitiesList = JSON.parse(venue.amenities || '[]'); } catch { venue.amenitiesList = []; }

  const reservations = db.prepare(`
    SELECT r.*, c.first_name || ' ' || c.last_name AS customer_name
    FROM reservations r
    JOIN reservation_items ri ON ri.reservation_id = r.id
    JOIN customers c ON c.id = r.customer_id
    WHERE ri.item_type = 'venue' AND ri.item_id = ?
    ORDER BY r.created_at DESC LIMIT 10
  `).all(venue.id);

  res.render('venues/show', { title: venue.name, layout: 'layouts/main', venue, reservations });
});

// GET /venues/:id/edit
router.get('/:id/edit', requireAuth, requireRole(...CAN_MANAGE), (req, res) => {
  const venue = db.prepare(`SELECT * FROM venues WHERE id = ?`).get(req.params.id);
  if (!venue) { req.session.flash = { error: 'Venue not found.' }; return res.redirect('/venues'); }
  const venueTypes = getActiveVenueTypes();
  try { venue.amenitiesStr = JSON.parse(venue.amenities || '[]').join(', '); } catch { venue.amenitiesStr = ''; }
  res.render('venues/form', { title: `Edit ${venue.name}`, layout: 'layouts/main', venue, venueTypes, errors: [], old: venue });
});

// POST /venues/:id/edit
router.post('/:id/edit',
  requireAuth, requireRole(...CAN_MANAGE),
  [
    body('name').trim().notEmpty().withMessage('Venue name is required.'),
    body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1.'),
    body('price').isFloat({ min: 0 }).withMessage('Enter a valid price.'),
  ],
  (req, res) => {
    const old = db.prepare(`SELECT * FROM venues WHERE id = ?`).get(req.params.id);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const venueTypes = getActiveVenueTypes();
      return res.render('venues/form', { title: 'Edit Venue', layout: 'layouts/main', venue: old, venueTypes, errors: errors.array(), old: req.body });
    }
    const { name, venue_type, capacity, description, location, price, price_note, amenities, status } = req.body;
    const amenitiesJson = amenities ? JSON.stringify(amenities.split(',').map(a => a.trim()).filter(Boolean)) : '[]';

    db.prepare(`
      UPDATE venues SET name=?, venue_type=?, capacity=?, description=?, location=?, price=?, price_note=?, amenities=?, status=?, updated_at=datetime('now')
      WHERE id=?
    `).run(name, venue_type, capacity, description || '', location || '', price, price_note || '', amenitiesJson, status, req.params.id);

    req.audit('update', 'venues', req.params.id, old, { name, price, status });
    req.session.flash = { success: 'Venue updated successfully.' };
    res.redirect(`/venues/${req.params.id}`);
  }
);

module.exports = router;
