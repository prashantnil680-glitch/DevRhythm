const SheetService = require('../sheet.service');
const { client: redisClient } = require('../../config/redis');
const Notification = require('../../models/Notification');

/**
 * Process sheet import job asynchronously.
 * Expected job.data: {
 *   jobId: string,
 *   userId: string,
 *   sheetName: string,
 *   description: string,
 *   identifiers: string[],
 *   targetDate: string,
 *   specialTag?: string,
 *   originalSourceName?: string,
 *   originalSourceUrl?: string
 * }
 */
const handleSheetImport = async (job) => {
  const {
    jobId,
    userId,
    sheetName,
    description,
    identifiers,
    targetDate,
    specialTag,
    originalSourceName,
    originalSourceUrl,
  } = job.data;

  const progressKey = `import:progress:${jobId}`;

  const updateProgress = async (update) => {
    const current = await redisClient.get(progressKey);
    if (current) {
      const data = JSON.parse(current);
      const updated = { ...data, ...update, lastUpdated: new Date().toISOString() };
      await redisClient.setex(progressKey, 3600, JSON.stringify(updated));
    }
  };

  try {
    // Stage: Matching questions
    await updateProgress({
      stage: 'matching',
      processed: 0,
      matched: 0,
      skipped: 0,
      currentQuestion: null,
      unresolved: [],
    });

    // Resolve identifiers with partial matching (non‑throwing)
    const { resolvedIds, unresolved } = await SheetService.resolveQuestionIdentifiersPartial(identifiers);
    const matched = resolvedIds.length;
    const skipped = unresolved.length;

    // Update progress after matching
    await updateProgress({
      stage: 'matching',
      processed: identifiers.length,
      matched,
      skipped,
      unresolved,
      currentQuestion: null,
    });

    if (matched === 0) {
      throw new Error('No questions could be matched from the uploaded file');
    }

    // Stage: Creating sheet
    await updateProgress({ stage: 'creating' });

    // Create the sheet (auto‑creates owner membership with targetDate)
    const sheet = await SheetService.createSheet(
      userId,
      sheetName,
      description,
      resolvedIds.map(id => id.toString()),
      targetDate,
      specialTag,
      originalSourceName,
      originalSourceUrl
    );

    // Stage: Completed
    await updateProgress({
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
      type: 'sheet_import_completed',
      title: 'Sheet Import Completed',
      message: `Your sheet "${sheetName}" was successfully created with ${matched} questions.${skipped ? ` ${skipped} questions could not be matched.` : ''}`,
      data: {
        sheetId: sheet._id,
        sheetSlug: sheet.slug,
        matchedCount: matched,
        skippedCount: skipped,
        unmatchedRows: unresolved.slice(0, 10),
      },
      channel: 'in-app',
      status: 'sent',
      scheduledAt: new Date(),
    });

    // Invalidate caches using centralized method
    await SheetService._invalidateSheetCaches(sheet._id, sheet.slug, userId);

    console.log(`[SheetImport] Successfully created sheet ${sheet.slug} for user ${userId} (matched: ${matched}, skipped: ${skipped})`);
  } catch (error) {
    console.error(`[SheetImport] Failed for user ${userId}:`, error.message);

    await updateProgress({
      stage: 'failed',
      error: error.message,
    });

    // Send failure notification
    await Notification.create({
      userId,
      type: 'sheet_import_failed',
      title: 'Sheet Import Failed',
      message: `Failed to import sheet "${sheetName}": ${error.message}`,
      data: { sheetName, error: error.message },
      channel: 'in-app',
      status: 'sent',
      scheduledAt: new Date(),
    });

    throw error;
  }
};

module.exports = { handleSheetImport };