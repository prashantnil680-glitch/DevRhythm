const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const AppError = require('../utils/errors/AppError');

// Cache for internal user (used for internal requests)
let internalUserCache = null;

const getInternalUser = async () => {
  if (internalUserCache) return internalUserCache;
  const email = 'internal@devrhythm.space';
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      authProvider: 'google',       // valid enum value
      providerId: 'internal-service',
      email: email,
      username: 'internal_service',
      displayName: 'Internal Service',
      privacy: 'private',
      isActive: true,
      preferences: { notifications: {} },
    });
    console.log('✅ Internal service user created');
  }
  internalUserCache = user;
  return user;
};

const isInternalRequest = (req) => {
  const ip = req.ip || req.connection.remoteAddress;
  const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  const hasInternalHeader = req.headers['x-internal-request'] === 'true';
  return isLocalhost && hasInternalHeader;
};

const verifyToken = (token, secret) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, decoded) => {
      if (err) reject(err);
      else resolve(decoded);
    });
  });
};

const auth = async (req, res, next) => {
  // --- INTERNAL BYPASS ---
 if (isInternalRequest(req)) {
  try {
    const internalUser = await getInternalUser();
    req.user = internalUser;
    return next();
  } catch (err) {
    console.error('Failed to fetch internal user:', err);
    // Fall through to normal auth
  }
}
  // --- END INTERNAL BYPASS ---

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new AppError('Authentication required', 401);
    const decoded = await verifyToken(token, config.jwt.secret);
    const user = await User.findById(decoded.userId).select('-__v');
    if (!user) throw new AppError('User not found', 404);
    if (!user.isActive) throw new AppError('Account deactivated', 403);

    const now = new Date();
    user.lastOnline = now;
    req.user = user;

    User.updateOne({ _id: user._id }, { lastOnline: now }).exec().catch(err => {
      console.error('Failed to update lastOnline:', err);
    });

    next();
  } catch (error) {
    next(error);
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = await verifyToken(token, config.jwt.secret);
      const user = await User.findById(decoded.userId).select('-__v');
      if (user && user.isActive) req.user = user;
    }
    next();
  } catch (error) {
    next();
  }
};

const generateToken = (userId) => {
  return jwt.sign({ userId }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ userId }, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn });
};

module.exports = { auth, optionalAuth, generateToken, generateRefreshToken };