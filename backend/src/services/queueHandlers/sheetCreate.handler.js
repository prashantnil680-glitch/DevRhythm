const SheetService = require('../sheet.service');
const { client: redisClient } = require('../../config/redis');
const Notification = require('../../models/Notification');

/**
 * Update progress in Redis for a given jobId.
 * @param {string} jobId
 * @param {object} update
 */
const updateProgress = async (jobId, update) => {
  const progressKey = `sheet:create:progress:${jobId}`;
  const current = await redisClient.get(progressKey);
  if (current) {
    const data = JSON.parse(current);
    const updated = { ...data, ...update, lastUpdated: new Date().toISOString() };
    await redisClient.setex(progressKey, 3600, JSON.stringify(updated));
  }
};

/**
 * Process sheet creation job.
 * Expected job.data: {
 *   jobId: string,
 *   userId: string,
 *   name: string,
 *   description: string,
 *   questionIdentifiers: string[],
 *   targetDate: string,
 *   specialTag?: string,
 *   originalSourceName?: string,
 *   originalSourceUrl?: string
 * }
 */
const handleSheetCreate = async (job) => {
  const {
    jobId,
    userId,
    name,
    description,
    questionIdentifiers,
    targetDate,
    specialTag,
    originalSourceName,
    originalSourceUrl,
  } = job.data;

  try {
    // Stage 1: Resolving questions
    await updateProgress(jobId, {
      stage: 'resolving',
      totalQuestions: questionIdentifiers.length,
      processed: 0,
      matched: 0,
      skipped: 0,
      unresolved: [],
      currentQuestion: null,
    });

    // Use partial resolution to get matched IDs and track progress
    const { resolvedIds, unresolved } = await SheetService.resolveQuestionIdentifiersPartial(questionIdentifiers);
    const matched = resolvedIds.length;
    const skipped = unresolved.length;

    await updateProgress(jobId, {
      stage: 'resolving',
      processed: questionIdentifiers.length,
      matched,
      skipped,
      unresolved,
      currentQuestion: null,
    });

    if (matched === 0) {
      throw new Error('None of the questions could be matched. Please check the spelling or ensure they exist in the database.');
    }

    // Stage 2: Creating sheet
    await updateProgress(jobId, { stage: 'creating_sheet' });

    const sheet = await SheetService.createSheetWithResolvedIds(
      userId,
      name,
      description,
      resolvedIds.map(id => id.toString()),
      targetDate,
      specialTag,
      originalSourceName,
      originalSourceUrl
    );

    // Stage 3: Finalizing (progress initialization happens inside createSheetWithResolvedIds)
    await updateProgress(jobId, { stage: 'finalizing' });

    // Stage 4: Completed
    await updateProgress(jobId, {
      stage: 'completed',
      sheetId: sheet._id,
      sheetSlug: sheet.slug,
      matched,
      skipped,
      unresolved,
    });

    // Send success notification
    await Notification.create({
      userId,
      type: 'sheet_created',
      title: 'Sheet Created Successfully',
      message: `Your sheet "${sheet.name}" was created with ${matched} questions.${skipped ? ` ${skipped} questions could not be matched and were skipped.` : ''}`,
      data: {
        sheetId: sheet._id,
        sheetSlug: sheet.slug,
        matchedCount: matched,
        skippedCount: skipped,
        unmatched: unresolved.slice(0, 10),
      },
      channel: 'in-app',
      status: 'sent',
      scheduledAt: new Date(),
    });

    // Invalidate caches using centralized method
    await SheetService._invalidateSheetCaches(sheet._id, sheet.slug, userId);

    console.log(`[SheetCreate] Successfully created sheet ${sheet.slug} for user ${userId} (matched: ${matched}, skipped: ${skipped})`);
  } catch (error) {
    console.error(`[SheetCreate] Failed for user ${userId}:`, error.message);

    await updateProgress(jobId, {
      stage: 'failed',
      error: error.message,
    });

    // Send failure notification
    await Notification.create({
      userId,
      type: 'sheet_creation_failed',
      title: 'Sheet Creation Failed',
      message: `Failed to create sheet "${name}": ${error.message}`,
      data: { sheetName: name, error: error.message },
      channel: 'in-app',
      status: 'sent',
      scheduledAt: new Date(),
    });

    throw error;
  }
};

module.exports = { handleSheetCreate };