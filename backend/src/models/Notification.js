const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: [
      'revision_reminder_daily',
      'revision_reminder_urgent',
      'goal_completion',
      'streak_reminder',
      'new_follower',
      'weekly_report',
      'question_solved',
      'question_mastered',
      'revision_completed',
      'pod_available',
      'pod_solved',
      'sheet_created',
      'sheet_import_completed',
      'sheet_import_failed',
      'sheet_creation_failed',
    ],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  channel: {
    type: String,
    enum: ['in-app', 'email', 'both'],
    default: 'in-app',
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed'],
    default: 'pending',
  },
  scheduledAt: {
    type: Date,
    default: Date.now,
  },
  sentAt: Date,
  readAt: Date,
  expiresAt: Date,
}, {
  timestamps: true,
});

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ status: 1, scheduledAt: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', NotificationSchema);