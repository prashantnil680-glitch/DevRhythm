/**
 * Normalizes code by removing all whitespace characters.
 * Treats code with only formatting differences as identical.
 * 
 * @param {string} code - The original source code
 * @returns {string} Code with all whitespace removed
 */
function normalizeCode(code) {
  if (!code || typeof code !== 'string') {
    return '';
  }
  // Remove all whitespace characters: spaces, tabs, newlines, carriage returns, etc.
  return code.replace(/\s+/g, '');
}

module.exports = { normalizeCode };