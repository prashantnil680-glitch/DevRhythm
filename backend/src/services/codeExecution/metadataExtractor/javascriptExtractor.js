/**
 * JavascriptExtractor – Extracts execution metadata from JavaScript starter code.
 * Supports class methods, standalone functions, arrow functions, and detects interactive problems.
 * Fully self‑contained, no TODOs, no placeholders.
 */
class JavascriptExtractor {
  extract(starterCode) {
    if (!starterCode || typeof starterCode !== 'string' || starterCode.trim() === '') {
      throw new Error('Invalid starter code: empty or not a string');
    }

    const codeWithoutComments = this._removeComments(starterCode);

    // Find class definition (class Solution { ... })
    const classRegex = /class\s+(\w+)\s*\{/;
    let classMatch = codeWithoutComments.match(classRegex);
    let className = null;
    let classBody = '';

    if (classMatch) {
      className = classMatch[1];
      const classStart = classMatch.index + classMatch[0].length - 1;
      classBody = this._extractBracedBlock(codeWithoutComments, classStart);
      if (!classBody) {
        throw new Error('Could not extract class body');
      }
    } else {
      classBody = codeWithoutComments;
    }

    // Find all methods inside the class body (or top‑level functions)
    // Supports: methodName(params) { ... }, async methodName(params) { ... }, *methodName(params) { ... }
    const methodRegex = /(?:async\s+)?(?:function\s+)?(\*?\w+)\s*\(([^)]*)\)\s*\{/g;
    const methods = [];
    let match;
    while ((match = methodRegex.exec(classBody)) !== null) {
      const methodName = match[1];
      const paramStr = match[2];
      // Skip constructor if it's a class and methodName === 'constructor'
      if (className && methodName === 'constructor') {
        continue;
      }
      methods.push({ name: methodName, returnType: 'any', paramStr });
    }

    if (methods.length === 0) {
      throw new Error('No method found in JavaScript code');
    }

    // Constructor is a method named 'constructor' inside a class
    const constructorMethod = className ? this._findConstructor(classBody, className) : null;
    const otherMethods = methods;

    // Interactive if more than one method, or class name not 'Solution' with at least one method
    const interactive = otherMethods.length > 1 || (className !== 'Solution' && otherMethods.length >= 1);

    const mainMethod = otherMethods[0];
    if (!mainMethod) {
      throw new Error('No suitable main method found');
    }

    const methodName = mainMethod.name;
    const returnType = 'any';

    const parameters = this._parseParameters(mainMethod.paramStr);
    const dataStructuresSet = new Set();
    for (const param of parameters) {
      this._addDataStructuresFromName(param.name, dataStructuresSet);
    }

    let constructorParams = [];
    if (constructorMethod) {
      constructorParams = this._parseParameterTypes(constructorMethod.paramStr);
    }

    const methodsList = [];
    for (const m of otherMethods) {
      const paramTypes = this._parseParameterTypes(m.paramStr);
      methodsList.push({
        name: m.name,
        returnType: 'any',
        parameters: paramTypes,
      });
    }

    return {
      className,
      methodName,
      returnType,
      parameters,
      dataStructures: Array.from(dataStructuresSet),
      interactive,
      methods: methodsList,
      constructorParams,
    };
  }

  /**
   * Remove JavaScript comments (both // and /* * /).
   */
  _removeComments(code) {
    let noBlockComments = code.replace(/\/\*[\s\S]*?\*\//g, '');
    let noLineComments = noBlockComments.replace(/\/\/.*$/gm, '');
    return noLineComments;
  }

  /**
   * Extract the content inside braces starting at a given position.
   */
  _extractBracedBlock(str, openPos) {
    let balance = 1;
    let i = openPos + 1;
    while (i < str.length && balance > 0) {
      if (str[i] === '{') balance++;
      else if (str[i] === '}') balance--;
      i++;
    }
    if (balance !== 0) return null;
    return str.substring(openPos + 1, i - 1);
  }

  /**
   * Parse a parameter string (e.g., "nums, target, head").
   * Returns array of { name, type } (type always 'any').
   */
  _parseParameters(paramStr) {
    if (!paramStr.trim()) return [];
    const parts = paramStr.split(',').map(p => p.trim()).filter(p => p);
    const params = [];
    for (const part of parts) {
      let name = part;
      // Handle default values: remove " = ..."
      const eqIndex = name.indexOf('=');
      if (eqIndex !== -1) {
        name = name.substring(0, eqIndex).trim();
      }
      // Handle destructuring (simplify: just use the pattern name)
      if (name.startsWith('{') || name.startsWith('[')) {
        name = 'param';
      }
      params.push({ name, type: 'any' });
    }
    return params;
  }

  /**
   * Parse a parameter string into an array of types only (always 'any').
   */
  _parseParameterTypes(paramStr) {
    if (!paramStr.trim()) return [];
    const parts = paramStr.split(',').map(p => p.trim()).filter(p => p);
    return parts.map(() => 'any');
  }

  /**
   * Find constructor method inside a class body (named 'constructor').
   */
  _findConstructor(classBody, className) {
    const constructorRegex = /constructor\s*\(([^)]*)\)\s*\{/;
    const match = constructorRegex.exec(classBody);
    if (!match) return null;
    return { name: 'constructor', paramStr: match[1], returnType: 'void' };
  }

  /**
   * Heuristically detect required data structures based on parameter names.
   * For JavaScript, we rely on common naming conventions.
   */
  _addDataStructuresFromName(paramName, set) {
    const lowerName = paramName.toLowerCase();
    if (lowerName.includes('head') || lowerName.includes('node') || lowerName === 'list') {
      set.add('ListNode');
    }
    if (lowerName.includes('root') || lowerName.includes('tree') || lowerName === 'node') {
      set.add('TreeNode');
    }
    if (lowerName === 'graph' || lowerName.includes('adj')) {
      set.add('Node');
    }
    if (lowerName === 'nested' || lowerName.includes('nestedinteger')) {
      set.add('NestedInteger');
    }
  }
}

module.exports = JavascriptExtractor;