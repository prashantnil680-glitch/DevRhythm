const jwt = require('jsonwebtoken');
const passport = require('passport');
const crypto = require('crypto');
const geoip = require('geoip-lite');                         
const { client: redisClient } = require('../config/redis');
const { generateToken, generateRefreshToken } = require('../middleware/auth');
const { invalidateUserCache } = require('../middleware/cache');
const { formatResponse } = require('../utils/helpers/response');
const config = require('../config');
const AppError = require('../utils/errors/AppError');
const User = require('../models/User');

/**
 * Helper to detect timezone from IP address
 * Returns 'Asia/Kolkata' for Indian IPs, otherwise 'UTC'
 */
const detectTimezoneFromIp = (ip) => {
  try {
    const geo = geoip.lookup(ip);
    if (geo && geo.country === 'IN') return 'Asia/Kolkata';
    return 'UTC';
  } catch (err) {
    console.warn('GeoIP lookup failed:', err.message);
    return 'UTC';
  }
};

const initiateOAuth = (provider) => (req, res, next) => {
  const state = crypto.randomBytes(32).toString('hex');
  const redirectUri = req.query.redirect_uri || config.frontendUrl;
  
  // Store the frontend redirect URI with state
  redisClient.setex(`devrhythm:auth:${provider}:state:${state}`, 300, redirectUri);
  
  const authParams = {
    state,
    callbackURL: config.oauth[provider].callbackUrl,
    scope: provider === 'google' ? ['profile', 'email'] : ['user:email', 'read:user']
  };
  
  // Use passport authenticate
  passport.authenticate(provider, authParams)(req, res, next);
};

const handleOAuthCallback = (provider) => (req, res, next) => {
  passport.authenticate(provider, { session: false }, async (err, user, info) => {
    try {
      if (err || !user) {
        console.error('OAuth error:', err || info);
        return res.redirect(`${config.frontendUrl}/auth/callback?error=${encodeURIComponent(info?.message || 'Authentication failed')}`);
      }

      // --- DETECT AND SET TIMEZONE IF NOT ALREADY SET ---
      if (!user.preferences?.timezone) {
        const detectedTz = detectTimezoneFromIp(req.ip);
        user.preferences = user.preferences || {};
        user.preferences.timezone = detectedTz;
        await user.save();
        console.log(`Timezone set to ${detectedTz} for user ${user._id} based on IP ${req.ip}`);
      }
      
      if (!user.lastLoginAt) {
        user.lastLoginAt = new Date();
        await user.save();
      }

      const token = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      const code = crypto.randomBytes(32).toString('hex');
      const codeKey = `devrhythm:auth:code:${code}`;
      await redisClient.setex(codeKey, 300, JSON.stringify({
        userId: user._id.toString(),
        token,
        refreshToken
      }));

      const redirectUrl = new URL(`${config.frontendUrl}/auth/callback`);
      redirectUrl.searchParams.set('code', code);
      res.redirect(redirectUrl.toString());
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect(`${config.frontendUrl}/auth/callback?error=${encodeURIComponent('Internal server error')}`);
    }
  })(req, res, next);
};

const logout = async (req, res, next) => {
  try {
    if (req.user) {
      await invalidateUserCache(req.user._id);
    }
    req.logout(() => {
      res.json(formatResponse('Logged out successfully'));
    });
  } catch (error) {
    next(error);
  }
};

const validateSession = async (req, res, next) => {
  try {
    res.json(formatResponse('Session is valid', {
      session: {
        userId: req.user._id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        isValid: true
      }
    }));
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new AppError('Refresh token required', 400);
    }

    // Verify the refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch (err) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    // Find the user
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401);
    }

    // Optional: Check if this refresh token has been blacklisted (if you implement revocation)
    const isBlacklisted = await redisClient.get(`blacklist:refresh:${refreshToken}`);
    if (isBlacklisted) {
      throw new AppError('Refresh token revoked', 401);
    }

    // Generate new tokens
    const newAccessToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    // (Optional) Blacklist the old refresh token – prevents reuse if stolen
    // Set expiry equal to the token's remaining lifetime (or simply 30 days)
    await redisClient.setex(`blacklist:refresh:${refreshToken}`, 30 * 24 * 60 * 60, '1');

    // Send the new pair
    res.json(formatResponse('Session refreshed successfully', {
      token: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // access token expiry
    }));
  } catch (error) {
    next(error);
  }
};

const getProviders = async (req, res, next) => {
  try {
    const providers = [
      {
        id: 'google',
        name: 'Google',
        authUrl: `${config.backendUrl}/api/v1/auth/google`,
        scopes: ['profile', 'email']
      },
      {
        id: 'github',
        name: 'GitHub',
        authUrl: `${config.backendUrl}/api/v1/auth/github`,
        scopes: ['user:email', 'read:user']
      }
    ];
    
    res.json(formatResponse('Available providers retrieved', { providers }));
  } catch (error) {
    next(error);
  }
};

const exchangeCode = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) {
      throw new AppError('Code is required', 400);
    }
    
    const codeKey = `devrhythm:auth:code:${code}`;
    const stored = await redisClient.get(codeKey);
    if (!stored) {
      throw new AppError('Invalid or expired code', 401);
    }
    
    // Delete code immediately to prevent replay
    await redisClient.del(codeKey);
    
    const { userId, token, refreshToken } = JSON.parse(stored);
    
    // Fetch user to update lastLoginAt and compute welcome flags
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Update lastLoginAt (used for welcome-back detection)
    const now = new Date();
    user.lastLoginAt = now;
    await user.save();
    
    // Compute welcome flags
    const showWelcome = user.isNewUser === true;
    const showWelcomeBack = !user.isNewUser && 
      (user.lastWelcomeBackShownAt === null || user.lastWelcomeBackShownAt < user.lastLoginAt);
    
    // Optionally set a secure HTTP‑only cookie for server‑side auth
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    res.json(formatResponse('Code exchanged successfully', {
      token,
      refreshToken,
      userId,
      showWelcome,
      showWelcomeBack,
    }));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  initiateGoogleOAuth: initiateOAuth('google'),
  handleGoogleCallback: handleOAuthCallback('google'),
  initiateGitHubOAuth: initiateOAuth('github'),
  handleGitHubCallback: handleOAuthCallback('github'),
  logout,
  validateSession,
  refreshToken,
  getProviders,
  exchangeCode,
};