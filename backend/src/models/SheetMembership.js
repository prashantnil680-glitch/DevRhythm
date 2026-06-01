const mongoose = require('mongoose');

const SheetMembershipSchema = new mongoose.Schema(
  {
    sheetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sheet',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetDate: {
      type: Date,
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure a user can join the same sheet only once
SheetMembershipSchema.index({ sheetId: 1, userId: 1 }, { unique: true });

// Index for querying active memberships (not completed) by target date (e.g., for reminders)
SheetMembershipSchema.index({ targetDate: 1, completedAt: 1 });

// Index for fetching all sheets a user has joined
SheetMembershipSchema.index({ userId: 1, joinedAt: -1 });

module.exports = mongoose.model('SheetMembership', SheetMembershipSchema);