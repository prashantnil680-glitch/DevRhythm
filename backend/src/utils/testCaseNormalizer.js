/**
 * src/utils/testCaseNormalizer.js
 *
 * Normalize a test case input string into a JSON object with an "args" array,
 * or preserve an interactive JSON object (with "constructor" and "methods").
 *
 * Supports:
 * - Already interactive JSON: {"constructor": [...], "methods": [...]} → returned as‑is.
 * - Already simple JSON: {"args": [...]} → returned as‑is.
 * - JSON array: [1,2,3] → becomes {"args": [1,2,3]}.
 * - Legacy key‑value: "arr1 = [1,10,100], arr2 = [1000]" → becomes {"args": [[1,10,100], [1000]]}.
 * - Multi‑line: "[1,10,100]\n[1000]" → becomes {"args": [[1,10,100], [1000]]}.
 * - Single value (no '=', no newline) → becomes {"args": [value]}.
 * - Linked‑list cycle input: "head = [3,2,0,-4], pos = 1" → becomes {"args": [{"list": [3,2,0,-4], "pos": 1}]}.
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
  if (isInteractiveFormat(trimmed)) {
    return trimmed;
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

  // 5. Detect linked‑list cycle input: "head = [..], pos = N" or "list = [..], pos = N"
  const cycleMatch = detectCycleInput(trimmed);
  if (cycleMatch) {
    return JSON.stringify({ args: [cycleMatch] });
  }

  // 6. Legacy format: split by commas not inside brackets/braces/quotes
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
 * Detects if a string is a valid interactive JSON structure.
 * Interactive format must be an object with both "constructor" and "methods" keys.
 * @param {string} str
 * @returns {boolean}
 */
function isInteractiveFormat(str) {
  if (!str.startsWith('{') || !str.endsWith('}')) return false;
  try {
    const parsed = JSON.parse(str);
    return parsed && typeof parsed === 'object' && 'constructor' in parsed && 'methods' in parsed;
  } catch (e) {
    return false;
  }
}

/**
 * Detect a linked‑list cycle input pattern:
 * - Contains a list assignment like "head = [..]" or "list = [..]"
 * - Contains a "pos = N" assignment
 * Both must be present and the pos must be an integer.
 * If matched, returns an object { list: Array, pos: number }.
 * Otherwise returns null.
 */
function detectCycleInput(input) {
  // Normalise: remove extra spaces, but keep brackets intact
  const normalized = input.replace(/\s+/g, ' ').trim();

  // Regex to capture: a variable name, an equals sign, a JSON array, then a comma, then "pos = integer"
  // Supports: head, list, or any variable name (but we only care about list part)
  // The array may contain numbers, strings, booleans, nested arrays (but we capture the whole array string)
  const cycleRegex = /^(?:head|list)\s*=\s*(\[[\s\S]*?\])\s*,\s*pos\s*=\s*(-?\d+)\s*$/i;
  const match = normalized.match(cycleRegex);
  if (!match) return null;

  const arrayStr = match[1];
  const posStr = match[2];
  const pos = parseInt(posStr, 10);

  // Parse the array part (should be a valid JSON array)
  let list;
  try {
    list = JSON.parse(arrayStr);
    if (!Array.isArray(list)) return null;
  } catch (e) {
    return null;
  }

  // Ensure pos is a number and within reasonable bounds (allow -1 and up to list length-1)
  if (isNaN(pos) || pos < -1 || pos >= list.length) {
    // For safety, if pos is out of range, treat as -1 (no cycle)
    // But we still return the object with the given pos; the wrapper will handle invalid pos.
    // We'll allow any pos and let the helper decide.
  }

  return { list, pos };
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

module.exports = { normalizeTestCaseInput, isInteractiveFormat };