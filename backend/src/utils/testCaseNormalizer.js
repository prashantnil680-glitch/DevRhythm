/**
 * Normalize a test case input string into a JSON object with an "args" array,
 * or preserve an interactive JSON object (with "constructor" and "methods").
 *
 * Supported formats:
 * - Already interactive JSON: {"constructor": [...], "methods": [...]} → returned as‑is.
 * - Already simple JSON: {"args": [...]} → returned as‑is.
 * - JSON array: [1,2,3] → becomes {"args": [1,2,3]}.
 * - Legacy key‑value: "arr1 = [1,10,100], arr2 = [1000]" → becomes {"args": [[1,10,100], [1000]]}.
 * - Multi‑line: "[1,10,100]\n[1000]" → becomes {"args": [[1,10,100], [1000]]}.
 * - Single value (no '=', no newline) → becomes {"args": [value]}.
 *
 * @param {string} stdin – The raw input string.
 * @returns {string} – JSON string in the format expected by the wrapper.
 */
function normalizeTestCaseInput(stdin) {
  if (!stdin || typeof stdin !== 'string') {
    return JSON.stringify({ args: [] });
  }

  const trimmed = stdin.trim();
  if (trimmed === '') {
    return JSON.stringify({ args: [] });
  }

  // 1. Already valid interactive JSON (contains "constructor" and "methods")
  if (trimmed.startsWith('{') && trimmed.includes('"constructor"') && trimmed.includes('"methods"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.constructor !== undefined && parsed.methods !== undefined) {
        return trimmed;
      }
    } catch (e) {
      // Not valid JSON, continue
    }
  }

  // 2. Already valid simple JSON object with "args"
  if (trimmed.startsWith('{') && trimmed.includes('"args"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.args !== undefined) {
        return trimmed;
      }
    } catch (e) {
      // Not valid JSON, continue
    }
  }

  // 3. JSON array (standalone, e.g., [1,2,3] or [[1,2],[3,4]])
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const arr = JSON.parse(trimmed);
      return JSON.stringify({ args: arr });
    } catch (e) {
      // Not valid JSON array, continue
    }
  }

  // 4. Multi‑line input where each line is a JSON value
  const lines = trimmed.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length > 1) {
    const parsedLines = [];
    let allValid = true;
    for (const line of lines) {
      const trimmedLine = line.trim();
      try {
        parsedLines.push(JSON.parse(trimmedLine));
      } catch (e) {
        allValid = false;
        break;
      }
    }
    if (allValid) {
      return JSON.stringify({ args: parsedLines });
    }
  }

  // 5. Legacy format: split by commas not inside brackets/braces/quotes
  const parts = splitLegacyInput(trimmed);
  const args = [];

  for (const part of parts) {
    let valueStr = part;
    const eqIndex = part.indexOf('=');
    if (eqIndex !== -1) {
      valueStr = part.substring(eqIndex + 1).trim();
    } else {
      valueStr = part.trim();
    }
    const converted = parseValue(valueStr);
    args.push(converted);
  }

  return JSON.stringify({ args });
}

/**
 * Split a legacy input string by commas, ignoring commas inside brackets, braces, quotes, or parentheses.
 */
function splitLegacyInput(input) {
  const parts = [];
  let current = '';
  let depth = 0;
  let inQuote = false;
  let quoteChar = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (!inQuote && (ch === '"' || ch === "'")) {
      inQuote = true;
      quoteChar = ch;
    } else if (inQuote && ch === quoteChar) {
      inQuote = false;
      quoteChar = null;
    } else if (!inQuote) {
      if (ch === '[' || ch === '{' || ch === '(') {
        depth++;
      } else if (ch === ']' || ch === '}' || ch === ')') {
        depth--;
      } else if (ch === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

/**
 * Parse a single value string into its proper JavaScript type.
 * Supports numbers, strings, booleans, null, arrays, objects.
 */
function parseValue(valueStr) {
  valueStr = valueStr.trim();

  if (valueStr === 'null') return null;
  if (valueStr === 'true') return true;
  if (valueStr === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(valueStr)) {
    const num = Number(valueStr);
    if (!isNaN(num)) return num;
  }
  if ((valueStr.startsWith('"') && valueStr.endsWith('"')) ||
      (valueStr.startsWith("'") && valueStr.endsWith("'"))) {
    return valueStr.slice(1, -1);
  }
  if ((valueStr.startsWith('[') && valueStr.endsWith(']')) ||
      (valueStr.startsWith('{') && valueStr.endsWith('}'))) {
    try {
      return JSON.parse(valueStr);
    } catch (e) {
      // fall through
    }
  }
  return valueStr;
}

module.exports = { normalizeTestCaseInput };