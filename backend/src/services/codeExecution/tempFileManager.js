const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Base directory for all DevRhythm temp files
const BASE_TEMP_DIR = path.join(os.tmpdir(), 'devrhythm-temp');

// Track all created directories and files for cleanup
const createdPaths = new Set();

/**
 * Ensures the base temp directory exists.
 */
async function ensureBaseDir() {
  try {
    await fs.mkdir(BASE_TEMP_DIR, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

/**
 * Creates a unique temporary directory.
 * @returns {Promise<string>} Path to the created directory.
 */
async function createTempDir() {
  await ensureBaseDir();
  const dirPath = await fs.mkdtemp(path.join(BASE_TEMP_DIR, 'dir-'));
  createdPaths.add(dirPath);
  return dirPath;
}

/**
 * Creates a unique temporary file with optional content.
 * @param {string} [content=''] - Initial file content.
 * @param {string} [ext='.tmp'] - File extension (including dot).
 * @returns {Promise<{path: string, writeFile: Function}>} Object with file path and a write method.
 */
async function createTempFile(content = '', ext = '.tmp') {
  await ensureBaseDir();
  const fileName = `file-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(BASE_TEMP_DIR, fileName);
  await fs.writeFile(filePath, content, 'utf8');
  createdPaths.add(filePath);
  return {
    path: filePath,
    /**
     * Overwrites the file content.
     * @param {string} newContent
     */
    async write(newContent) {
      await fs.writeFile(filePath, newContent, 'utf8');
    },
  };
}

/**
 * Deletes a specific file or directory (recursive).
 * @param {string} targetPath
 */
async function cleanupPath(targetPath) {
  try {
    const stat = await fs.stat(targetPath);
    if (stat.isDirectory()) {
      await fs.rm(targetPath, { recursive: true, force: true });
    } else {
      await fs.unlink(targetPath);
    }
    createdPaths.delete(targetPath);
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn(`Cleanup failed for ${targetPath}:`, err.message);
  }
}

/**
 * Cleans up a single previously created path (directory or file).
 * @param {string} targetPath
 */
async function cleanup(targetPath) {
  if (createdPaths.has(targetPath)) {
    await cleanupPath(targetPath);
  }
}

/**
 * Cleans up all temporary directories and files created by this manager.
 */
async function cleanupAll() {
  const paths = Array.from(createdPaths);
  await Promise.all(paths.map(p => cleanupPath(p)));
}

// Register cleanup handlers
process.on('exit', () => {
  cleanupAll().catch(err => console.error('Temp file cleanup on exit failed:', err));
});
process.on('SIGINT', () => {
  cleanupAll().then(() => process.exit(0));
});
process.on('SIGTERM', () => {
  cleanupAll().then(() => process.exit(0));
});

module.exports = {
  createTempDir,
  createTempFile,
  cleanup,
  cleanupAll,
  BASE_TEMP_DIR,
};