const geoip = require('geoip-lite');
const User = require('../models/User');

/**
 * Attaches `req.userTimeZone` (string IANA timezone, e.g. 'Asia/Kolkata', 'UTC')
 * For authenticated users, reads from their preferences or auto‑detects
 * For non‑authenticated, defaults to UTC.
 * 
 * If user.preferences.timezone is missing or 'UTC', it will attempt to set a better default.
 */
const attachUserTimeZone = async (req, res, next) => {
  // Default fallback
  let detected = 'UTC';

  // Try to detect from IP address
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const geo = geoip.lookup(ip);
  if (geo && geo.country === 'IN') {
    detected = 'Asia/Kolkata';
  }

  if (req.user && req.user._id) {
    try {
      // If user already has a non‑UTC timezone, use it
      if (req.user.preferences?.timezone && req.user.preferences.timezone !== 'UTC') {
        req.userTimeZone = req.user.preferences.timezone;
        return next();
      }

      // Otherwise, set the detected timezone (or keep UTC)
      req.userTimeZone = detected;

      // Save to database only if it's different from current (and not already set)
      if (!req.user.preferences) req.user.preferences = {};
      if (req.user.preferences.timezone !== detected) {
        req.user.preferences.timezone = detected;
        await req.user.save();
        console.log(`Timezone set to ${detected} for user ${req.user._id} based on IP ${ip}`);
      }
    } catch (err) {
      console.warn('Timezone detection/save error, fallback UTC:', err.message);
      req.userTimeZone = 'UTC';
    }
  } else {
    req.userTimeZone = detected;
  }
  next();
};

module.exports = { attachUserTimeZone };