/**
 * src/jobs/tempFileCleanup.job.js
 *
 * Cron job to clean up stale temporary files and directories.
 * Runs daily at 2:00 AM UTC.
 */

const cron = require('cron');
const fs = require('fs').promises;
const path = require('path');
const { BASE_TEMP_DIR } = require('../services/codeExecution/tempFileManager');

const CLEANUP_AGE_MS = 60 * 60 * 1000; // 1 hour

/**
 * Recursively delete a directory and all its contents.
 * @param {string} dirPath
 */
async function deleteDirectory(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`[TempCleanup] Failed to delete ${dirPath}:`, err.message);
    }
  }
}

/**
 * Delete a single file.
 * @param {string} filePath
 */
async function deleteFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`[TempCleanup] Failed to delete ${filePath}:`, err.message);
    }
  }
}

/**
 * Clean up stale temporary files and directories.
 */
async function cleanupStaleTempFiles() {
  try {
    // Check if base temp directory exists
    try {
      await fs.access(BASE_TEMP_DIR);
    } catch (err) {
      // Directory doesn't exist, nothing to clean
      return;
    }

    const now = Date.now();
    const entries = await fs.readdir(BASE_TEMP_DIR, { withFileTypes: true });
    let deletedCount = 0;

    for (const entry of entries) {
      const fullPath = path.join(BASE_TEMP_DIR, entry.name);
      let stats;
      try {
        stats = await fs.stat(fullPath);
      } catch (err) {
        continue; // File may have been deleted already
      }

      const age = now - stats.mtimeMs;
      if (age > CLEANUP_AGE_MS) {
        if (entry.isDirectory()) {
          await deleteDirectory(fullPath);
        } else {
          await deleteFile(fullPath);
        }
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`[TempCleanup] Removed ${deletedCount} stale temporary items (older than 1 hour)`);
    }
  } catch (err) {
    console.error('[TempCleanup] Job failed:', err);
  }
}

// Schedule at 2:00 AM UTC daily
const tempCleanupJob = new cron.CronJob('0 2 * * *', cleanupStaleTempFiles);

const startTempCleanupJob = () => {
  tempCleanupJob.start();
  console.log('Temporary file cleanup job started (daily at 2:00 AM UTC)');
};

const stopTempCleanupJob = () => {
  tempCleanupJob.stop();
  console.log('Temporary file cleanup job stopped');
};

module.exports = {
  startTempCleanupJob,
  stopTempCleanupJob,
  cleanupStaleTempFiles, // exported for manual testing
};