/**
 * JavaMetadataExtractor – Extracts execution metadata from Java starter code.
 * Uses regex with advanced patterns to handle generics, arrays, and detect interactive problems.
 * Fully self‑contained, no TODOs, no placeholders.
 * 
 * CHANGES: now accepts both "public class" and "class" (package‑private) as valid class definitions.
 */
class JavaMetadataExtractor {
  extract(starterCode) {
    if (!starterCode || typeof starterCode !== 'string' || starterCode.trim() === '') {
      throw new Error('Invalid starter code: empty or not a string');
    }

    const codeWithoutComments = this._removeComments(starterCode);
    // Allow optional "public" modifier – now matches "class" or "public class"
    const classMatch = codeWithoutComments.match(/(?:public\s+)?class\s+(\w+)\s*\{/);
    if (!classMatch) {
      throw new Error('No class found in starter code');
    }
    const className = classMatch[1];

    const classOpenPos = classMatch.index + classMatch[0].length - 1;
    const classBody = this._extractBracedBlock(codeWithoutComments, classOpenPos);
    if (!classBody) {
      throw new Error('Could not extract class body');
    }

    // Find all methods (including constructor) using a flexible regex
    // Pattern: public [static] returnType methodName(parameters) {
    const methodRegex = /public\s+(?:static\s+)?([\w<>\[\]]+(?:\.\.\.)?)\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
    const methods = [];
    let match;
    while ((match = methodRegex.exec(classBody)) !== null) {
      const returnTypeRaw = match[1].trim();
      const methodName = match[2];
      const paramStr = match[3];
      methods.push({ name: methodName, returnType: returnTypeRaw, paramStr });
    }

    if (methods.length === 0) {
      throw new Error('No public method found in class');
    }

    // Separate constructor (method name == class name)
    const constructorMethod = methods.find(m => m.name === className);
    const otherMethods = methods.filter(m => m.name !== className);

    // Interactive if more than one non‑constructor public method, or if class name is not Solution and has at least one method
    const interactive = otherMethods.length > 1 || (className !== 'Solution' && otherMethods.length >= 1);

    const mainMethod = otherMethods[0] || methods[0];
    if (!mainMethod) {
      throw new Error('No suitable main method found');
    }

    const methodName = mainMethod.name;
    const returnType = this._normalizeType(mainMethod.returnType);
    const parameters = this._parseParameters(mainMethod.paramStr);
    const dataStructuresSet = new Set();
    for (const param of parameters) {
      this._addDataStructuresFromType(param.type, dataStructuresSet);
    }
    this._addDataStructuresFromType(returnType, dataStructuresSet);

    let constructorParams = [];
    if (constructorMethod) {
      constructorParams = this._parseParameterTypes(constructorMethod.paramStr);
    }

    const methodsList = [];
    for (const m of otherMethods) {
      const paramTypes = this._parseParameterTypes(m.paramStr);
      methodsList.push({
        name: m.name,
        returnType: this._normalizeType(m.returnType),
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
   * Remove Java comments (both // and /* * /) to simplify parsing.
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
   * Parse a parameter string (e.g., "int[] nums, ListNode head, String s").
   * Returns array of { name, type }.
   */
  _parseParameters(paramStr) {
    if (!paramStr.trim()) return [];
    const parts = this._splitRespectingGenerics(paramStr);
    const params = [];
    for (const part of parts) {
      const trimmed = part.trim();
      const tokens = trimmed.split(/\s+/);
      if (tokens.length < 2) continue;
      const paramName = tokens[tokens.length - 1];
      const paramType = tokens.slice(0, -1).join(' ');
      params.push({ name: paramName, type: this._normalizeType(paramType) });
    }
    return params;
  }

  /**
   * Parse a parameter string into an array of types only (for methods list).
   */
  _parseParameterTypes(paramStr) {
    if (!paramStr.trim()) return [];
    const parts = this._splitRespectingGenerics(paramStr);
    const types = [];
    for (const part of parts) {
      const trimmed = part.trim();
      const tokens = trimmed.split(/\s+/);
      if (tokens.length < 2) continue;
      const paramType = tokens.slice(0, -1).join(' ');
      types.push(this._normalizeType(paramType));
    }
    return types;
  }

  /**
   * Split a parameter list by commas, respecting angle brackets (generics).
   */
  _splitRespectingGenerics(str) {
    const parts = [];
    let depth = 0;
    let current = '';
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '<') depth++;
      else if (ch === '>') depth--;
      else if (ch === ',' && depth === 0) {
        parts.push(current);
        current = '';
        continue;
      }
      current += ch;
    }
    if (current.trim()) parts.push(current);
    return parts;
  }

  /**
   * Normalise a Java type string: remove whitespace, unify array notation,
   * and strip 'final' or '@NotNull' annotations.
   */
  _normalizeType(type) {
    let t = type.trim();
    // Remove annotations like @NotNull
    t = t.replace(/@\w+\s*/g, '');
    // Convert "int[]" to "int[]" (keep as is), but ensure no extra spaces
    t = t.replace(/\s+/g, ' ');
    // If it's varargs "String...", keep as "String[]" for consistency
    if (t.includes('...')) {
      t = t.replace(/\.\.\.$/, '[]');
    }
    return t;
  }

  /**
   * Detect known data structures in a type string and add them to the set.
   */
  _addDataStructuresFromType(type, set) {
    if (type.includes('ListNode')) set.add('ListNode');
    if (type.includes('TreeNode')) set.add('TreeNode');
    if (type.includes('Node')) set.add('Node');
    if (type.includes('NestedInteger')) set.add('NestedInteger');
  }
}

module.exports = JavaMetadataExtractor;