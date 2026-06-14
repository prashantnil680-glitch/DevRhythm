const mongoose = require('mongoose');

const CodeExecutionHistorySchema = new mongoose.Schema(
  {
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
    language: {
      type: String,
      enum: ['cpp', 'python', 'java', 'javascript'],
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    normalizedCodeHash: {
      type: String,
      index: true,
      trim: true,
    },
    testCases: [
      {
        stdin: String,
        expected: String,
        output: String,
        error: String,
        exitCode: Number,
        passed: Boolean,
      },
    ],
    summary: {
      passedCount: Number,
      totalCount: Number,
      allPassed: Boolean,
      defaultTestCasesCount: Number,
      userCustomTestCasesCount: Number,
      customTestCasesCount: Number,
    },
    executedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast execution matching (used by history reuse feature)
CodeExecutionHistorySchema.index(
  { userId: 1, questionId: 1, language: 1, normalizedCodeHash: 1 },
  { name: 'idx_execution_match' }
);

module.exports = mongoose.model('CodeExecutionHistory', CodeExecutionHistorySchema);