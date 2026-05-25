/**
 * Output Comparator – Compares actual output against expected output
 * with support for order‑insensitive comparison and floating‑point tolerance.
 */
class OutputComparator {
  /**
   * Compare two outputs.
   * @param {any} actual – The actual output (already deserialised from JSON).
   * @param {any} expected – The expected output (already deserialised from JSON).
   * @param {Object} options – Comparison options.
   * @param {boolean} options.unordered – Whether to compare arrays as unordered sets (default: false).
   * @param {number} options.floatTolerance – Absolute tolerance for floating‑point numbers (default: 1e-9).
   * @returns {boolean} – True if outputs match.
   */
  static compare(actual, expected, options = {}) {
    const unordered = options.unordered === true;
    const floatTolerance = options.floatTolerance !== undefined ? options.floatTolerance : 1e-9;

    return this._deepEqual(actual, expected, unordered, floatTolerance);
  }

  /**
   * Recursive deep equality check with options.
   */
  static _deepEqual(a, b, unordered, tolerance) {
    if (a === b) return true;

    if (a === null || b === null) return a === b;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'number' && typeof b === 'number') {
      return Math.abs(a - b) <= tolerance;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      if (unordered) {
        return this._compareUnorderedArrays(a, b, tolerance);
      } else {
        for (let i = 0; i < a.length; i++) {
          if (!this._deepEqual(a[i], b[i], unordered, tolerance)) return false;
        }
        return true;
      }
    }

    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
        if (!this._deepEqual(a[key], b[key], unordered, tolerance)) return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Compare two arrays ignoring element order.
   * Uses multiset equivalence (counting occurrences) with deep equality.
   */
  static _compareUnorderedArrays(arrA, arrB, tolerance) {
    if (arrA.length !== arrB.length) return false;

    const remainingB = [...arrB];
    for (const itemA of arrA) {
      let foundIndex = -1;
      for (let i = 0; i < remainingB.length; i++) {
        if (this._deepEqual(itemA, remainingB[i], true, tolerance)) {
          foundIndex = i;
          break;
        }
      }
      if (foundIndex === -1) return false;
      remainingB.splice(foundIndex, 1);
    }
    return true;
  }

  /**
   * Normalise output for storage or logging (optional utility).
   * @param {any} value – Value to normalise.
   * @returns {any} – Normalised value (e.g., objects with sorted keys).
   */
  static normalise(value) {
    if (value === null || typeof value !== 'object') return value;

    if (Array.isArray(value)) {
      return value.map(v => this.normalise(v));
    }

    const sortedKeys = Object.keys(value).sort();
    const result = {};
    for (const key of sortedKeys) {
      result[key] = this.normalise(value[key]);
    }
    return result;
  }
}

module.exports = OutputComparator;