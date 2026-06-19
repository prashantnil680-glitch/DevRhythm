/**
 * Automatically update question progress status based on engagement metrics.
 * Handles:
 * - Not Started → Attempted (when attempts.count > 0)
 * - Attempted → Solved (when attempts.solvedAt is set)
 * - Solved → Mastered (when revisionCount ≥ 3, totalTimeSpent ≥ 30 minutes,
 *   and the "raw" confidence score (calculated only for mastery detection)
 *   would be at least 4 – but we do not store the confidence score here,
 *   we only set status to Mastered).
 *
 * Confidence is NOT updated here; it is managed separately via background jobs
 * that increment confidence by +0.25 per qualifying action (solving, revision,
 * time threshold, goal completion).
 *
 * @param {Object} progress - Mongoose document of UserQuestionProgress
 * @returns {boolean} - Whether any change was made to the document
 */

const ActivityLog = require('../models/ActivityLog');
const Question = require('../models/Question');

const updateProgressStatus = async (progress) => {
  const { status, attempts, revisionCount, totalTimeSpent, userId, questionId } = progress;
  let changed = false;

  // ----- Helper: compute raw confidence score for mastery detection only -----
  const computeRawConfidence = () => {
    const successfulAttempts = (status === 'Solved' || status === 'Mastered' ? 1 : 0) + revisionCount;
    const successRate = attempts.count > 0 ? successfulAttempts / attempts.count : 0;

    let score = 1.0; // base level

    if (status === 'Solved' || status === 'Mastered') score += 1.5;
    score += Math.min(revisionCount, 5) * 0.4;
    if (successRate >= 0.8) score += 0.5;
    if (successRate >= 0.9) score += 0.5;
    score += Math.min(totalTimeSpent / 60, 2) * 0.5;

    return Math.min(5, Math.max(1, Math.round(score)));
  };

  // ----- Mastered condition detection -----
  const rawConfidence = computeRawConfidence();
  const meetsMasteredConditions =
    status === 'Solved' &&
    revisionCount >= 3 &&
    totalTimeSpent >= 30 &&
    rawConfidence >= 4;

  if (meetsMasteredConditions && status !== 'Mastered') {
    progress.status = 'Mastered';
    progress.attempts.masteredAt = new Date();
    changed = true;

    // ========== Create ActivityLog for mastering ==========
    try {
      const question = await Question.findById(questionId).select('title platform platformQuestionId difficulty pattern').lean();
      if (question) {
        await ActivityLog.create({
          userId,
          action: 'question_mastered',
          targetId: questionId,
          targetModel: 'Question',
          metadata: {
            title: question.title,
            platformQuestionId: question.platformQuestionId,
            difficulty: question.difficulty,
            platform: question.platform,
            pattern: question.pattern,
          },
          timestamp: new Date(),
        });
        console.log(`[Mastered] ActivityLog created for user ${userId}, question ${questionId}`);
      }
    } catch (err) {
      // Log error but do not prevent status update
      console.error('[Mastered] Failed to create ActivityLog:', err.message);
    }
  }

  // ----- Other status progressions (only if not Mastered) -----
  if (progress.status !== 'Mastered') {
    // Not Started → Attempted after first attempt
    if (progress.status === 'Not Started' && attempts.count > 0) {
      progress.status = 'Attempted';
      changed = true;
    }

    // Attempted → Solved once solvedAt is set
    if (progress.status === 'Attempted' && attempts.solvedAt) {
      progress.status = 'Solved';
      changed = true;
    }
  }

  if (changed) progress.updatedAt = new Date();
  return changed;
};

module.exports = { updateProgressStatus };