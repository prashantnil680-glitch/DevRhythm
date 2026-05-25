const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    problemLink: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: ["LeetCode", "Codeforces", "HackerRank", "AtCoder", "CodeChef", "GeeksForGeeks", "Other"],
      required: true,
    },
    platformQuestionId: {
      type: String,
      required: true,
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      required: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    pattern: [
      {
        type: String,
        trim: true,
      },
    ],
    solutionLinks: [
      {
        type: String,
        trim: true,
      },
    ],
    similarQuestions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
      },
    ],
    contentRef: {
      type: String,
    },
    testCases: [
      {
        stdin: { type: String, default: "" },
        expected: { type: String, required: true },
        isDefault: { type: Boolean, default: true },
      },
    ],
    starterCode: {
      type: Map,
      of: String,
      default: {},
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    source: {
      type: String,
      enum: ["manual", "leetcode"],
      default: "manual",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    executionMetadata: {
      type: Map,
      of: new mongoose.Schema(
        {
          className: { type: String, default: null },
          methodName: { type: String, required: true },
          returnType: { type: String, required: true },
          parameters: [
            {
              name: { type: String, required: true },
              type: { type: String, required: true },
            },
          ],
          dataStructures: [{ type: String }], 
          interactive: { type: Boolean, default: false },
          methods: [
            {
              name: { type: String, required: true },
              returnType: { type: String, required: true },
              parameters: [{ type: String }], 
            },
          ],
          constructorParams: [{ type: String }],
        },
        { _id: false }
      ),
      default: {},
    },
    // =================================================================
  },
  {
    timestamps: true,
  }
);

QuestionSchema.index({ platform: 1, platformQuestionId: 1 }, { unique: true });
QuestionSchema.index({ difficulty: 1 });
QuestionSchema.index({ pattern: 1 });
QuestionSchema.index({ tags: 1 });
QuestionSchema.index({ title: "text", pattern: "text" });
QuestionSchema.index({ platform: 1, difficulty: 1, pattern: 1 });
QuestionSchema.index({ createdBy: 1 });

// New index for efficient queries on execution metadata (if needed)
QuestionSchema.index({ "executionMetadata.methodName": 1 });

QuestionSchema.pre("save", function (next) {
  if (this.pattern && !Array.isArray(this.pattern)) {
    this.pattern = [this.pattern];
  }
  next();
});

module.exports = mongoose.model("Question", QuestionSchema);