/**
 * Authentication Routes
 *
 * GET  /auth/login              — login page (staff + customers)
 * POST /auth/login              — process email/password login
 * GET  /auth/register           — customer registration page
 * POST /auth/register           — create customer account (email/password)
 * POST /auth/google/callback    — verify Firebase ID token → create/login customer
 * GET  /auth/logout             — destroy session
 */
'use strict';

const express        = require('express');
const bcrypt         = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db             = require('../../../config/database');
const { verifyIdToken } = require('../../../config/firebase');
const { guestOnly }  = require('../../../middleware/auth');

const router = express.Router();

/* ── Firebase client config — passed to every auth view ──────── */
// These are PUBLIC keys (safe in HTML). Never put service-account keys here.
// ALWAYS use the real authDomain — redirect flow works on localhost with it.
const FIREBASE_CLIENT_CONFIG = {
  apiKey:            process.env.FIREBASE_API_KEY            || '',
  authDomain:        process.env.FIREBASE_AUTH_DOMAIN        || '',
  projectId:         process.env.FIREBASE_PROJECT_ID         || '',
  storageBucket:     process.env.FIREBASE_STORAGE_BUCKET     || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID|| '',
  appId:             process.env.FIREBASE_APP_ID             || '',
};

/* ── Shared helper: build session user object ─────────────────── */
function buildSessionUser(user) {
  return {
    id:        user.id,
    firstName: user.first_name,
    lastName:  user.last_name,
    email:     user.email,
    role:      user.role  || user.role_name,
    roleLabel: user.role_label,
    avatar:    user.avatar || null,
  };
}

/* ── Shared helper: redirect after login ─────────────────────── */
function postLoginRedirect(req, res, role) {
  const staffPaths = ['/dashboard','/rooms','/venues','/events','/inventory',
                      '/crm','/reports','/analytics','/users','/payments',
                      '/guests','/reservations','/inquiries','/feedback','/cottages'];
  let dest = role === 'customer' ? '/portal' : '/dashboard';
  const returnTo = req.session.returnTo;
  if (returnTo) {
    delete req.session.returnTo;
    // Never send a customer to a staff-only page
    if (role === 'customer' && staffPaths.some(p => returnTo.startsWith(p))) {
      return res.redirect('/portal');
    }
    return res.redirect(returnTo);
  }
  return res.redirect(dest);
}

/* ════════════════════════════════════════════════════════════════
   GOOGLE REDIRECT LANDING
   After signInWithRedirect, Firebase returns the user to this page.
   The client SDK calls getRedirectResult(), gets the ID token,
   then POSTs it to /auth/google/callback.
   ════════════════════════════════════════════════════════════════ */

// GET /auth/google/redirect  — landing page for redirect-based Google sign-in
router.get('/google/redirect', async (req, res) => {
  res.render('auth/google-redirect', {
    title:        'Signing in with Google…',
    layout:       'layouts/auth',
    loadFirebase:  true,
    firebaseConfig: FIREBASE_CLIENT_CONFIG,
  });
});

/* ════════════════════════════════════════════════════════════════
   LOGIN
   ════════════════════════════════════════════════════════════════ */

// GET /auth/login
router.get('/login', guestOnly, async (req, res) => {
  res.render('auth/login', {
    title:       'Sign In – Balai-Reserve',
    layout:      'layouts/auth',
    loadFirebase: true,
        firebaseConfig: FIREBASE_CLIENT_CONFIG,   // enables Firebase JS SDK in layout
    errors:      [],
    old:         {},
  });
});

// POST /auth/login
router.post('/login',
  guestOnly,
  [
    body('email').isEmail().normalizeEmail().withMessage('Enter a valid email address.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('auth/login', {
        title: 'Sign In – Balai-Reserve', layout: 'layouts/auth', loadFirebase: true,
        firebaseConfig: FIREBASE_CLIENT_CONFIG,
        errors: errors.array(), old: { email: req.body.email },
      });
    }

    const { email, password } = req.body;
    
    try {
      // Use Postgres SQL query
      const user = await db.prepare(`
        SELECT u.*, r.name AS role, r.label AS role_label
        FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.email = $1 AND u.is_active = 1
      `).get(email);

      if (!user || !user.password_hash || !bcrypt.compareSync(password, user.password_hash)) {
        return res.render('auth/login', {
          title: 'Sign In – Balai-Reserve', layout: 'layouts/auth', loadFirebase: true,
          firebaseConfig: FIREBASE_CLIENT_CONFIG,
          errors: [{ msg: 'Invalid email or password. Please try again.' }],
          old: { email },
        });
      }

      // Block Google-only accounts from using password login
      if (user.auth_provider === 'google') {
        return res.render('auth/login', {
          title: 'Sign In – Balai-Reserve', layout: 'layouts/auth', loadFirebase: true,
          firebaseConfig: FIREBASE_CLIENT_CONFIG,
          errors: [{ msg: 'This account uses Google Sign-In. Please click "Continue with Google" instead.' }],
          old: { email },
        });
      }

      // Update last login
      await db.prepare(`UPDATE users SET last_login = NOW() WHERE id = $1`).run(user.id);
      
      req.session.user = buildSessionUser(user);
      return postLoginRedirect(req, res, user.role);
      
    } catch (error) {
      console.error('Login error:', error);
      return res.render('auth/login', {
        title: 'Sign In – Balai-Reserve', layout: 'layouts/auth', loadFirebase: true,
        firebaseConfig: FIREBASE_CLIENT_CONFIG,
        errors: [{ msg: 'An error occurred. Please try again.' }],
        old: { email },
      });
    }
  }
);

/* ════════════════════════════════════════════════════════════════
   REGISTER (email/password)
   ════════════════════════════════════════════════════════════════ */

// GET /auth/register
router.get('/register', guestOnly, (req, res) => {
  res.render('auth/register', {
    title:       'Create Account – Balai-Reserve',
    layout:      'layouts/auth',
    loadFirebase: true,
        firebaseConfig: FIREBASE_CLIENT_CONFIG,
    errors:      [],
    old:         {},
  });
});

// POST /auth/register
router.post('/register',
  guestOnly,
  [
    body('first_name').trim().notEmpty().withMessage('First name is required.'),
    body('last_name').trim().notEmpty().withMessage('Last name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('Enter a valid email address.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    body('password_confirm').custom((val, { req: r }) => {
      if (val !== r.body.password) throw new Error('Passwords do not match.');
      return true;
    }),
    body('agree_terms').notEmpty().withMessage('You must agree to the Terms and Conditions.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('auth/register', {
        title: 'Create Account – Balai-Reserve', layout: 'layouts/auth', loadFirebase: true,
        firebaseConfig: FIREBASE_CLIENT_CONFIG,
        errors: errors.array(), old: req.body,
      });
    }

    const { first_name, last_name, email, password, phone } = req.body;

    // Duplicate email check
    const existing = await db.prepare(`SELECT id, auth_provider FROM users WHERE email = ?`).get(email);
    if (existing) {
      const hint = existing.auth_provider === 'google'
        ? 'This email is registered via Google Sign-In. Please use "Continue with Google".'
        : 'An account with this email already exists. Please sign in instead.';
      return res.render('auth/register', {
        title: 'Create Account – Balai-Reserve', layout: 'layouts/auth', loadFirebase: true,
        firebaseConfig: FIREBASE_CLIENT_CONFIG,
        errors: [{ msg: hint }], old: req.body,
      });
    }

    const customerRole = await db.prepare(`SELECT id FROM roles WHERE name = 'customer'`).get();
    if (!customerRole) {
      return res.render('auth/register', {
        title: 'Create Account – Balai-Reserve', layout: 'layouts/auth', loadFirebase: true,
        firebaseConfig: FIREBASE_CLIENT_CONFIG,
        errors: [{ msg: 'Registration is temporarily unavailable. Please try again onward.' }],
        old: req.body,
      });
    }

    const hash = bcrypt.hashSync(password, 12);
    const custCode = 'CUS-' + Date.now().toString().slice(-6);

    // For Firestore, we can't use db.transaction() - do sequential operations
    const userResult = await db.prepare(`
      INSERT INTO users
        (role_id, first_name, last_name, email, password_hash, phone, is_active,
         auth_provider, email_verified)
      VALUES (?, ?, ?, ?, ?, ?, 1, 'local', 0)
    `).run(customerRole.id, first_name, last_name, email, hash, phone || '');

    const userId = userResult.lastInsertRowid;

    await db.prepare(`
      INSERT INTO customers
        (user_id, customer_code, first_name, last_name, email, phone,
         preferred_contact, customer_type, status)
      VALUES (?, ?, ?, ?, ?, ?, 'email', 'regular', 'active')
    `).run(userId, custCode, first_name, last_name, email, phone || '');

    // Build session from what we just inserted
    const newUser = await db.prepare(`
      SELECT u.*, r.name AS role, r.label AS role_label
      FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?
    `).get(userId);

    req.session.user = buildSessionUser(newUser);
    req.session.flash = {
      success: `Welcome, ${first_name}! Your account has been created. You can now make a booking.`,
    };
    return res.redirect('/portal');
  }
);

/* ════════════════════════════════════════════════════════════════
   GOOGLE SIGN-IN CALLBACK
   Browser POSTs Firebase ID token here; we verify it server-side.
   ════════════════════════════════════════════════════════════════ */

// POST /auth/google/callback
router.post('/google/callback', async (req, res) => {
  const { id_token } = req.body;

  console.log('[Google callback] received. token length:', id_token ? id_token.length : 0);

  if (!id_token) {
    req.session.flash = { error: 'Google Sign-In failed: no token received. Please try again.' };
    return res.redirect('/auth/login');
  }

  // ── 1. Verify the ID token server-side ─────────────────────────
  const decoded = await verifyIdToken(id_token);

  if (!decoded) {
    console.error('[Google callback] token verification returned null');
    req.session.flash = {
      error: 'Google Sign-In verification failed. Please try again.',
    };
    return res.redirect('/auth/login');
  }

  console.log('[Google callback] token verified for:', decoded.email, '(uid:', decoded.uid + ')');

  // ── 2. Token is valid — extract user info ──────────────────────
  const { uid, email, name, picture, email_verified } = decoded;
  const firstName = (name || '').split(' ')[0] || 'Guest';
  const lastName  = (name || '').split(' ').slice(1).join(' ') || '';

  // ── 3. Find or create user in our DB ──────────────────────────
  const customerRole = await db.prepare(`SELECT id FROM roles WHERE name = 'customer'`).get();
  if (!customerRole) {
    req.session.flash = { error: 'Account creation is temporarily unavailable.' };
    return res.redirect('/auth/login');
  }

  let user = await db.prepare(`SELECT u.*, r.name AS role, r.label AS role_label
    FROM users u JOIN roles r ON r.id = u.role_id
    WHERE u.firebase_uid = ?`).get(uid);

  if (!user) {
    // Try matching by email — handles the case where they registered by email first
    const byEmail = await db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);

    if (byEmail) {
      // Link the existing account to this Google identity
      await db.prepare(`
        UPDATE users
        SET firebase_uid = ?, auth_provider = 'google',
            email_verified = ?, avatar = COALESCE(NULLIF(avatar,''), ?),
            updated_at = NOW()
        WHERE id = ?
      `).run(uid, email_verified ? 1 : 0, picture || '', byEmail.id);
    } else {
      // Brand new user — create both users + customers rows
      const custCode = 'CUS-' + Date.now().toString().slice(-6);
      
      const newUserResult = await db.prepare(`
        INSERT INTO users
          (role_id, first_name, last_name, email, password_hash, avatar,
           is_active, auth_provider, firebase_uid, email_verified)
        VALUES (?, ?, ?, ?, '', ?, 1, 'google', ?, ?)
      `).run(
        customerRole.id, firstName, lastName, email,
        picture || '', uid, email_verified ? 1 : 0
      );

      const newUid = newUserResult.lastInsertRowid;

      await db.prepare(`
        INSERT INTO customers
          (user_id, customer_code, first_name, last_name, email, phone,
           preferred_contact, customer_type, status)
        VALUES (?, ?, ?, ?, ?, '', 'email', 'regular', 'active')
      `).run(newUid, custCode, firstName, lastName, email);
    }

    // Re-fetch with role join
    user = await db.prepare(`SELECT u.*, r.name AS role, r.label AS role_label
      FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.firebase_uid = ? OR (u.email = ? AND u.firebase_uid IS NULL)
      ORDER BY u.firebase_uid IS NULL ASC LIMIT 1`).get(uid, email);
  }

  if (!user || !user.is_active) {
    req.session.flash = { error: 'Your account is inactive. Please contact support.' };
    return res.redirect('/auth/login');
  }

  // Staff accounts should never be accessible via Google Sign-In
  if (user.role !== 'customer') {
    req.session.flash = {
      error: 'Staff accounts cannot use Google Sign-In. Please use your email and password.',
    };
    return res.redirect('/auth/login');
  }

  // ── 4. Set session ─────────────────────────────────────────────
  await db.prepare(`UPDATE users SET last_login = NOW() WHERE id = ?`).run(user.id);
  req.session.user = buildSessionUser(user);

  const isNewUser = !(await db.prepare(
    `SELECT id FROM customers WHERE user_id = ? AND created_at < datetime('now','-5 seconds')`
  ).get(user.id));

  req.session.flash = isNewUser
    ? { success: `Welcome to Balai-Reserve, ${firstName}! Your account has been created.` }
    : { success: `Welcome back, ${firstName}!` };

  console.log('[Google callback] session set for user id', user.id, '→ redirecting to /portal');

  // Explicitly persist the session BEFORE redirecting.
  // With saveUninitialized:false the store write is async — redirecting
  // immediately can race the write and lose the session.
  return req.session.save((err) => {
    if (err) {
      console.error('[Google callback] session save error:', err.message);
      req.session.flash = { error: 'Could not complete sign-in. Please try again.' };
      return res.redirect('/auth/login');
    }
    return res.redirect('/portal');
  });
});

/* ════════════════════════════════════════════════════════════════
   LOGOUT
   ════════════════════════════════════════════════════════════════ */

// GET /auth/logout
router.get('/logout', async (req, res) => {
  req.session.destroy(() => res.redirect('/auth/login'));
});

module.exports = router;
