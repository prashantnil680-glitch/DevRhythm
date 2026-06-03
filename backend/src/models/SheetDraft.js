const mongoose = require('mongoose');

const SheetDraftSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['manual', 'import'],
      required: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {},
    },
  },
  {
    timestamps: {
      createdAt: false,
      updatedAt: true,
    },
  }
);

// Ensure one draft per user per type
SheetDraftSchema.index({ userId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('SheetDraft', SheetDraftSchema);