const User = require('../../models/User');
const Question = require('../../models/Question');
const PatternMastery = require('../../models/PatternMastery');
const ActivityLog = require('../../models/ActivityLog');
const Notification = require('../../models/Notification');
const { invalidateUserCache, invalidateCache } = require('../../middleware/cache');
const { parseDate } = require('../../utils/helpers/date');

const handleQuestionMastered = async (job) => {
  const { userId, questionId, progressId, masteredAt } = job.data;
  const masteredDate = parseDate(masteredAt);

  try {
    const question = await Question.findById(questionId);
    if (!question) throw new Error('Question not found');

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    // --- 1. Update PatternMastery for each pattern ---
    if (question.pattern && Array.isArray(question.pattern) && question.pattern.length > 0) {
      for (const patternName of question.pattern) {
        let pattern = await PatternMastery.findOne({ userId, patternName });
        if (!pattern) {
          pattern = new PatternMastery({
            userId,
            patternName,
            title: patternName,
            description: `Problems using the ${patternName} pattern`,
          });
        } else {
          if (!pattern.title) pattern.title = patternName;
          if (!pattern.description) pattern.description = `Problems using the ${patternName} pattern`;
        }

        pattern.masteredCount += 1;

        const totalPatternQuestions = await Question.countDocuments({ pattern: patternName });
        pattern.masteryRate = totalPatternQuestions > 0
          ? Math.min(100, (pattern.masteredCount / totalPatternQuestions) * 100)
          : 0;

        pattern.lastPracticed = masteredDate;
        pattern.lastUpdated = new Date();

        const existingEntry = pattern.recentQuestions.find(
          rq => rq.questionId.toString() === questionId.toString()
        );
        if (existingEntry) {
          existingEntry.status = 'Mastered';
        } else {
          pattern.recentQuestions.unshift({
            questionProgressId: progressId,
            questionId,
            platformQuestionId: question.platformQuestionId,
            title: question.title,
            problemLink: question.problemLink,
            platform: question.platform,
            difficulty: question.difficulty,
            solvedAt: masteredDate,
            status: 'Mastered',
            timeSpent: 0,
          });
          if (pattern.recentQuestions.length > 10) pattern.recentQuestions.pop();
        }

        await pattern.save();
      }
      await invalidateCache(`pattern-mastery:*:user:${userId}:*`);
    }

    // --- 2. Update user stats (overall mastery rate) ---
    const allPatterns = await PatternMastery.find({ userId });
    let totalMastered = 0;
    let totalMasteryRate = 0;
    allPatterns.forEach(p => {
      totalMastered += p.masteredCount;
      totalMasteryRate += p.masteryRate;
    });
    const avgMasteryRate = allPatterns.length > 0 ? totalMasteryRate / allPatterns.length : 0;
    user.stats.masteryRate = Math.min(avgMasteryRate, 100);
    await user.save();
    await invalidateUserCache(userId);

    // --- 3. Create ActivityLog ---
    await ActivityLog.create({
      userId,
      action: 'question_mastered',
      targetId: questionId,
      targetModel: 'Question',
      metadata: {
        title: question.title,
        difficulty: question.difficulty,
        platform: question.platform,
        pattern: question.pattern,
      },
      timestamp: masteredDate,
    });

    // --- 4. In-app notification for this mastered question ---
    await Notification.create({
      userId,
      type: 'question_mastered',
      title: 'Problem Mastered!',
      message: `You mastered "${question.title}"`,
      data: {
        questionId,
        platformQuestionId: question.platformQuestionId,
        title: question.title,
        difficulty: question.difficulty,
        platform: question.platform,
      },
      channel: 'in-app',
      status: 'sent',
      scheduledAt: new Date(),
    });

    // --- 5. Milestone Notification ---
    const milestones = [1, 10, 25, 50, 100, 250, 500, 1000];
    if (milestones.includes(totalMastered)) {
      await Notification.create({
        userId,
        type: 'goal_completion',
        title: 'Mastery Milestone!',
        message: `Congratulations! You've mastered ${totalMastered} problems.`,
        data: { milestone: totalMastered },
        channel: 'in-app',
        status: 'sent',
        scheduledAt: new Date(),
      });
    }

    await invalidateCache(`notifications:*:user:${userId}:*`);
    console.log(`Question mastered event processed for user ${userId}`);
  } catch (error) {
    console.error('Error in questionMastered handler:', error);
    throw error;
  }
};

module.exports = { handleQuestionMastered };