const mongoose = require('mongoose');

const RevisionScheduleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true,
  },
  schedule: {
    type: [Date],
    required: true,
  },
  completedRevisions: [{
    date: Date,
    completedAt: Date,
    status: {
      type: String,
      enum: ['completed', 'skipped', 'auto_skipped'],
    },
    timeSpent: { type: Number, default: 0 },
    confidenceAfter: { type: Number, min: 0, max: 5 },
    overdueCompleted: { type: Boolean, default: false },
    skipped: { type: Boolean, default: false },
    outOfOrder: { type: Boolean, default: false }
  }],
  currentRevisionIndex: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'overdue'],
    default: 'active',
  },
  overdueCount: {
    type: Number,
    default: 0,
  },
  overdueActive: {
    type: Boolean,
    default: false,
    index: true,
  },
  baseDate: {
    type: Date,
    required: true,
  },
}, {
  timestamps: true,
});

// Indexes
RevisionScheduleSchema.index({ userId: 1, status: 1 });
RevisionScheduleSchema.index({ userId: 1, schedule: 1 });
RevisionScheduleSchema.index({ userId: 1, questionId: 1 }, { unique: true });
RevisionScheduleSchema.index({ schedule: 1, status: 1 });
RevisionScheduleSchema.index({ userId: 1, currentRevisionIndex: 1 });
RevisionScheduleSchema.index({ userId: 1, overdueActive: 1 });
RevisionScheduleSchema.index({ schedule: 1, userId: 1, status: 1 });

// TTL index removed to prevent automatic deletion of completed revision schedules.
// Completed schedules will remain in the database indefinitely, preserving revision history.

module.exports = mongoose.model('RevisionSchedule', RevisionScheduleSchema);