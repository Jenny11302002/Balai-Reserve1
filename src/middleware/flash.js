/**
 * Flash message middleware
 * Reads flash from session and exposes it to views, then clears it.
 */
'use strict';

module.exports = function flashMiddleware(req, res, next) {
  res.locals.flash = req.session.flash || {};
  if (req.session.flash) {
    delete req.session.flash;
  }
  next();
};
