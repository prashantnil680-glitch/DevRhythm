const mongoose = require("mongoose");

const ActivityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        "question_solved",
        "question_mastered",
        "revision_completed",
        "goal_achieved",
        "joined_group",
        "created_share",
        "followed_user",
        "group_goal_progress",
        "group_goal_completed",
        "group_challenge_progress",
        "group_challenge_completed",
      ],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "targetModel",
    },
    targetModel: {
      type: String,
      enum: ["Question", "Goal", "StudyGroup", "Share", "User"],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

ActivityLogSchema.index({ userId: 1, timestamp: -1 });
ActivityLogSchema.index({ action: 1, timestamp: -1 });
ActivityLogSchema.index({ action: 1, timestamp: 1, userId: 1 });

module.exports = mongoose.model("ActivityLog", ActivityLogSchema);
