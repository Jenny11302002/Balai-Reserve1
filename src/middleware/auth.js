/**
 * Authentication & Authorization Middleware
 */
'use strict';

/**
 * Require the user to be logged in.
 * Redirects to /auth/login if not authenticated.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.session.flash = { error: 'Please log in to continue.' };
  req.session.returnTo = req.originalUrl;
  return res.redirect('/auth/login');
}

/**
 * Require one of the specified roles.
 * Usage: requireRole('admin') or requireRole('admin', 'staff')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      req.session.flash = { error: 'Please log in to continue.' };
      return res.redirect('/auth/login');
    }
    if (roles.includes(req.session.user.role)) {
      return next();
    }
    return res.status(403).render('errors/403', {
      title: 'Access Denied',
      layout: 'layouts/main',
      message: 'You do not have permission to access this page.',
    });
  };
}

/**
 * Redirect already-logged-in users away from login/register pages.
 */
function guestOnly(req, res, next) {
  if (req.session && req.session.user) {
    const role = req.session.user.role;
    if (role === 'customer') return res.redirect('/portal');
    return res.redirect('/dashboard');
  }
  next();
}

/**
 * Attach audit log helper to req for use in route handlers.
 */
function attachAudit(db) {
  return (req, res, next) => {
    req.audit = async function (action, module_, recordId, oldVals, newVals) {
      try {
        await db.prepare(`
          INSERT INTO audit_logs (user_id, action, module, record_id, old_values, new_values, ip_address, user_agent)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          req.session?.user?.id || null,
          action,
          module_,
          recordId || null,
          oldVals ? JSON.stringify(oldVals) : null,
          newVals ? JSON.stringify(newVals) : null,
          req.ip,
          req.headers['user-agent'] || null,
        );
      } catch { /* audit failures should not crash the app */ }
    };
    next();
  };
}

module.exports = { requireAuth, requireRole, guestOnly, attachAudit };