const SheetService = require('../sheet.service');
const { parseExcelFile } = require('../excelParser.service');
const Question = require('../../models/Question');
const Notification = require('../../models/Notification');
const { invalidateCache } = require('../../middleware/cache');

/**
 * Process sheet import job asynchronously.
 * Expected job.data: {
 *   userId: string,
 *   sheetName: string,
 *   description: string,
 *   targetDate: string (ISO date),
 *   fileBuffer: Buffer,
 *   filename: string
 * }
 */
const handleSheetImport = async (job) => {
  const { userId, sheetName, description, targetDate, fileBuffer, filename } = job.data;

  console.log(`[SheetImport] Processing import for user ${userId}, sheet: ${sheetName}`);

  try {
    // Parse the uploaded file
    const parsedRows = await parseExcelFile(fileBuffer, filename);

    if (parsedRows.length === 0) {
      throw new Error('No valid question data found in the file');
    }

    // Build identifiers array
    const identifiers = parsedRows.map(row => row.platformQuestionId || row.title).filter(Boolean);

    if (identifiers.length === 0) {
      throw new Error('No valid question titles or slugs found in the file');
    }

    // Create the sheet (auto‑creates owner membership with targetDate)
    const sheet = await SheetService.createSheet(
      userId,
      sheetName,
      description || '',
      identifiers,
      targetDate
    );

    // Send success notification
    await Notification.create({
      userId,
      type: 'sheet_import_completed',
      title: 'Sheet Import Completed',
      message: `Your sheet "${sheetName}" was successfully created with ${identifiers.length} questions.`,
      data: {
        sheetId: sheet._id,
        sheetSlug: sheet.slug,
        matchedCount: identifiers.length,
      },
      channel: 'in-app',
      status: 'sent',
      scheduledAt: new Date(),
    });

    // Invalidate caches
    await invalidateCache('sheets:list:*');
    await invalidateCache(`user:${userId}:sheets:*`);

    console.log(`[SheetImport] Successfully created sheet ${sheet.slug} for user ${userId}`);
  } catch (error) {
    console.error(`[SheetImport] Failed for user ${userId}:`, error.message);

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

    // Re‑throw to let Bull handle retries
    throw error;
  }
};

module.exports = { handleSheetImport };