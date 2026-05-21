const config = require('../../config');
const pythonNormalizer = require('./pythonNormalizer');
const javaNormalizer = require('./javaNormalizer');
const cppNormalizer = require('./cppNormalizer');
const jsNormalizer = require('./jsNormalizer');

/**
 * Normalize user code into a unified format (solve function)
 * @param {string} language - 'python', 'java', 'cpp', 'javascript'
 * @param {string} code - Original user code
 * @param {object} starterCode - Optional starter code from question (language -> code)
 * @returns {string} Normalized code (or original if normalization fails/disabled)
 */
function normalizeCode(language, code, starterCode = null) {
  // Check if normalization is enabled globally
  const enabled = config.codeExecution?.normalizationEnabled ?? true;
  if (!enabled) {
    console.log('[CodeNormalizer] Normalization disabled, returning original code');
    return code;
  }

  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    return code;
  }

  try {
    switch (language) {
      case 'python':
        return pythonNormalizer(code, starterCode);
      case 'java':
        return javaNormalizer(code, starterCode);
      case 'cpp':
        return cppNormalizer(code, starterCode);
      case 'javascript':
        return jsNormalizer(code, starterCode);
      default:
        // Unsupported language, no normalization
        return code;
    }
  } catch (error) {
    console.error(`[CodeNormalizer] Error normalizing ${language} code:`, error.message);
    // Fallback to original code on any error
    return code;
  }
}

module.exports = normalizeCode;