/**
 * CppExtractor – Extracts execution metadata from C++ starter code.
 * Supports static, constexpr, inline, templates, references, pointers, const.
 */
class CppExtractor {
  extract(starterCode) {
    if (!starterCode || typeof starterCode !== 'string' || starterCode.trim() === '') {
      throw new Error('Invalid starter code: empty or not a string');
    }

    const codeWithoutComments = this._removeComments(starterCode);

    // Find class definition (usually "class Solution {")
    const classRegex = /class\s+(\w+)\s*(?::\s*public\s+\w+)?\s*\{/;
    const classMatch = codeWithoutComments.match(classRegex);
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

    // Improved method regex: matches from optional specifiers to the opening brace
    // It captures: (returnType) (methodName) (parameters)
    // The returnType can contain nested angle brackets (e.g., vector<vector<char>>)
    const methodRegex = /(?:public:\s*)?\s*(?:(?:static|constexpr|inline|virtual)\s+)*([\w:<>,\s]+?)\s+(\w+)\s*\(([^)]*)\)\s*(?:const)?\s*(?:override)?\s*(?:final)?\s*(?:->\s*\w+)?\s*\{/g;
    const methods = [];
    let match;
    while ((match = methodRegex.exec(classBody)) !== null) {
      let returnTypeRaw = match[1].trim();
      const methodName = match[2];
      const paramStr = match[3];
      // Remove trailing const/&/* from return type after cleaning
      returnTypeRaw = returnTypeRaw.replace(/const$/, '').replace(/&$/, '').replace(/\*$/, '').trim();
      methods.push({ name: methodName, returnType: returnTypeRaw, paramStr });
    }

    if (methods.length === 0) {
      throw new Error('No public method found in C++ code');
    }

    // Constructor has the same name as the class
    const constructorMethod = className ? methods.find(m => m.name === className) : null;
    const otherMethods = methods.filter(m => m.name !== className);

    // Interactive if more than one non‑constructor method, or class name not 'Solution' with at least one method
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
   * Remove C++ comments (both // and /* * /).
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
   * Parse a parameter string (e.g., "vector<vector<char>>& boxGrid").
   * Returns array of { name, type }.
   */
  _parseParameters(paramStr) {
    if (!paramStr.trim()) return [];
    const parts = this._splitRespectingAngleBrackets(paramStr);
    const params = [];
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed === '') continue;
      // Last token is the parameter name; everything before is the type.
      const tokens = trimmed.split(/\s+/);
      if (tokens.length < 2) {
        // No space? Fallback: treat as type only, generate a name.
        params.push({ name: `param${params.length}`, type: this._normalizeType(trimmed) });
        continue;
      }
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
    const parts = this._splitRespectingAngleBrackets(paramStr);
    const types = [];
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed === '') continue;
      const tokens = trimmed.split(/\s+/);
      if (tokens.length < 2) {
        types.push(this._normalizeType(trimmed));
        continue;
      }
      const paramType = tokens.slice(0, -1).join(' ');
      types.push(this._normalizeType(paramType));
    }
    return types;
  }

  /**
   * Split a parameter list by commas, respecting angle brackets (templates).
   */
  _splitRespectingAngleBrackets(str) {
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
   * Normalise a C++ type string: remove whitespace, strip const/&/* from the end,
   * but keep them for parameter types (handled separately in wrapper generation).
   */
  _normalizeType(type) {
    let t = type.trim();
    // Remove trailing const, &, * (these are not part of the base type for serialisation)
    t = t.replace(/\s*const\s*$/, '').replace(/\s*&$/, '').replace(/\s*\*$/, '');
    // Replace multiple spaces with single space
    t = t.replace(/\s+/g, ' ');
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

module.exports = CppExtractor;