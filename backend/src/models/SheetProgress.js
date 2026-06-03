const mongoose = require('mongoose');

const SheetProgressSchema = new mongoose.Schema(
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
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
      index: true,
    },
    solved: {
      type: Boolean,
      default: false,
    },
    revisionCompleted: {
      type: Boolean,
      default: false,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure each user has only one progress record per (sheet, question)
SheetProgressSchema.index(
  { sheetId: 1, userId: 1, questionId: 1 },
  { unique: true }
);

// Index for counting participants who solved a specific question in a sheet
SheetProgressSchema.index({ sheetId: 1, questionId: 1, solved: 1 });

// Index for counting participants who completed revisions for a specific question in a sheet
SheetProgressSchema.index({ sheetId: 1, questionId: 1, revisionCompleted: 1 });

// Index for fetching all progress of a user in a sheet (efficient for detailed view)
SheetProgressSchema.index({ sheetId: 1, userId: 1 });

// Index for quickly updating progress when a question is solved/revision completed
SheetProgressSchema.index({ userId: 1, questionId: 1 });

// Index for filtering by solved and revision status together (used in progress endpoint)
SheetProgressSchema.index({ sheetId: 1, userId: 1, solved: 1, revisionCompleted: 1 });

// Index for per‑question stats aggregation (used in sheet details)
SheetProgressSchema.index({ sheetId: 1, questionId: 1 });

// Pre‑save hook to update lastUpdated automatically
SheetProgressSchema.pre('save', function (next) {
  this.lastUpdated = new Date();
  next();
});

// Pre‑update hook to keep lastUpdated fresh (for findOneAndUpdate operations)
SheetProgressSchema.pre('findOneAndUpdate', function (next) {
  this.set({ lastUpdated: new Date() });
  next();
});

module.exports = mongoose.model('SheetProgress', SheetProgressSchema);