/**
 * Balai-Reserve – Main Application Entry Point
 * =============================================
 * Online Booking & Event Management System
 * Framework: Xianfire (custom .xian template engine over Express)
 * Database:  SQLite via better-sqlite3
 */
'use strict';

require('dotenv').config();

const express     = require('express');
const path        = require('path');
const session     = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);
const cookieParser= require('cookie-parser');
const helmet      = require('helmet');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');

// ΓöÇΓöÇ Xianfire Engine & Helpers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const xianfire = require('./src/xianfire/engine');
const { xianHelpersMiddleware } = require('./src/xianfire/helpers');
const { reconcileExpiredReservations } = require('./src/utils/reservationAvailability');

// ΓöÇΓöÇ Middleware ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const { attachAudit } = require('./src/middleware/auth');

// ΓöÇΓöÇ Database ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const db = require('./src/config/database');

// ΓöÇΓöÇ Notification Utility ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const { getUnreadCount, getRecentNotifications } = require('./src/utils/notifications');

// ΓöÇΓöÇ Route modules ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const authRoutes         = require('./src/modules/auth/routes');
const dashboardRoutes    = require('./src/modules/dashboard/routes');
const portalRoutes       = require('./src/modules/portal/routes');
const roomRoutes         = require('./src/modules/rooms/routes');
const venueRoutes        = require('./src/modules/venues/routes');
const cottageRoutes      = require('./src/modules/cottages/routes');
const reservationRoutes  = require('./src/modules/reservations/routes');
const guestRoutes        = require('./src/modules/guests/routes');
const eventRoutes        = require('./src/modules/events/routes');
const inventoryRoutes    = require('./src/modules/inventory/routes');
const paymentRoutes      = require('./src/modules/payments/routes');
const inquiryRoutes      = require('./src/modules/inquiries/routes');
const crmRoutes          = require('./src/modules/crm/routes');
const feedbackRoutes     = require('./src/modules/feedback/routes');
const reportRoutes       = require('./src/modules/reports/routes');
const analyticsRoutes    = require('./src/modules/analytics/routes');
const notificationRoutes = require('./src/modules/notifications/routes');
const usersRoutes        = require('./src/modules/users/routes');
const profileRoutes      = require('./src/modules/profile/routes');
const settingsRoutes     = require('./src/modules/settings/routes');

// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const app  = express();
const PORT = process.env.PORT || 3000;
const isDev= process.env.NODE_ENV !== 'production';
// Vercel terminates TLS at the edge; trust its forwarded protocol for secure cookies.
app.set('trust proxy', 1);

// ΓöÇΓöÇ Security Headers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'],
      styleSrc:   ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com',
                   'fonts.googleapis.com'],
      fontSrc:    ["'self'", 'fonts.gstatic.com', 'cdnjs.cloudflare.com', 'data:'],
      imgSrc:     ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'],
      frameSrc:   ["'self'"],
      formAction: ["'self'"],
      workerSrc:  ["'self'", 'blob:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ΓöÇΓöÇ Request Logging ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
if (!isDev) app.use(morgan('combined'));
else        app.use(morgan('dev'));

// ΓöÇΓöÇ Rate Limiting ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// Auth endpoints: brute-force protection
app.use('/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      isDev ? 300 : 30,
  standardHeaders: true, legacyHeaders: false,
  message: 'Too many login attempts. Please wait 15 minutes and try again.',
}));

// Global limiter — very generous; skips static assets
app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max:      isDev ? 10000 : parseInt(process.env.RATE_LIMIT_MAX || '500'),
  standardHeaders: true, legacyHeaders: false,
  skip: (req) => /^\/(css|js|images|qrcodes|uploads)/.test(req.path),
  handler: (req, res) => {
    // Render a proper page if session exists; otherwise plain text
    if (req.session?.user) {
      return res.status(429).render('errors/429', {
        title:  'Too Many Requests',
        layout: 'layouts/main',
        message: 'You have sent too many requests. Please wait a moment.',
      });
    }
    res.status(429).send('Too many requests. Please wait and try again.');
  },
}));

// ΓöÇΓöÇ Body Parsing ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ΓöÇΓöÇ Session ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.use(session({
  store: new SqliteStore({
    client:  db,
    expired: { clear: true, intervalMs: 900000 },
  }),
  secret:            process.env.SESSION_SECRET || 'balai-reserve-change-me',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   !isDev,
    httpOnly: true,
    maxAge:   24 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
}));

// ΓöÇΓöÇ Static Files ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.use(express.static(path.join(__dirname, 'public')));

// Payment-proof images must NEVER be served as public static files — they
// contain sensitive payment PII. Block direct access here; they are delivered
// only through the access-controlled route /portal/payment-proof/:paymentId.
app.use('/uploads/payment_proofs', async (req, res) => {
  res.status(403).send('Forbidden');
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ΓöÇΓöÇ Xianfire Template Engine ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
xianfire.register(app, { viewsDir: path.join(__dirname, 'views') });

// ΓöÇΓöÇ Global Template Helpers (pure functions — no per-request state) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.use(xianHelpersMiddleware);

// ΓöÇΓöÇ Per-request globals (single authoritative block) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.use(async (req, res, next) => {
  const user = req.session?.user || null;

  // Flash — read once, clear immediately
  res.locals.flash = req.session?.flash || {};
  if (req.session?.flash) delete req.session.flash;

  // Identity
  res.locals.appName     = process.env.APP_NAME || 'Balai-Reserve';
  res.locals.currentUser = user;
  res.locals.currentPath = req.path;

  // Defaults that every template references (prevents "undefined" errors)
  res.locals.activeTab              = null;
  res.locals.unreadNotifCount       = 0;
  res.locals.recentNotifications    = [];
  res.locals.pendingInquiriesCount  = 0;
  res.locals.pendingReservationsCount = 0;

  if (user) {
    try {
      res.locals.unreadNotifCount      = await getUnreadCount(user.id);
      res.locals.recentNotifications   = await getRecentNotifications(user.id, 6);
      res.locals.pendingInquiriesCount = await db.prepare(
        `SELECT COUNT(*) AS c FROM inquiries WHERE status IN ('open','in_progress')`
      ).get().c || 0;
      // Count reservations that need staff action: pending review OR awaiting payment verification
      res.locals.pendingReservationsCount = await db.prepare(
        `SELECT COUNT(*) AS c FROM reservations WHERE status IN ('pending','awaiting_payment')`
      ).get().c || 0;
    } catch { /* non-critical — never let badge queries crash a page */ }
  }

  next();
});

// ΓöÇΓöÇ Audit helper on every request ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.use(attachAudit(db));

// ΓöÇΓöÇ Favicon (browsers request /favicon.ico automatically) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.get('/favicon.ico', async (req, res) => res.redirect('/favicon.svg'));

// ΓöÇΓöÇ Root: show public landing page to everyone (auth status changes nav only) ΓöÇΓöÇΓöÇΓöÇ
app.get('/', async (req, res) => {
  // ΓöÇΓöÇ Fetch real data from DB for the landing page ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  const totalRooms    = await db.prepare("SELECT COUNT(*) AS c FROM rooms    WHERE is_active=1").get().c;
  const totalVenues   = await db.prepare("SELECT COUNT(*) AS c FROM venues   WHERE is_active=1").get().c;
  const totalCottages = await db.prepare("SELECT COUNT(*) AS c FROM cottages WHERE is_active=1").get().c;
  const totalPackages = await db.prepare("SELECT COUNT(*) AS c FROM event_packages WHERE is_active=1").get().c;
  const avgRatingRow  = await db.prepare("SELECT ROUND(AVG(rating),1) AS a FROM feedback").get();

  const featuredRooms = await db.prepare(
    "SELECT r.*, rt.name AS type_name FROM rooms r JOIN room_types rt ON rt.id=r.room_type_id WHERE r.is_active=1 ORDER BY r.price LIMIT 4"
  ).all();
  for (const r of featuredRooms) {
    try { r.imagesList = JSON.parse(r.images || '[]'); } catch { r.imagesList = []; }
  }

  const featuredVenues = await db.prepare("SELECT * FROM venues WHERE is_active=1 ORDER BY price LIMIT 3").all();
  for (const v of featuredVenues) {
    try { v.imagesList = JSON.parse(v.images || '[]'); } catch { v.imagesList = []; }
  }

  const featuredCottages = await db.prepare("SELECT * FROM cottages WHERE is_active=1 ORDER BY price LIMIT 3").all();
  for (const c of featuredCottages) {
    try { c.imagesList = JSON.parse(c.images || '[]'); } catch { c.imagesList = []; }
  }

  const eventPackages = await db.prepare("SELECT * FROM event_packages WHERE is_active=1 ORDER BY price").all();
  for (const p of eventPackages) {
    try { p.inclusionsList = JSON.parse(p.inclusions || '[]'); } catch { p.inclusionsList = []; }
  }

  // Public reviews (most recent, 5-star first, max 6)
  const reviews = await db.prepare(`
    SELECT f.rating, f.comments, f.created_at,
           cu.first_name || ' ' || SUBSTR(cu.last_name,1,1) || '.' AS customer_name
    FROM feedback f
    JOIN customers cu ON cu.id = f.customer_id
    WHERE f.is_public = 1 AND f.rating >= 4
    ORDER BY f.rating DESC, f.created_at DESC
    LIMIT 6
  `).all();

  // Settings for contact info — use 'siteSettings' to avoid clashing with Express's settings.views
  const settingsRows = await db.prepare("SELECT key, value FROM settings").all();
  const siteSettings = {};
  settingsRows.forEach(s => { siteSettings[s.key] = s.value; });

  res.render('landing/index', {
    title:  'Balai-Reserve — Your Home Away From Home',
    layout: 'layouts/landing',
    stats: { totalRooms, totalVenues, totalCottages, totalPackages, avgRating: avgRatingRow?.a || '4.5' },
    featuredRooms, featuredVenues, featuredCottages,
    eventPackages, reviews,
    site: siteSettings,   // 'settings' is reserved by Express — use 'site' instead
  });
});

// Reconcile expired reservations before every application request so
// availability reflects passed dates immediately, even without a manual checkout.
app.use((req, res, next) => {
  reconcileExpiredReservations(db);
  next();
});

// ΓöÇΓöÇ Authentication ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.use('/auth', authRoutes);

// ΓöÇΓöÇ Customer Portal (public browse + authenticated self-service) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.use('/portal', portalRoutes);

// ΓöÇΓöÇ Staff / Admin Modules ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.use('/dashboard',     dashboardRoutes);
app.use('/rooms',         roomRoutes);
app.use('/venues',        venueRoutes);
app.use('/cottages',      cottageRoutes);
app.use('/reservations',  reservationRoutes);
app.use('/guests',        guestRoutes);
app.use('/events',        eventRoutes);
app.use('/inventory',     inventoryRoutes);
app.use('/payments',      paymentRoutes);
app.use('/inquiries',     inquiryRoutes);
app.use('/crm',           crmRoutes);
app.use('/feedback',      feedbackRoutes);
app.use('/reports',       reportRoutes);
app.use('/analytics',     analyticsRoutes);
app.use('/notifications', notificationRoutes);
app.use('/users',         usersRoutes);
app.use('/profile',       profileRoutes);
app.use('/settings',      settingsRoutes);

// ΓöÇΓöÇ QR Check-in (public — no auth required) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
const { validateQRToken, consumeQRToken } = require('./src/utils/qrGenerator');

app.get('/checkin/:token', async (req, res) => {
  const result = validateQRToken(req.params.token);
  if (!result.valid) {
    return res.render('guests/checkin-invalid', {
      title:  'Invalid QR Code',
      layout: 'layouts/minimal',
      reason: result.reason,
    });
  }
  const reservation = await db.prepare(`
    SELECT r.*, c.first_name, c.last_name, c.phone, c.email
    FROM reservations r JOIN customers c ON c.id = r.customer_id
    WHERE r.id = ?
  `).get(result.qr.reservation_id);

  res.render('guests/checkin-scan', {
    title:       'QR Check-in',
    layout:      'layouts/minimal',
    reservation,
    token:       req.params.token,
  });
});

app.post('/checkin/:token', async (req, res) => {
  const result = validateQRToken(req.params.token);
  if (!result.valid) return res.redirect('/auth/login');

  const resId = result.qr.reservation_id;
  consumeQRToken(req.params.token);
  await db.prepare(`UPDATE reservations SET status='checked_in', updated_at=datetime('now') WHERE id=?`).run(resId);
  await db.prepare(`INSERT INTO check_ins (reservation_id, method, checked_in_at) VALUES (?,'qr',datetime('now'))`).run(resId);
  await db.prepare(`UPDATE guests SET status='checked_in' WHERE reservation_id=?`).run(resId);



  res.render('guests/checkin-success', { title: 'Check-in Successful', layout: 'layouts/minimal' });
});

// ΓöÇΓöÇ 404 ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.use((req, res) => {
  res.status(404).render('errors/404', { title: 'Page Not Found', layout: 'layouts/main' });
});

// ΓöÇΓöÇ Global Error Handler ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[Error]', err.stack || err.message);
  const status  = err.status || 500;
  const message = isDev ? err.message : 'An unexpected error occurred.';
  res.status(status).render('errors/500', {
    title: 'Server Error', layout: 'layouts/main', message,
  });
});

// ΓöÇΓöÇ Start ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
app.listen(PORT, () => {
  console.log('');
  console.log('  ΓòöΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòù');
  console.log('  Γòæ         Balai-Reserve is running         Γòæ');
  console.log(`  Γòæ   http://localhost:${PORT}                  Γòæ`);
  console.log('  ΓòÜΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓò¥');
  console.log('');
  console.log('  Routes mounted:');
  console.log('  /portal       — Customer self-service portal');
  console.log('  /dashboard    — Role-specific dashboards');
  console.log('  /users        — User management (admin)');
  console.log('  /profile      — Profile & password (all roles)');
  console.log('  /feedback     — Customer feedback management');
  console.log('  /cottages     — Cottage management');
  console.log('  /payments/:id — Payment detail + refund');
  console.log('');
});

module.exports = app;
