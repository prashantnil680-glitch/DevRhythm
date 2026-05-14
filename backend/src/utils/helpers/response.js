/**
 * Formats a successful API response.
 * @param {string} message - Human‑readable message.
 * @param {*} data - Primary response data.
 * @param {Object|null} meta - Additional metadata (pagination, timezone, period, etc.).
 * @param {Object|null} error - Error details (always null for success responses).
 * @returns {Object} Standardised response object.
 */
const formatResponse = (message, data = null, meta = null, error = null) => {
  // Create a shallow copy of the provided meta (or an empty object)
  const finalMeta = { ...(meta || {}) };
  
  // Add timestamp only if it doesn't already exist
  if (!finalMeta.timestamp) {
    finalMeta.timestamp = new Date().toISOString();
  }
  
  return {
    success: true,
    statusCode: 200,
    message,
    data,
    meta: finalMeta,
    error: error || null,
  };
};

/**
 * Formats an error response.
 * @param {number} statusCode - HTTP status code.
 * @param {string} message - Error message.
 * @param {Object|null} error - Additional error details.
 * @returns {Object} Standardised error response object.
 */
const formatErrorResponse = (statusCode, message, error = null) => {
  return {
    success: false,
    statusCode,
    message,
    data: null,
    meta: {
      timestamp: new Date().toISOString(),
    },
    error,
  };
};

module.exports = {
  formatResponse,
  formatErrorResponse,
};