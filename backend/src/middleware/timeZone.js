const geoip = require('geoip-lite');
const User = require('../models/User');

/**
 * Attaches `req.userTimeZone` (string IANA timezone, e.g. 'Asia/Kolkata', 'UTC')
 * For authenticated users, reads from their preferences or auto‑detects
 * For non‑authenticated, defaults to UTC.
 */
const attachUserTimeZone = async (req, res, next) => {
  if (req.user && req.user._id) {
    try {
      // If already set in user object, use it
      if (req.user.preferences?.timezone) {
        req.userTimeZone = req.user.preferences.timezone;
        return next();
      }

      // Auto‑detect from IP address
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const geo = geoip.lookup(ip);
      let detected = 'UTC';
      if (geo && geo.country === 'IN') detected = 'Asia/Kolkata';

      // Save detected timezone to user preferences (non‑blocking)
      req.user.preferences = req.user.preferences || {};
      req.user.preferences.timezone = detected;
      await req.user.save().catch(err => console.error('Failed to save timezone:', err));

      req.userTimeZone = detected;
    } catch (err) {
      console.warn('Timezone detection error, fallback UTC:', err.message);
      req.userTimeZone = 'UTC';
    }
  } else {
    req.userTimeZone = 'UTC';
  }
  next();
};

module.exports = { attachUserTimeZone };