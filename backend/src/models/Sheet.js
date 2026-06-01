const mongoose = require('mongoose');

const SheetSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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

// Indexes for common queries
SheetSchema.index({ ownerId: 1, createdAt: -1 });
SheetSchema.index({ isActive: 1, createdAt: -1 });
SheetSchema.index({ slug: 1 }, { unique: true });

// Pre‑save hook to ensure questions array is not empty
SheetSchema.pre('save', function (next) {
  if (this.questions && this.questions.length === 0) {
    const err = new Error('Sheet must contain at least one question');
    err.statusCode = 400;
    return next(err);
  }
  next();
});

module.exports = mongoose.model('Sheet', SheetSchema);