const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  authProvider: {
    type: String,
    enum: ['google', 'github'],
    required: true
  },
  providerId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  avatarUrl: String,
  streak: {
    current: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    lastActiveDate: { type: Date, default: null }
  },
  stats: {
    totalSolved: { type: Number, default: 0 },
    masteryRate: { type: Number, default: 0, min: 0, max: 100 },
    totalRevisions: { type: Number, default: 0 },
    totalTimeSpent: { type: Number, default: 0 },
    activeDays: { type: Number, default: 0 }
  },
  preferences: {
    timezone: { type: String },
    notifications: {
      revisionReminders: { type: Boolean, default: true },
      goalTracking: { type: Boolean, default: true },
      socialInteractions: { type: Boolean, default: true },
      weeklyReports: { type: Boolean, default: true }
    },
    dailyGoal: { type: Number, min: 1, max: 50, default: null },
    weeklyGoal: { type: Number, min: 5, max: 100, default: null }
  },
  lastOnline: {
    type: Date,
    default: Date.now
  },
  accountCreated: {
    type: Date,
    default: Date.now
  },
  followersCount: {
    type: Number,
    default: 0
  },
  followingCount: {
    type: Number,
    default: 0
  },
  privacy: {
    type: String,
    enum: ['public', 'private', 'link-only'],
    default: 'public'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastDigestSentAt: {
    type: Date,
    default: null
  },
  isNewUser: {
    type: Boolean,
    default: true,
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },
  lastWelcomeBackShownAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true
});

// ========== PERFORMANCE INDEXES ==========
// Basic unique indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ providerId: 1 }, { unique: true });

// Visibility + active + exclude self – used by /users endpoint
UserSchema.index({ privacy: 1, isActive: 1, _id: 1 });

// Sorting indexes (descending order for most common sorts)
UserSchema.index({ 'stats.totalSolved': -1 });
UserSchema.index({ 'stats.masteryRate': -1 });
UserSchema.index({ 'stats.totalTimeSpent': -1 });
UserSchema.index({ createdAt: -1 });

// Search indexes (prefix search)
UserSchema.index({ username: 1 });
UserSchema.index({ displayName: 1 });

// Compound indexes for multi‑field static sorts
UserSchema.index({ 'stats.masteryRate': -1, 'stats.totalSolved': -1 });
UserSchema.index({ 'stats.totalSolved': -1, 'stats.masteryRate': -1 });
UserSchema.index({ 'stats.totalTimeSpent': -1, 'stats.totalSolved': -1 });

// Other existing indexes (preserved)
UserSchema.index({ 'streak.current': -1 });
UserSchema.index({ lastOnline: -1 });
UserSchema.index({ 'preferences.timezone': 1 });
UserSchema.index({ privacy: 1, 'stats.totalSolved': -1 });

module.exports = mongoose.model('User', UserSchema);