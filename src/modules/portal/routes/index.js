/**
 * Customer Portal Routes  (/portal)
 *
 * Fixes applied:
 *  - Fix 2: Server-side price calculation — never trust client total_amount
 *  - Fix 3: Balance / "Fully Paid" logic passes correct flags to view
 *  - Fix 5: submit-payment — multer proof upload, prevents duplicate pending
 *           submissions, updates payment_status to 'partially_paid'
 *  - Fix 8: Balance calculation filters only non-refunded payments
 */
'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const multer  = require('multer');
const bcrypt  = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db      = require('../../../config/database');
const { requireAuth, requireRole } = require('../../../middleware/auth');
const { generateBookingRef }       = require('../../../utils/bookingRef');
const { generateReservationQR }    = require('../../../utils/qrGenerator');
const { notifyAllAdmins, notifyUser } = require('../../../utils/notifications');
const { validateGcashScreenshot }     = require('../../../utils/gcashValidator');
const { calculateCottageTotal, validateCottageTimeRange } = require('../../../utils/cottagePricing');

const router = express.Router();

// ── Multer: payment proof images ────────────────────────────────────────────
const PROOF_DIR = path.join(process.cwd(), 'uploads', 'payment_proofs');
if (!fs.existsSync(PROOF_DIR)) fs.mkdirSync(PROOF_DIR, { recursive: true });

const proofStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PROOF_DIR),
  filename:    (_req, file, cb) => {
    // Cryptographically-random, unguessable filename (prevents URL enumeration).
    const ext   = path.extname(file.originalname).toLowerCase();
    const token = crypto.randomBytes(24).toString('hex');
    cb(null, 'proof-' + token + ext);
  },
});
const proofUpload = multer({
  storage: proofStorage,
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ok = ['.jpg','.jpeg','.png','.webp','.gif','.pdf'].includes(
      path.extname(file.originalname).toLowerCase()
    );
    cb(ok ? null : new Error('Only images and PDF files are allowed.'), ok);
  },
});

// ── Auth helpers ────────────────────────────────────────────────────────────
const STAFF_ROLES = ['admin','staff'];

function requireCustomerOrGuest(req, res, next) {
  if (req.session?.user && STAFF_ROLES.includes(req.session.user.role)) {
    return res.redirect('/dashboard');
  }
  next();
}

function requireCustomer(req, res, next) {
  if (!req.session?.user) {
    req.session.flash    = { error: 'Please sign in to continue.' };
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }
  if (STAFF_ROLES.includes(req.session.user.role)) {
    return res.redirect('/dashboard');
  }
  next();
}

// ── Shared portal locals ────────────────────────────────────────────────────
router.use((req, res, next) => {
  res.locals.portalLayout = 'layouts/portal';

  // Load payment account settings so every portal view can show real account details.
  // Defaults are shown if the setting key hasn't been configured yet.
  try {
    const settingKeys = ['gcash_number','gcash_name','maya_number','maya_name','bank_bdo','bank_bpi','bank_name','gcash_qr_path','maya_qr_path'];
    const rows = db.prepare(
      `SELECT key, value FROM settings WHERE key IN (${settingKeys.map(() => '?').join(',')})`
    ).all(...settingKeys);
    const pm = {};
    for (const r of rows) pm[r.key] = r.value || '';
    res.locals.paymentInfo = {
      gcash_number: pm.gcash_number  || '—',
      gcash_name:   pm.gcash_name    || 'Balai Miciano Resort',
      maya_number:  pm.maya_number   || '—',
      maya_name:    pm.maya_name     || 'Balai Miciano Resort',
      bank_bdo:     pm.bank_bdo      || '—',
      bank_bpi:     pm.bank_bpi      || '—',
      bank_name:    pm.bank_name     || 'Balai Miciano Resort',
      gcash_qr_path: pm.gcash_qr_path || '',
      maya_qr_path: pm.maya_qr_path || '',
    };
  } catch { res.locals.paymentInfo = {}; }

  next();
});

// ── Helper: server-side price calculation ───────────────────────────────────
/**
 * Calculate the correct total for a booking entirely on the server.
 * Never trust the client-submitted total_amount.
 *
 * @param {string}   reservation_type
 * @param {number|null} roomId
 * @param {number|null} venueId
 * @param {number|null} pkgId
 * @param {string|null} ciDate
 * @param {string|null} coDate
 * @param {string|null} startTime
 * @param {string|null} endTime
 * @param {Array}    selectedInclusions  — array of {name, price} from the form;
 *                                         server validates each against the package's
 *                                         actual inclusions to prevent price tampering
 */
function calculateServerTotal(reservation_type, roomId, venueId, pkgId, ciDate, coDate, startTime, endTime, selectedInclusions = []) {
  let total = 0;

  if (reservation_type === 'room' && roomId) {
    const room = db.prepare('SELECT price FROM rooms WHERE id = ?').get(roomId);
    if (room && ciDate && coDate) {
      const nights = Math.ceil((new Date(coDate) - new Date(ciDate)) / 86400000);
      total = (room.price || 0) * Math.max(nights, 1);
    } else if (room) {
      total = room.price || 0;
    }
  } else if (reservation_type === 'venue' && venueId) {
    const venue = db.prepare('SELECT price FROM venues WHERE id = ?').get(venueId);
    total = venue ? (venue.price || 0) : 0;
  } else if (reservation_type === 'cottage' && roomId) {
    const cottage = db.prepare('SELECT name, price FROM cottages WHERE id = ?').get(roomId);
    const wholeDayRate = cottage?.name.trim().toLowerCase() === 'umbrella table';
    total = cottage && (wholeDayRate || validateCottageTimeRange(startTime, endTime))
      ? calculateCottageTotal(cottage.price, startTime, endTime, wholeDayRate)
      : 0;
  } else if (reservation_type === 'event' && venueId) {
    const venue = db.prepare('SELECT price FROM venues WHERE id = ?').get(venueId);
    total = venue ? (venue.price || 0) : 0;
  }

  // Add base package price
  if (pkgId) {
    const pkg = db.prepare('SELECT price, inclusions FROM event_packages WHERE id = ?').get(pkgId);
    if (pkg) {
      total += pkg.price || 0;

      // Validate and sum optional add-on prices submitted by the client.
      // We re-read each inclusion's price from the DB so the client cannot
      // inflate prices by submitting arbitrary amounts.
      if (selectedInclusions.length > 0) {
        let allInclusions = [];
        try { allInclusions = JSON.parse(pkg.inclusions || '[]'); } catch { allInclusions = []; }

        // Build a trusted map: inclusion name → price (only optional add-ons with price > 0)
        const addonMap = new Map();
        for (const inc of allInclusions) {
          if (inc.is_optional && inc.price > 0) {
            addonMap.set(inc.name, inc.price);
          }
        }

        // Sum only inclusions that exist in the trusted map
        for (const sel of selectedInclusions) {
          const name = (sel.name || '').trim();
          if (addonMap.has(name)) {
            total += addonMap.get(name);
          }
        }
      }
    }
  }

  return total;
}

// ── GET /portal ─────────────────────────────────────────────────────────────
router.get('/', requireCustomerOrGuest, (req, res) => {
  const availableRooms  = db.prepare('SELECT COUNT(*) AS c FROM rooms  WHERE status=\'available\' AND is_active=1').get().c;
  const availableVenues = db.prepare('SELECT COUNT(*) AS c FROM venues WHERE status=\'available\' AND is_active=1').get().c;
  const availableCottages = db.prepare('SELECT COUNT(*) AS c FROM cottages WHERE status=\'available\' AND is_active=1').get().c;

  const featuredRooms = db.prepare(
    'SELECT r.*, rt.name AS type_name FROM rooms r JOIN room_types rt ON rt.id=r.room_type_id WHERE r.status=\'available\' AND r.is_active=1 ORDER BY r.price LIMIT 3'
  ).all();
  for (const r of featuredRooms) {
    try { r.imagesList = JSON.parse(r.images || '[]'); } catch { r.imagesList = []; }
  }

  const featuredVenues = db.prepare(
    'SELECT * FROM venues WHERE status=\'available\' AND is_active=1 ORDER BY price LIMIT 3'
  ).all();
  for (const v of featuredVenues) {
    try { v.imagesList = JSON.parse(v.images || '[]'); } catch { v.imagesList = []; }
  }

  const featuredCottages = db.prepare(
    'SELECT * FROM cottages WHERE status=\'available\' AND is_active=1 ORDER BY price LIMIT 3'
  ).all();
  for (const c of featuredCottages) {
    try { c.imagesList = JSON.parse(c.images || '[]'); } catch { c.imagesList = []; }
  }

  const packages = db.prepare('SELECT * FROM event_packages WHERE is_active=1 ORDER BY price LIMIT 4').all();

  res.render('portal/home', {
    title: 'Welcome to Balai-Reserve',
    layout: 'layouts/portal',
    availableRooms, availableVenues, availableCottages,
    featuredRooms, featuredVenues, featuredCottages, packages,
  });
});

// ── GET /portal/rooms ────────────────────────────────────────────────────────
router.get('/rooms', requireCustomerOrGuest, (req, res) => {
  const { checkin = '', checkout = '', guests = '', type = '', sort = 'price_asc' } = req.query;
  // Show every active room; availability is reflected per-card (booked rooms
  // are shown as "Unavailable" instead of being hidden).
  let   where  = 'WHERE r.is_active=1';
  const params = [];

  if (type)   { where += ' AND rt.name=?';    params.push(type); }
  if (guests) { where += ' AND r.capacity>=?'; params.push(parseInt(guests)); }

  // Set of room ids that are booked for the requested date range (if given).
  let bookedIds = new Set();
  if (checkin && checkout) {
    const rows = db.prepare(`
      SELECT ri.item_id FROM reservation_items ri
      JOIN reservations res ON res.id=ri.reservation_id
      WHERE ri.item_type='room'
        AND res.status NOT IN ('cancelled','rejected','completed','no_show')
        AND (res.check_in_date < ? AND res.check_out_date > ?)
    `).all(checkout, checkin);
    bookedIds = new Set(rows.map(r => r.item_id));
  }

  const orderBy = sort === 'price_desc' ? 'r.price DESC' : 'r.price ASC';

  const rooms = db.prepare(
    `SELECT r.*, rt.name AS type_name FROM rooms r JOIN room_types rt ON rt.id=r.room_type_id ${where} ORDER BY ${orderBy}`
  ).all(...params);

  // Parse images and compute availability for each room.
  for (const r of rooms) {
    try { r.imagesList = JSON.parse(r.images || '[]'); } catch { r.imagesList = []; }
    // Available when the room's status is 'available' AND (if dates were given)
    // it isn't already booked for that range.
    r.isAvailable = (r.status === 'available') && !bookedIds.has(r.id);
  }

  const roomTypes = db.prepare('SELECT DISTINCT rt.name FROM room_types rt JOIN rooms r ON r.room_type_id = rt.id WHERE r.is_active = 1 ORDER BY rt.name').all();

  res.render('portal/rooms', {
    title: 'Browse Rooms – Balai-Reserve',
    layout: 'layouts/portal',
    rooms, roomTypes,
    filters: { checkin, checkout, guests, type, sort },
  });
});

// ── GET /portal/venues ───────────────────────────────────────────────────────
router.get('/venues', requireCustomerOrGuest, (req, res) => {
  const { date = '', guests = '', type = '', sort = 'price_asc' } = req.query;
  // Show all active venues; booked ones render as "Unavailable".
  let   where  = 'WHERE is_active=1';
  const params = [];

  if (type)   { where += ' AND venue_type=?'; params.push(type); }
  if (guests) { where += ' AND capacity>=?';  params.push(parseInt(guests)); }

  const orderBy = sort === 'price_desc' ? 'price DESC' : 'price ASC';

  const venues = db.prepare(`SELECT * FROM venues ${where} ORDER BY ${orderBy}`).all(...params);

  // Parse images and compute availability
  for (const v of venues) {
    try { v.imagesList = JSON.parse(v.images || '[]'); } catch { v.imagesList = []; }
    try { v.amenitiesList = JSON.parse(v.amenities || '[]'); } catch { v.amenitiesList = []; }
    v.isAvailable = (v.status === 'available');
  }

  const venueTypes = db.prepare(
    `SELECT DISTINCT venue_type FROM venues WHERE is_active = 1 ORDER BY venue_type`
  ).all().map(r => r.venue_type);
  const packages   = db.prepare('SELECT * FROM event_packages WHERE is_active=1 ORDER BY price').all();

  // Parse inclusions for packages
  for (const p of packages) {
    try { p.inclusionsList = JSON.parse(p.inclusions || '[]'); } catch { p.inclusionsList = []; }
  }

  res.render('portal/venues', {
    title: 'Browse Venues – Balai-Reserve',
    layout: 'layouts/portal',
    venues, venueTypes, packages,
    filters: { date, guests, type, sort },
  });
});

// ── GET /portal/cottages ─────────────────────────────────────────────────────
router.get('/cottages', requireCustomerOrGuest, (req, res) => {
  const { date = '', guests = '', sort = 'price_asc', max_price = '' } = req.query;
  // Show all active cottages; booked ones render as "Unavailable".
  let   where  = 'WHERE is_active=1';
  const params = [];

  if (guests)    { where += ' AND capacity>=?'; params.push(parseInt(guests)); }
  if (max_price) { where += ' AND price<=?';    params.push(parseFloat(max_price)); }

  const orderBy = sort === 'price_desc' ? 'price DESC' : 'price ASC';

  const cottages = db.prepare(`SELECT * FROM cottages ${where} ORDER BY ${orderBy}`).all(...params);

  for (const c of cottages) {
    try { c.imagesList = JSON.parse(c.images || '[]'); } catch { c.imagesList = []; }
    try { c.amenitiesList = JSON.parse(c.amenities || '[]'); } catch { c.amenitiesList = []; }
    c.isAvailable = (c.status === 'available');
  }

  res.render('portal/cottages', {
    title: 'Browse Cottages – Balai-Reserve',
    layout: 'layouts/portal',
    cottages,
    filters: { date, guests, sort, max_price },
  });
});

// ── GET /portal/book ─────────────────────────────────────────────────────────
router.get('/book', requireCustomer, (req, res) => {
  const { type = '', item_id = '', package_id = '', checkin = '', checkout = '', date = '' } = req.query;

  const rooms    = db.prepare('SELECT r.*, rt.name AS type_name FROM rooms r JOIN room_types rt ON rt.id=r.room_type_id WHERE r.status=\'available\' AND r.is_active=1 ORDER BY r.price').all();
  const venues   = db.prepare('SELECT * FROM venues WHERE status=\'available\' AND is_active=1 ORDER BY price').all();
  const rawPkgs  = db.prepare('SELECT * FROM event_packages WHERE is_active=1 ORDER BY price').all();

  // Parse image arrays so the booking page can show a gallery of the selected item.
  const parseImgs = (row) => {
    try { row.imagesList = JSON.parse(row.images || '[]'); } catch { row.imagesList = []; }
    return row;
  };
  rooms.forEach(parseImgs);
  venues.forEach(parseImgs);

  // Parse inclusions into structured objects for the template
  const packages = rawPkgs.map(p => {
    let inclusions = [];
    try { inclusions = JSON.parse(p.inclusions || '[]'); } catch { inclusions = []; }

    // Back-compat: if still old flat-string format, wrap into objects
    if (inclusions.length > 0 && typeof inclusions[0] === 'string') {
      inclusions = inclusions.map(s => ({ name: s, price: 0, is_default: 1, is_optional: 0 }));
    }

    return {
      ...p,
      inclusionsList: inclusions,
      defaultInclusions: inclusions.filter(i => i.is_default),
      addonInclusions:   inclusions.filter(i => i.is_optional && i.price > 0),
    };
  });

  let selectedItem = null;
  if (item_id && type === 'room')    selectedItem = db.prepare('SELECT r.*, rt.name AS type_name FROM rooms r JOIN room_types rt ON rt.id=r.room_type_id WHERE r.id=?').get(item_id);
  if (item_id && type === 'venue')   selectedItem = db.prepare('SELECT * FROM venues WHERE id=?').get(item_id);
  if (item_id && type === 'cottage') selectedItem = db.prepare('SELECT * FROM cottages WHERE id=?').get(item_id);

  const cottages = db.prepare('SELECT * FROM cottages WHERE status=\'available\' AND is_active=1 ORDER BY price').all();
  cottages.forEach(parseImgs);
  if (selectedItem) parseImgs(selectedItem);

  // Booking policy settings for the Terms & Conditions modal.
  const policyKeys = ['cancellation_policy','downpayment_percent','check_in_time','check_out_time','resort_name'];
  const policyRows = db.prepare(
    `SELECT key, value FROM settings WHERE key IN (${policyKeys.map(() => '?').join(',')})`
  ).all(...policyKeys);
  const ps = {};
  for (const r of policyRows) ps[r.key] = r.value || '';
  const terms = {
    resortName:        ps.resort_name        || 'Balai Miciano Resort',
    downpaymentPercent: ps.downpayment_percent || '50',
    checkInTime:       ps.check_in_time       || '14:00',
    checkOutTime:      ps.check_out_time      || '12:00',
    cancellationPolicy: ps.cancellation_policy || 'Cancellations made 7 days before the reservation date are eligible for a 50% refund. No refund for cancellations within 48 hours of the reservation date.',
  };

  res.render('portal/book', {
    title:  'Book Now – Balai-Reserve',
    layout: 'layouts/portal',
    rooms, venues, packages,
    cottages,
    filters: { type, item_id, package_id, checkin, checkout, date },
    selectedItem,
    // Lock the item/type selection when the customer arrived from a specific
    // "Book" button (a valid item was pre-chosen on the dashboard).
    lockedSelection: !!(selectedItem && ['room','venue','cottage'].includes(type)),
    terms,
    errors: [], old: {},
  });
});

// ── POST /portal/book ────────────────────────────────────────────────────────
router.post('/book',
  requireCustomer,
  [
    body('reservation_type').notEmpty().withMessage('Please select what you want to book.'),
    body('num_guests').isInt({ min: 1 }).withMessage('Number of guests must be at least 1.'),
    body('payment_method').notEmpty().withMessage('Please select a payment method.'),
    body('contact_phone')
      .trim()
      .notEmpty().withMessage('Please enter your mobile number.')
      .bail()
      .matches(/^(?:\+639|09)\d{9}$/)
      .withMessage('Enter a valid Philippine mobile number, such as +639545425256 or 09545425256.'),
    // Date validation — required fields depend on reservation type
    body('check_in_date').custom((val, { req: r }) => {
      const today = new Date().toISOString().slice(0, 10);
      const v = Array.isArray(val) ? val.find(x => x && String(x).trim()) : val;
      const s = v != null ? String(v).trim() : '';
      if (['room','cottage'].includes(r.body.reservation_type)) {
        if (!s) throw new Error('Please select a valid date.');
        if (isNaN(Date.parse(s))) throw new Error('Please select a valid date.');
        if (s < today) throw new Error('Please select a valid date. The check-in date cannot be in the past.');
      }
      return true;
    }),
    body('check_out_date').custom((val, { req: r }) => {
      const today = new Date().toISOString().slice(0, 10);
      const v = Array.isArray(val) ? val.find(x => x && String(x).trim()) : val;
      const s = v != null ? String(v).trim() : '';
      if (['room'].includes(r.body.reservation_type)) {
        if (!s) throw new Error('Please select a valid date.');
        if (isNaN(Date.parse(s))) throw new Error('Please select a valid date.');
        if (s < today) throw new Error('Please select a valid date. The check-out date cannot be in the past.');
        const ci = Array.isArray(r.body.check_in_date) ? r.body.check_in_date[0] : r.body.check_in_date;
        if (ci && s <= String(ci).trim()) throw new Error('Check-out date must be after check-in date.');
      }
      return true;
    }),
    body('start_time').custom((val, { req: r }) => {
      if (r.body.reservation_type === 'cottage' && !validateCottageTimeRange(val, r.body.end_time)) {
        throw new Error('Time out must be after time in.');
      }
      return true;
    }),
    body('end_time').custom((val, { req: r }) => {
      if (r.body.reservation_type === 'cottage' && !validateCottageTimeRange(r.body.start_time, val)) {
        throw new Error('Time out must be after time in.');
      }
      return true;
    }),
    body('event_date').custom((val, { req: r }) => {
      const today = new Date().toISOString().slice(0, 10);
      const v = Array.isArray(val) ? val.find(x => x && String(x).trim()) : val;
      const s = v != null ? String(v).trim() : '';
      if (['venue','event'].includes(r.body.reservation_type)) {
        if (!s) throw new Error('Please select a valid date.');
        if (isNaN(Date.parse(s))) throw new Error('Please select a valid date.');
        if (s < today) throw new Error('Please select a valid date. The event date cannot be in the past.');
      }
      return true;
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.session.flash = { error: errors.array()[0].msg };
      return res.redirect('/portal/book');
    }

    const user = req.session.user;

    // Normalize fields — any duplicated input names arrive as arrays; take the first non-empty value
    function first(v) { return Array.isArray(v) ? (v.find(x => x != null && String(x).trim() !== '') || '') : (v || ''); }

    const reservation_type  = first(req.body.reservation_type);
    const item_id           = first(req.body.item_id);
    const package_id        = first(req.body.package_id);
    const check_in_date     = first(req.body.check_in_date);
    const check_out_date    = first(req.body.check_out_date);
    const event_date        = first(req.body.event_date);
    const start_time        = first(req.body.start_time);
    const end_time          = first(req.body.end_time);
    const num_guests        = first(req.body.num_guests);
    const special_requests  = first(req.body.special_requests);
    const payment_method    = first(req.body.payment_method);

    // selected_inclusions[] — array of JSON strings: '{"name":"...","price":0}'
    // Parse and validate shape; price is re-verified server-side, never trusted
    let selectedInclusions = [];
    const rawInclusions = Array.isArray(req.body['selected_inclusions[]'])
      ? req.body['selected_inclusions[]']
      : req.body['selected_inclusions[]'] ? [req.body['selected_inclusions[]']] : [];
    for (const raw of rawInclusions) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.name === 'string') {
          selectedInclusions.push({ name: parsed.name.trim(), price: Number(parsed.price) || 0 });
        }
      } catch { /* skip malformed */ }
    }

    // NOTE: total_amount from the form is intentionally IGNORED here.
    // The server recalculates it from the actual item prices.

    const roomId     = item_id    ? parseInt(item_id,    10) : null;
    const venueId    = item_id    ? parseInt(item_id,    10) : null;
    const pkgId      = package_id ? parseInt(package_id, 10) : null;
    const guestCount = parseInt(num_guests, 10) || 1;
    const ciDate     = (check_in_date  || '').trim() || null;
    const coDate     = (check_out_date || '').trim() || null;
    const evDate     = (event_date     || '').trim() || null;
    const stTime     = (start_time     || '').trim() || null;
    const enTime     = (end_time       || '').trim() || null;
    const notes      = (special_requests || '').trim();
    const pmMethod   = (payment_method || 'cash').trim();

    // ── FIX 2: Always calculate price server-side ──────────────────────────
    let itemId = null;
    if (['room','cottage'].includes(reservation_type))   itemId = roomId;
    if (['venue','event'].includes(reservation_type))    itemId = venueId;

    const totalAmt = calculateServerTotal(reservation_type, roomId, venueId, pkgId, ciDate, coDate, stTime, enTime, selectedInclusions);

    // Guard: if price is still 0 after server calculation, the item doesn't exist
    if (totalAmt <= 0) {
      req.session.flash = { error: 'Could not calculate the booking price. Please select a valid room, venue, or package.' };
      return res.redirect('/portal/book');
    }

    const dpAmt  = Math.ceil(totalAmt * 0.5);
    const pmLabel = { gcash:'GCash', bank_transfer:'Bank Transfer (BDO/BPI)', maya:'Maya', cash:'Cash (Walk-in / Front Desk)' }[pmMethod] || pmMethod;

    // ── Find or create customer record ────────────────────────────────────
    let customer = db.prepare('SELECT * FROM customers WHERE user_id = ?').get(user.id);
    if (!customer) {
      const code = 'CUS-' + String(Date.now()).slice(-6);
      db.prepare('INSERT OR IGNORE INTO customers (user_id, customer_code, first_name, last_name, email, status) VALUES (?, ?, ?, ?, ?, ?)').run(
        user.id, code, user.firstName, user.lastName, user.email || '', 'active'
      );
      customer = db.prepare('SELECT * FROM customers WHERE user_id = ?').get(user.id);
    }
    if (!customer) {
      req.session.flash = { error: 'Could not create customer record. Please try again.' };
      return res.redirect('/portal/book');
    }

    // ── Double-booking guard (room only) ──────────────────────────────────
    if (reservation_type === 'room' && roomId && ciDate && coDate) {
      const linkedItems = db.prepare('SELECT reservation_id FROM reservation_items WHERE item_type = ? AND item_id = ?').all('room', roomId);
      for (const li of linkedItems) {
        const existing = db.prepare('SELECT id, status, check_in_date, check_out_date FROM reservations WHERE id = ?').get(li.reservation_id);
        if (!existing) continue;
        if (!['pending','awaiting_payment','confirmed','checked_in'].includes(existing.status)) continue;
        if (!existing.check_in_date || !existing.check_out_date) continue;
        if (existing.check_in_date < coDate && existing.check_out_date > ciDate) {
          req.session.flash = { error: 'Sorry, that room is already reserved for the selected dates. Please choose different dates or another room.' };
          return res.redirect('/portal/rooms');
        }
      }
    }

    const bookingRef = generateBookingRef();

    const resId = db.transaction(() => {
      const newId = db.prepare(
        'INSERT INTO reservations (booking_ref, customer_id, reservation_type, check_in_date, check_out_date, event_date, start_time, end_time, num_guests, special_requests, total_amount, downpayment_req, status, payment_status, source, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        bookingRef, customer.id, reservation_type,
        ciDate, coDate, evDate, stTime, enTime,
        guestCount, notes,
        totalAmt, dpAmt,
        'awaiting_payment', 'unpaid', 'online',
        pmMethod   // customer's chosen payment method from Step 4
      ).lastInsertRowid;

      // Reservation item — and mark the booked resource as reserved so it
      // stops showing as available while this booking is active.
      if (reservation_type === 'room' && roomId) {
        const row = db.prepare('SELECT name, price FROM rooms WHERE id = ?').get(roomId);
        db.prepare('INSERT INTO reservation_items (reservation_id, item_type, item_id, item_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)').run(newId, 'room', roomId, row?.name||'', 1, row?.price||0, totalAmt);
        db.prepare("UPDATE rooms SET status='reserved', updated_at=datetime('now') WHERE id=?").run(roomId);
      } else if (reservation_type === 'venue' && venueId) {
        const row = db.prepare('SELECT name, price FROM venues WHERE id = ?').get(venueId);
        db.prepare('INSERT INTO reservation_items (reservation_id, item_type, item_id, item_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)').run(newId, 'venue', venueId, row?.name||'', 1, row?.price||0, totalAmt);
        db.prepare("UPDATE venues SET status='reserved', updated_at=datetime('now') WHERE id=?").run(venueId);
      } else if (reservation_type === 'cottage' && roomId) {
        const row = db.prepare('SELECT name, price FROM cottages WHERE id = ?').get(roomId);
        db.prepare('INSERT INTO reservation_items (reservation_id, item_type, item_id, item_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)').run(newId, 'cottage', roomId, row?.name||'', 1, row?.price||0, totalAmt);
        db.prepare("UPDATE cottages SET status='reserved', updated_at=datetime('now') WHERE id=?").run(roomId);
      }

      if (pkgId) {
        const pkg = db.prepare('SELECT name, price, inclusions FROM event_packages WHERE id = ?').get(pkgId);
        if (pkg) {
          // Insert the base package row
          db.prepare('INSERT INTO reservation_items (reservation_id, item_type, item_id, item_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
            newId, 'event_package', pkgId, pkg.name, 1, pkg.price, pkg.price
          );

          // Insert each selected optional add-on as a separate line item
          if (selectedInclusions.length > 0) {
            let allInclusions = [];
            try { allInclusions = JSON.parse(pkg.inclusions || '[]'); } catch { allInclusions = []; }

            // Build trusted price map (only optional add-ons with price > 0)
            const addonMap = new Map();
            for (const inc of allInclusions) {
              if (inc.is_optional && inc.price > 0) addonMap.set(inc.name, inc.price);
            }

            for (const sel of selectedInclusions) {
              const name = (sel.name || '').trim();
              if (addonMap.has(name)) {
                const addonPrice = addonMap.get(name);
                db.prepare('INSERT INTO reservation_items (reservation_id, item_type, item_id, item_name, quantity, unit_price, total_price, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
                  newId, 'inclusion', pkgId, name, 1, addonPrice, addonPrice, 'Event package add-on'
                );
              }
            }
          }
        }
      }

      // Status history
      db.prepare("INSERT INTO reservation_status_history (reservation_id, from_status, to_status) VALUES (?, NULL, 'awaiting_payment')").run(newId);

      // Guest record
      db.prepare("INSERT INTO guests (reservation_id, customer_id, first_name, last_name, email, num_guests, status) VALUES (?, ?, ?, ?, ?, ?, 'expected')").run(newId, customer.id, user.firstName, user.lastName, user.email||'', guestCount);

      // CRM activity
      db.prepare("INSERT INTO crm_activities (customer_id, activity_type, subject, description, status) VALUES (?, 'inquiry', ?, ?, 'completed')").run(
        customer.id,
        'Online booking submitted',
        'Booking ' + bookingRef + ' — ' + reservation_type + ' — ₱' + totalAmt.toLocaleString() + ' total. Downpayment ₱' + dpAmt.toLocaleString() + ' via ' + pmLabel
      );

      return newId;
    })();

    try { await generateReservationQR(resId, bookingRef); } catch (e) {
      console.error('[Portal] QR generation failed:', e.message);
    }

    notifyAllAdmins(
      'reservation',
      'New Online Booking',
      bookingRef + ' (₱' + totalAmt.toLocaleString() + ') submitted by ' + user.firstName + ' ' + user.lastName + ' via ' + pmLabel,
      '/reservations/' + resId
    );

    // Notify the customer (shows in their portal bell)
    notifyUser(
      user.id,
      'reservation',
      'Booking Submitted',
      'Your booking ' + bookingRef + ' was received. Pay the ₱' + dpAmt.toLocaleString('en-PH') + ' downpayment via ' + pmLabel + ' to confirm.',
      '/portal/my-reservations/' + resId
    );

    req.session.flash = {
      success: 'Booking ' + bookingRef + ' submitted! Pay the downpayment of ₱' + dpAmt.toLocaleString('en-PH') + ' via ' + pmLabel + ' to confirm your reservation.',
    };
    res.redirect('/portal/my-reservations/' + resId);
  }
);

// ── POST /portal/my-reservations/:id/submit-payment ─────────────────────────
// FIX 5: multer proof upload + prevent duplicate pending submissions +
//         update payment_status on reservation immediately
router.post(
  '/my-reservations/:id/submit-payment',
  requireCustomer,
  proofUpload.single('proof_image'),
  async (req, res) => {
    const user     = req.session.user;
    const customer = db.prepare('SELECT * FROM customers WHERE user_id = ?').get(user.id);
    if (!customer) {
      req.session.flash = { error: 'Session error. Please log in again.' };
      return res.redirect('/auth/login');
    }

    const reservation = db.prepare('SELECT * FROM reservations WHERE id = ? AND customer_id = ?').get(req.params.id, customer.id);
    if (!reservation) {
      req.session.flash = { error: 'Booking not found.' };
      return res.redirect('/portal/my-reservations');
    }

    // Guard: can only submit payment when awaiting_payment or pending
    const allowedStatuses = ['awaiting_payment', 'pending'];
    if (!allowedStatuses.includes(reservation.status)) {
      req.session.flash = { error: 'Payment cannot be submitted for a booking with status: ' + reservation.status + '.' };
      return res.redirect('/portal/my-reservations/' + req.params.id);
    }

    const { payment_method, amount_sent, reference_number, notes } = req.body;
    const amount = parseFloat(amount_sent);
    const methodSel = (payment_method || 'cash').trim().toLowerCase();

    if (!amount || amount <= 0) {
      // Clean up any uploaded file before bailing out
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch { /* ignore */ } }
      req.session.flash = { error: 'Please enter a valid payment amount.' };
      return res.redirect('/portal/my-reservations/' + req.params.id);
    }

    // ── GCash screenshot validation ───────────────────────────────────────
    // For the GCash method a proof screenshot is REQUIRED and must actually
    // look like a genuine GCash receipt (verified via OCR). Anything else is
    // rejected and the uploaded file is deleted.
    if (methodSel === 'gcash') {
      if (!req.file) {
        req.session.flash = { error: 'Please upload your GCash payment screenshot to continue.' };
        return res.redirect('/portal/my-reservations/' + req.params.id);
      }

      let check;
      try {
        check = await validateGcashScreenshot(req.file.path);
      } catch (e) {
        check = { valid: false, reasons: ['We could not read the image. Please upload a clear GCash screenshot.'] };
      }

      if (!check.valid) {
        // Reject: delete the file and send the user back with guidance
        try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
        const detail = (check.reasons && check.reasons.length)
          ? ' (' + check.reasons[0] + ')'
          : '';
        req.session.flash = {
          error: 'That does not look like a real GCash payment screenshot' + detail +
                 '. Please upload the actual GCash receipt — it should look like the example shown on the payment page.',
        };
        return res.redirect('/portal/my-reservations/' + req.params.id);
      }

      // Optional soft cross-check: OCR amount vs the amount the customer typed
      if (check.extracted && typeof check.extracted.amount === 'number') {
        const diff = Math.abs(check.extracted.amount - amount);
        if (diff > 1) {
          // Don't hard-block (OCR isn't perfect) — record a note for staff below
          req.session._gcashAmountMismatch = check.extracted.amount;
        }
      }
      // Stash the OCR-extracted ref number so we can use it if the customer left the field blank
      if (check.extracted && check.extracted.refNo) {
        req.session._gcashOcrRef = check.extracted.refNo;
      }
    }

    // ── FIX 5a: Prevent duplicate unverified submissions ──────────────────
    const existingPending = db.prepare(
      "SELECT id FROM payments WHERE reservation_id = ? AND submitted_by = 'customer' AND status = 'received'"
    ).get(reservation.id);

    if (existingPending) {
      req.session.flash = { warning: 'You already submitted a payment notification. Our staff is reviewing it. Please wait for confirmation before submitting again.' };
      return res.redirect('/portal/my-reservations/' + req.params.id);
    }

    const pmMethod  = (payment_method || 'cash').trim();
    // Use the customer-typed reference, else the OCR-extracted GCash ref, else a placeholder
    const ocrRef    = req.session._gcashOcrRef; delete req.session._gcashOcrRef;
    const amtMismatch = req.session._gcashAmountMismatch; delete req.session._gcashAmountMismatch;
    const refNum    = (reference_number || '').trim() || (ocrRef || '').trim() || ('CUST-PROOF-' + Date.now());
    // Store only the bare filename — proof images are served through the
    // access-controlled route /portal/payment-proof/:paymentId, never publicly.
    const proofPath = req.file ? req.file.filename : null;
    const noteText  = [
      'Customer payment notification submitted online.',
      reference_number ? 'Transaction Ref: ' + reference_number : (ocrRef ? 'GCash Ref (auto-read): ' + ocrRef : ''),
      (methodSel === 'gcash') ? 'GCash screenshot passed automatic verification.' : '',
      (amtMismatch != null) ? ('NOTE: screenshot amount (' + amtMismatch + ') differs from entered amount (' + amount + ') — please review.') : '',
      notes ? 'Note: ' + notes : '',
      'Awaiting staff verification.',
    ].filter(Boolean).join(' ');

    const payType = amount >= reservation.total_amount ? 'full_payment' : 'downpayment';

    try {
      db.transaction(() => {
        // Insert the payment as 'received' — staff will change to 'verified'
        db.prepare(
          'INSERT INTO payments (reservation_id, reference_number, amount, payment_method, payment_date, payment_type, status, notes, proof_image, submitted_by) VALUES (?, ?, ?, ?, DATE(\'now\'), ?, \'received\', ?, ?, \'customer\')'
        ).run(reservation.id, refNum, amount, pmMethod, payType, noteText, proofPath);

        // ── FIX 5b: Immediately update payment_status so the customer sees
        //           "Partially Paid" instead of "Unpaid" after submitting proof
        const totalPaid = db.prepare(
          "SELECT COALESCE(SUM(amount),0) AS t FROM payments WHERE reservation_id = ? AND status = 'received'"
        ).get(reservation.id).t;

        let newPayStatus = 'partially_paid';
        if (totalPaid >= reservation.total_amount && reservation.total_amount > 0) {
          newPayStatus = 'fully_paid';
        }
        db.prepare("UPDATE reservations SET payment_status = ?, updated_at = datetime('now') WHERE id = ?").run(newPayStatus, reservation.id);
      })();
    } catch (error) {
      if (error.code !== 'SQLITE_CONSTRAINT_UNIQUE') throw error;
      if (req.file) { try { fs.unlinkSync(req.file.path); } catch { /* ignore */ } }
      req.session.flash = {
        error: 'That transaction/reference number has already been submitted. Check your booking status or contact us before trying again.',
      };
      return res.redirect('/portal/my-reservations/' + req.params.id);
    }

    // Notify staff with proof image info
    notifyAllAdmins(
      'payment',
      'Payment Proof Submitted: ' + reservation.booking_ref,
      customer.first_name + ' ' + customer.last_name + ' submitted ₱' + amount.toLocaleString() + ' via ' + pmMethod.replace(/_/g,' ') + (proofPath ? ' (with screenshot)' : ' (no screenshot)') + '. Please verify.',
      '/reservations/' + reservation.id
    );

    // Notify the customer their proof was received
    notifyUser(
      user.id,
      'payment',
      'Payment Proof Received',
      'We received your ₱' + amount.toLocaleString('en-PH') + ' payment for ' + reservation.booking_ref + '. Our team will verify it within 24 hours.',
      '/portal/my-reservations/' + reservation.id
    );

    req.session.flash = {
      success: 'Payment notification submitted! Our team will verify and confirm your booking within 24 hours. Thank you!',
    };
    res.redirect('/portal/my-reservations/' + req.params.id);
  }
);

// ── GET /portal/profile — customer profile settings ────────────────────────
router.get('/profile', requireCustomer, (req, res) => {
  const user     = req.session.user;
  const account  = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  let   customer = db.prepare('SELECT * FROM customers WHERE user_id = ?').get(user.id);

  // Ensure a customer record exists
  if (!customer) {
    const code = 'CUS-' + String(Date.now()).slice(-6);
    db.prepare('INSERT OR IGNORE INTO customers (user_id, customer_code, first_name, last_name, email, status) VALUES (?, ?, ?, ?, ?, ?)').run(
      user.id, code, user.firstName, user.lastName, user.email || '', 'active'
    );
    customer = db.prepare('SELECT * FROM customers WHERE user_id = ?').get(user.id);
  }

  res.render('portal/profile', {
    title:  'Profile Settings – Balai-Reserve',
    layout: 'layouts/portal',
    account, customer,
    errors: [], pwErrors: [], old: {},
    activeTab: req.query.tab || 'profile',
  });
});

// ── POST /portal/profile — update name / phone / address / preferred contact ─
router.post('/profile',
  requireCustomer,
  [
    body('first_name').trim().notEmpty().withMessage('First name is required.'),
    body('last_name').trim().notEmpty().withMessage('Last name is required.'),
    body('phone').optional({ checkFalsy: true }).trim(),
    body('address').optional({ checkFalsy: true }).trim(),
    body('preferred_contact').optional({ checkFalsy: true }).isIn(['email','phone','sms']),
  ],
  (req, res) => {
    const user    = req.session.user;
    const account = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    const customer= db.prepare('SELECT * FROM customers WHERE user_id = ?').get(user.id);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('portal/profile', {
        title: 'Profile Settings – Balai-Reserve', layout: 'layouts/portal',
        account, customer, errors: errors.array(), pwErrors: [], old: req.body,
        activeTab: 'profile',
      });
    }

    const { first_name, last_name, phone, address, preferred_contact } = req.body;

    db.transaction(() => {
      // Update the users row (auth identity + navbar name)
      db.prepare(`UPDATE users SET first_name=?, last_name=?, phone=?, updated_at=datetime('now') WHERE id=?`)
        .run(first_name, last_name, phone || '', user.id);

      // Update the linked customer profile row
      if (customer) {
        db.prepare(`UPDATE customers SET first_name=?, last_name=?, phone=?, address=?, preferred_contact=?, updated_at=datetime('now') WHERE id=?`)
          .run(first_name, last_name, phone || '', address || '', preferred_contact || 'email', customer.id);
      }
    })();

    // Refresh session so the navbar greeting updates immediately
    req.session.user.firstName = first_name;
    req.session.user.lastName  = last_name;

    req.session.flash = { success: 'Your profile has been updated.' };
    res.redirect('/portal/profile');
  }
);

// ── POST /portal/profile/password — change password ─────────────────────────
router.post('/profile/password',
  requireCustomer,
  [
    body('current_password').notEmpty().withMessage('Current password is required.'),
    body('new_password').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.'),
    body('confirm_password').custom((val, { req: r }) => {
      if (val !== r.body.new_password) throw new Error('Passwords do not match.');
      return true;
    }),
  ],
  (req, res) => {
    const user     = req.session.user;
    const account  = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    const customer = db.prepare('SELECT * FROM customers WHERE user_id = ?').get(user.id);
    const errors   = validationResult(req);
    const allErrors = errors.array();

    // Google-only accounts have no password to change
    if (account.auth_provider === 'google' && !account.password_hash) {
      allErrors.unshift({ msg: 'Your account uses Google Sign-In and has no password to change.' });
    } else {
      const currentOk = bcrypt.compareSync(req.body.current_password || '', account.password_hash || '');
      if (!currentOk) allErrors.unshift({ msg: 'Current password is incorrect.' });
    }

    if (allErrors.length > 0) {
      return res.render('portal/profile', {
        title: 'Profile Settings – Balai-Reserve', layout: 'layouts/portal',
        account, customer, errors: [], pwErrors: allErrors, old: {},
        activeTab: 'password',
      });
    }

    const hash = bcrypt.hashSync(req.body.new_password, 12);
    db.prepare(`UPDATE users SET password_hash=?, updated_at=datetime('now') WHERE id=?`).run(hash, user.id);

    req.session.flash = { success: 'Your password has been changed.' };
    res.redirect('/portal/profile');
  }
);

// ── GET /portal/notifications ───────────────────────────────────────────────
router.get('/notifications', requireCustomer, (req, res) => {
  const uid = req.session.user.id;
  const notifications = db.prepare(
    `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`
  ).all(uid);

  // Mark all as read when the customer opens the page
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).run(uid);

  res.render('portal/notifications', {
    title:  'Notifications – Balai-Reserve',
    layout: 'layouts/portal',
    notifications,
  });
});

// ── POST /portal/notifications/clear — delete read notifications ────────────
router.post('/notifications/clear', requireCustomer, (req, res) => {
  db.prepare(`DELETE FROM notifications WHERE user_id = ? AND is_read = 1`).run(req.session.user.id);
  req.session.flash = { success: 'Notifications cleared.' };
  res.redirect('/portal/notifications');
});

// ── GET /portal/payment-proof/:paymentId ─────────────────────────────────────
// Access-controlled delivery of a GCash payment-proof image. Only the owning
// customer OR staff/admin may view it. Proof files are NOT served publicly.
router.get('/payment-proof/:paymentId', (req, res) => {
  const sessionUser = req.session?.user;
  if (!sessionUser) {
    req.session.flash = { error: 'Please sign in to view this file.' };
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }

  const payment = db.prepare(`
    SELECT p.proof_image, p.reservation_id, r.customer_id, c.user_id AS owner_user_id
    FROM payments p
    JOIN reservations r ON r.id = p.reservation_id
    LEFT JOIN customers c ON c.id = r.customer_id
    WHERE p.id = ?
  `).get(req.params.paymentId);

  if (!payment || !payment.proof_image) {
    return res.status(404).send('Proof not found.');
  }

  const isStaff = STAFF_ROLES.includes(sessionUser.role);
  const isOwner = payment.owner_user_id && payment.owner_user_id === sessionUser.id;
  if (!isStaff && !isOwner) {
    return res.status(403).send('You are not authorized to view this file.');
  }

  // Legacy rows may still hold a '/uploads/payment_proofs/<file>' path — normalise
  // to a bare filename and resolve strictly inside PROOF_DIR (prevents traversal).
  const bareName = path.basename(payment.proof_image);
  const absPath  = path.join(PROOF_DIR, bareName);
  if (!absPath.startsWith(PROOF_DIR) || !fs.existsSync(absPath)) {
    return res.status(404).send('Proof file missing.');
  }

  res.setHeader('Cache-Control', 'private, no-store');
  return res.sendFile(absPath);
});

// ── GET /portal/my-reservations ─────────────────────────────────────────────
router.get('/my-reservations', requireCustomer, (req, res) => {
  const user     = req.session.user;
  const customer = db.prepare('SELECT * FROM customers WHERE user_id = ?').get(user.id);

  let reservations = [];
  if (customer) {
    reservations = db.prepare('SELECT r.* FROM reservations r WHERE r.customer_id = ? ORDER BY r.created_at DESC').all(customer.id);
  }

  res.render('portal/my-reservations', {
    title:  'My Bookings – Balai-Reserve',
    layout: 'layouts/portal',
    reservations, customer,
  });
});

// ── GET /portal/my-reservations/:id ─────────────────────────────────────────
router.get('/my-reservations/:id', requireCustomer, (req, res) => {
  const user     = req.session.user;
  const customer = db.prepare('SELECT * FROM customers WHERE user_id = ?').get(user.id);

  if (!customer) {
    req.session.flash = { error: 'No booking found.' };
    return res.redirect('/portal/my-reservations');
  }

  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ? AND customer_id = ?').get(req.params.id, customer.id);
  if (!reservation) {
    req.session.flash = { error: 'Booking not found or you do not have permission to view it.' };
    return res.redirect('/portal/my-reservations');
  }

  const items = db.prepare('SELECT * FROM reservation_items WHERE reservation_id = ?').all(reservation.id);

  // ── FIX 8: Only count non-refunded payments in balance calculation ────────
  const payments = db.prepare(
    "SELECT * FROM payments WHERE reservation_id = ? AND status != 'refunded' ORDER BY payment_date ASC"
  ).all(reservation.id);

  const amountPaid   = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalAmount  = reservation.total_amount || 0;
  // ── FIX 3: balance correctly reflects whether anything was actually paid ──
  const balance      = totalAmount - amountPaid;
  const isFullyPaid  = totalAmount > 0 && balance <= 0;
  const hasAnyPayment= amountPaid > 0;

  const qrCode = db.prepare('SELECT * FROM qr_codes WHERE reservation_id = ? AND used = 0 ORDER BY created_at DESC LIMIT 1').get(reservation.id);

  // Check for a pending (unverified) customer submission
  const pendingProof = db.prepare(
    "SELECT * FROM payments WHERE reservation_id = ? AND submitted_by = 'customer' AND status = 'received' ORDER BY created_at DESC LIMIT 1"
  ).get(reservation.id);

  const feedback = db.prepare('SELECT * FROM feedback WHERE reservation_id = ? AND customer_id = ?').get(reservation.id, customer.id);

  // Latest refund request for this booking (if any) — drives the refund UI.
  const refundRequest = db.prepare(
    'SELECT * FROM refund_requests WHERE reservation_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(reservation.id);
  // A refund can be requested when the customer has paid something, the booking
  // isn't already cancelled/rejected, and there's no pending/approved request yet.
  const canRequestRefund = hasAnyPayment
    && !['cancelled','rejected'].includes(reservation.status)
    && (!refundRequest || refundRequest.status === 'rejected');

  res.render('portal/reservation-detail', {
    title:   'Booking ' + reservation.booking_ref,
    layout:  'layouts/portal',
    reservation, items, payments, qrCode,
    amountPaid, totalAmount, balance,
    isFullyPaid,      // true only when total > 0 AND balance <= 0
    hasAnyPayment,    // true when customer has paid something
    pendingProof,     // non-null when customer has a pending unverified submission
    feedback, customer,
    refundRequest, canRequestRefund,
  });
});

// ── GET /portal/feedback/:reservationId ─────────────────────────────────────
router.get('/feedback/:reservationId', requireCustomer, (req, res) => {
  const user     = req.session.user;
  const customer = db.prepare('SELECT * FROM customers WHERE user_id = ?').get(user.id);
  if (!customer) return res.redirect('/portal');

  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ? AND customer_id = ?').get(req.params.reservationId, customer.id);
  if (!reservation || !['completed','checked_in'].includes(reservation.status)) {
    req.session.flash = { error: 'Feedback can only be submitted for completed reservations.' };
    return res.redirect('/portal/my-reservations');
  }
  const existing = db.prepare('SELECT * FROM feedback WHERE reservation_id = ? AND customer_id = ?').get(reservation.id, customer.id);
  if (existing) {
    req.session.flash = { info: 'You have already submitted feedback for this booking.' };
    return res.redirect('/portal/my-reservations/' + reservation.id);
  }
  res.render('portal/feedback', {
    title: 'Leave Feedback', layout: 'layouts/portal',
    reservation, errors: [], old: {},
  });
});

// ── POST /portal/my-reservations/:id/cancel ──────────────────────────────────
// Guests can cancel their own booking while it is still pending or awaiting payment.
// If payment was already submitted it is NON-REFUNDABLE — booking is cancelled but
// payment records are kept; staff are notified.
router.post('/my-reservations/:id/cancel', requireCustomer, (req, res) => {
  const user     = req.session.user;
  const customer = db.prepare('SELECT * FROM customers WHERE user_id = ?').get(user.id);
  if (!customer) {
    req.session.flash = { error: 'Session error. Please log in again.' };
    return res.redirect('/auth/login');
  }

  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ? AND customer_id = ?').get(req.params.id, customer.id);
  if (!reservation) {
    req.session.flash = { error: 'Booking not found.' };
    return res.redirect('/portal/my-reservations');
  }

  // Only allow cancellation while the booking hasn't been confirmed / checked-in
  const cancellableStatuses = ['pending', 'awaiting_payment'];
  if (!cancellableStatuses.includes(reservation.status)) {
    req.session.flash = {
      error: `This booking cannot be cancelled — it is currently "${reservation.status.replace(/_/g,' ')}". Please contact us if you need assistance.`,
    };
    return res.redirect('/portal/my-reservations/' + reservation.id);
  }

  // Check if customer already paid anything — non-refundable notice
  const totalPaid = db.prepare(
    "SELECT COALESCE(SUM(amount),0) AS t FROM payments WHERE reservation_id = ? AND status IN ('received','verified')"
  ).get(reservation.id).t;
  const hasPayment = totalPaid > 0;

  db.transaction(() => {
    // Cancel the reservation
    db.prepare(`UPDATE reservations SET status='cancelled', updated_at=datetime('now') WHERE id=?`).run(reservation.id);
    db.prepare(`INSERT INTO reservation_status_history (reservation_id, from_status, to_status, notes) VALUES (?,?,?,'Cancelled by guest via portal')`).run(reservation.id, reservation.status, 'cancelled');

    // Free up any reserved items so they show as available again immediately
    const items = db.prepare(`SELECT * FROM reservation_items WHERE reservation_id=?`).all(reservation.id);
    for (const item of items) {
      if (item.item_type === 'room')    db.prepare(`UPDATE rooms SET status='available', updated_at=datetime('now') WHERE id=?`).run(item.item_id);
      if (item.item_type === 'venue')   db.prepare(`UPDATE venues SET status='available', updated_at=datetime('now') WHERE id=?`).run(item.item_id);
      if (item.item_type === 'cottage') db.prepare(`UPDATE cottages SET status='available', updated_at=datetime('now') WHERE id=?`).run(item.item_id);
    }

    // Update guest record if present
    db.prepare(`UPDATE guests SET status='no_show', updated_at=datetime('now') WHERE reservation_id=?`).run(reservation.id);
  })();

  // Notify staff of the cancellation
  notifyAllAdmins(
    'reservation',
    'Booking Cancelled by Guest',
    `${reservation.booking_ref} was cancelled by ${user.firstName} ${user.lastName}` +
      (hasPayment ? ` — ₱${totalPaid.toLocaleString('en-PH', {minimumFractionDigits:2})} already paid (NON-REFUNDABLE).` : '.'),
    '/reservations/' + reservation.id
  );

  // Notify the customer their cancellation is confirmed
  notifyUser(
    user.id,
    'reservation',
    'Booking Cancelled',
    `Your booking ${reservation.booking_ref} has been cancelled` +
      (hasPayment ? '. Payments already made are non-refundable.' : '.'),
    '/portal/my-reservations/' + reservation.id
  );

  const msg = hasPayment
    ? `Your booking ${reservation.booking_ref} has been cancelled. Please note that payments already made are non-refundable. Contact us if you have questions.`
    : `Your booking ${reservation.booking_ref} has been cancelled successfully.`;

  req.session.flash = { success: msg };
  res.redirect('/portal/my-reservations');
});

// ── POST /portal/my-reservations/:id/request-refund ───────────────────────────
// Customer submits a refund request. It stays 'pending' until an admin reviews it.
router.post('/my-reservations/:id/request-refund', requireCustomer, (req, res) => {
  const user     = req.session.user;
  const customer = db.prepare('SELECT * FROM customers WHERE user_id = ?').get(user.id);
  if (!customer) { req.session.flash = { error: 'Session error. Please log in again.' }; return res.redirect('/auth/login'); }

  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ? AND customer_id = ?').get(req.params.id, customer.id);
  if (!reservation) { req.session.flash = { error: 'Booking not found.' }; return res.redirect('/portal/my-reservations'); }

  // How much has the customer actually paid (net of refunds)?
  const amountPaid = db.prepare(
    "SELECT COALESCE(SUM(amount),0) AS t FROM payments WHERE reservation_id = ? AND status IN ('received','verified')"
  ).get(reservation.id).t;

  if (amountPaid <= 0) {
    req.session.flash = { error: 'There is no payment on record to refund for this booking.' };
    return res.redirect('/portal/my-reservations/' + reservation.id);
  }
  if (['cancelled','rejected'].includes(reservation.status)) {
    req.session.flash = { error: 'A refund cannot be requested for a cancelled or rejected booking. Please contact us directly.' };
    return res.redirect('/portal/my-reservations/' + reservation.id);
  }

  // Block duplicate open requests.
  const existing = db.prepare(
    "SELECT * FROM refund_requests WHERE reservation_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1"
  ).get(reservation.id);
  if (existing) {
    req.session.flash = { info: 'You already have a refund request under review for this booking.' };
    return res.redirect('/portal/my-reservations/' + reservation.id);
  }

  const reason = (req.body.reason || '').trim();
  if (!reason) {
    req.session.flash = { error: 'Please provide a reason for your refund request.' };
    return res.redirect('/portal/my-reservations/' + reservation.id);
  }

  // GCash number where the guest wants to receive the refund (validated if given).
  const gcashNumber = (req.body.gcash_number || '').trim();
  if (gcashNumber && !/^09\d{9}$/.test(gcashNumber)) {
    req.session.flash = { error: 'Please enter a valid GCash number (11 digits starting with 09) to receive your refund.' };
    return res.redirect('/portal/my-reservations/' + reservation.id);
  }

  db.prepare(`
    INSERT INTO refund_requests (reservation_id, customer_id, amount, reason, gcash_number, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(reservation.id, customer.id, amountPaid, reason, gcashNumber || null);

  notifyAllAdmins(
    'payment', 'Refund Requested',
    `${user.firstName} ${user.lastName} requested a refund of ₱${amountPaid.toLocaleString('en-PH',{minimumFractionDigits:2})} for ${reservation.booking_ref}.`,
    '/reservations/' + reservation.id
  );

  req.session.flash = { success: 'Your refund request has been submitted. Our team will review it and get back to you.' };
  res.redirect('/portal/my-reservations/' + reservation.id);
});

// ── GET /portal/feedback/:reservationId ─────────────────────────────────────
router.post('/feedback/:reservationId',
  requireCustomer,
  [
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Please select a rating from 1 to 5.'),
    body('comments').trim().notEmpty().withMessage('Please write a short comment.'),
  ],
  (req, res) => {
    const user     = req.session.user;
    const customer = db.prepare('SELECT * FROM customers WHERE user_id = ?').get(user.id);
    const reservation = db.prepare('SELECT * FROM reservations WHERE id = ? AND customer_id = ?').get(req.params.reservationId, customer?.id);
    if (!reservation || !customer) return res.redirect('/portal/my-reservations');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('portal/feedback', {
        title: 'Leave Feedback', layout: 'layouts/portal',
        reservation, errors: errors.array(), old: req.body,
      });
    }
    const { rating, category, comments, suggestions } = req.body;
    db.prepare('INSERT INTO feedback (reservation_id, customer_id, rating, category, comments, suggestions) VALUES (?,?,?,?,?,?)').run(
      reservation.id, customer.id, rating, category || 'overall', comments, suggestions || ''
    );
    req.session.flash = { success: 'Thank you for your feedback!' };
    res.redirect('/portal/my-reservations/' + reservation.id);
  }
);

// ── GET /portal/inquire ──────────────────────────────────────────────────────
router.get('/inquire', requireCustomerOrGuest, (req, res) => {
  res.render('portal/inquire', {
    title: 'Contact Us – Balai-Reserve', layout: 'layouts/portal',
    errors: [], old: {},
  });
});

// ── POST /portal/inquire ─────────────────────────────────────────────────────
router.post('/inquire',
  [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('subject').trim().notEmpty().withMessage('Subject is required.'),
    body('message').trim().notEmpty().withMessage('Message is required.'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Enter a valid email.'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('portal/inquire', {
        title: 'Contact Us', layout: 'layouts/portal',
        errors: errors.array(), old: req.body,
      });
    }
    const { name, email, phone, subject, message, category } = req.body;
    const customerId = req.session?.user
      ? (db.prepare('SELECT id FROM customers WHERE user_id = ?').get(req.session.user.id)?.id || null)
      : null;

    db.prepare("INSERT INTO inquiries (customer_id, name, email, phone, subject, message, category, source, status) VALUES (?,?,?,?,?,?,?,'website','open')").run(
      customerId, name, email||'', phone||'', subject, message, category||'general'
    );
    req.session.flash = { success: 'Your inquiry has been received. Our team will get back to you shortly.' };
    res.redirect('/portal/my-inquiries');
  }
);

// ── GET /portal/calendar ─────────────────────────────────────────────────────
// Interactive availability calendar. Shows booked date ranges (no customer
// details) so guests can pick an open date; clicking a date starts a booking.
router.get('/calendar', requireCustomerOrGuest, (req, res) => {
  res.render('portal/calendar', {
    title: 'Availability Calendar – Balai-Reserve',
    layout: 'layouts/portal',
  });
});

// ── GET /portal/calendar/feed ────────────────────────────────────────────────
// JSON feed of booked ranges for FullCalendar. Returns anonymised "Booked"
// blocks (rooms/cottages as date spans, venues/events as single days).
router.get('/calendar/feed', requireCustomerOrGuest, (req, res) => {
  const ACTIVE = "status NOT IN ('cancelled','rejected','completed','no_show')";

  // Room & cottage bookings → multi-day all-day spans.
  const stays = db.prepare(`
    SELECT r.reservation_type, r.check_in_date, r.check_out_date, ri.item_name
    FROM reservations r
    LEFT JOIN reservation_items ri ON ri.reservation_id = r.id AND ri.item_type IN ('room','cottage')
    WHERE r.reservation_type IN ('room','cottage')
      AND r.check_in_date IS NOT NULL
      AND ${ACTIVE}
  `).all();

  // Venue / event bookings → single-day markers.
  const venueEvents = db.prepare(`
    SELECT r.reservation_type, r.event_date, ri.item_name
    FROM reservations r
    LEFT JOIN reservation_items ri ON ri.reservation_id = r.id AND ri.item_type = 'venue'
    WHERE r.reservation_type IN ('venue','event')
      AND r.event_date IS NOT NULL
      AND ${ACTIVE}
  `).all();

  const colorFor = (t) => t === 'room' ? '#6366f1' : t === 'cottage' ? '#f97316' : '#10b981';
  const events = [];

  for (const s of stays) {
    // FullCalendar treats `end` as exclusive, which matches checkout day.
    events.push({
      title: (s.item_name ? s.item_name : (s.reservation_type === 'cottage' ? 'Cottage' : 'Room')) + ' — Booked',
      start: s.check_in_date,
      end:   s.check_out_date || s.check_in_date,
      allDay: true,
      color: colorFor(s.reservation_type),
      display: 'block',
    });
  }
  for (const v of venueEvents) {
    events.push({
      title: (v.item_name ? v.item_name : (v.reservation_type === 'event' ? 'Event' : 'Venue')) + ' — Booked',
      start: v.event_date,
      allDay: true,
      color: colorFor(v.reservation_type === 'event' ? 'event' : 'venue'),
      display: 'block',
    });
  }

  res.json(events);
});

// ── GET /portal/my-inquiries ─────────────────────────────────────────────────
// Lets a logged-in customer see the inquiries they've submitted and their status.
router.get('/my-inquiries', requireCustomer, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE user_id = ?').get(req.session.user.id);

  // Match inquiries linked to the customer id OR submitted with their email.
  let inquiries = [];
  if (customer) {
    inquiries = db.prepare(`
      SELECT * FROM inquiries
      WHERE customer_id = ? OR (email != '' AND email = ?)
      ORDER BY created_at DESC
    `).all(customer.id, customer.email || '');
  }

  res.render('portal/my-inquiries', {
    title: 'My Inquiries – Balai-Reserve',
    layout: 'layouts/portal',
    inquiries,
  });
});

module.exports = router;
