const mongoose = require('mongoose');

const CodeExecutionJobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
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
    testCases: [
      {
        stdin: { type: String, default: '' },
        expected: { type: String, required: true },
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      required: true,
      index: true,
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    bullJobId: {
      type: String,
      default: null,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
  },
  {
    timestamps: true,
  }
);

// TTL index: automatically delete documents after 1 hour of completion/failure
CodeExecutionJobSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 3600,
    partialFilterExpression: {
      status: { $in: ['completed', 'failed'] },
    },
  }
);

// Index for polling by user and jobId
CodeExecutionJobSchema.index({ userId: 1, jobId: 1 });

module.exports = mongoose.model('CodeExecutionJob', CodeExecutionJobSchema);