const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const config = require('./index');
const User = require('../models/User');

passport.use(new GoogleStrategy({
  clientID: config.oauth.google.clientId,
  clientSecret: config.oauth.google.clientSecret,
  callbackURL: config.oauth.google.callbackUrl,
  scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      // ✅ Allow login regardless of provider – same email = same account
      existingUser.lastOnline = new Date();
      await existingUser.save();
      return done(null, existingUser);
    }
    
    // No existing user – create a new one
    const newUser = new User({
      authProvider: 'google',
      providerId: profile.id,
      email: email,
      username: profile.emails[0].value.split('@')[0] + '_' + profile.id.slice(0, 8),
      displayName: profile.displayName,
      avatarUrl: profile.photos[0]?.value,
      lastOnline: new Date()
    });
    await newUser.save();
    done(null, newUser);
  } catch (error) {
    done(error, null);
  }
}));

passport.use(new GitHubStrategy({
  clientID: config.oauth.github.clientId,
  clientSecret: config.oauth.github.clientSecret,
  callbackURL: config.oauth.github.callbackUrl,
  scope: ['user:email', 'read:user']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      // ✅ Allow login regardless of provider – same email = same account
      existingUser.lastOnline = new Date();
      await existingUser.save();
      return done(null, existingUser);
    }
    
    const newUser = new User({
      authProvider: 'github',
      providerId: profile.id,
      email: email,
      username: profile.username + '_' + profile.id.slice(0, 8),
      displayName: profile.displayName || profile.username,
      avatarUrl: profile.photos[0]?.value,
      lastOnline: new Date()
    });
    await newUser.save();
    done(null, newUser);
  } catch (error) {
    done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;