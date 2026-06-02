const mongoose = require('mongoose');

const SheetSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        required: true,
      },
    ],
    specialTag: {
      type: String,
      trim: true,
      maxlength: 50,
      default: null,
    },
    originalSourceName: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
    },
    originalSourceUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    bookmarkCount: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
SheetSchema.index({ slug: 1 }, { unique: true });
SheetSchema.index({ ownerId: 1, createdAt: -1 });
SheetSchema.index({ isActive: 1, createdAt: -1 });
SheetSchema.index({ specialTag: 1 });
SheetSchema.index({ originalSourceName: 1 });

// Pre‑save hook unchanged
SheetSchema.pre('save', function (next) {
  if (this.questions && this.questions.length === 0) {
    const err = new Error('Sheet must contain at least one question');
    err.statusCode = 400;
    return next(err);
  }
  next();
});

module.exports = mongoose.model('Sheet', SheetSchema);