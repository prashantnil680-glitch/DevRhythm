const mongoose = require('mongoose');

const SheetBookmarkSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sheetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sheet',
      required: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    // Future extensibility (folders, custom order, notes)
    folderId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    order: {
      type: Number,
      default: 0,
    },
    note: {
      type: String,
      default: null,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate bookmarks
SheetBookmarkSchema.index({ userId: 1, sheetId: 1 }, { unique: true });

// Compound index for user's bookmarks sorted by createdAt
SheetBookmarkSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('SheetBookmark', SheetBookmarkSchema);