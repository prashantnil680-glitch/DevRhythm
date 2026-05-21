const pythonNormalizer = (code, starterCode = null) => {
  // If code already contains a solve function, don't normalize
  if (/def\s+solve\s*\(/.test(code)) {
    return code;
  }

  // If the code contains a class named "Solution", skip normalization
  // (the existing wrapper generator can handle standard LeetCode problems)
  if (/class\s+Solution\s*:/.test(code)) {
    console.log('[PythonNormalizer] Standard Solution class detected – skipping normalization');
    return code;
  }

  // Add missing typing import if List is used
  if (code.includes('List[') && !code.includes('from typing import List')) {
    code = 'from typing import List\n' + code;
  }

  // Extract class name (any class other than Solution)
  const classPattern = /class\s+(\w+)\s*:/;
  const classMatch = code.match(classPattern);
  let className = null;
  let methodName = null;
  let paramStr = null;
  let returnType = null;

  if (classMatch) {
    className = classMatch[1];
    // Find method inside class (any indentation)
    const lines = code.split('\n');
    let insideClass = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(classPattern) && line.includes(className)) {
        insideClass = true;
        continue;
      }
      if (insideClass && line.trim().startsWith('def ')) {
        // Match method signature more flexibly: accept any characters until colon
        const methodRegex = /def\s+(\w+)\s*\(([^)]*)\)\s*->?\s*([^:]*):/;
        const methodMatch = line.match(methodRegex);
        if (methodMatch) {
          methodName = methodMatch[1];
          let paramPart = methodMatch[2] || '';
          // Remove 'self' and its trailing comma
          paramPart = paramPart.replace(/^\s*self\s*,?\s*/, '');
          paramStr = paramPart;
          returnType = methodMatch[3] ? methodMatch[3].trim() : 'Any';
          break;
        }
      }
      if (insideClass && line.trim() === '') continue;
      if (insideClass && !line.match(/^\s/) && !line.match(/^class/)) break;
    }
  }

  // If no class found, look for standalone function
  if (!methodName) {
    const funcPattern = /def\s+(\w+)\s*\(([^)]*)\)\s*->?\s*([^:]*):/;
    const funcMatch = code.match(funcPattern);
    if (funcMatch) {
      methodName = funcMatch[1];
      paramStr = funcMatch[2] || '';
      returnType = funcMatch[3] ? funcMatch[3].trim() : 'Any';
      className = null;
    }
  }

  if (!methodName) {
    // Cannot detect, return original
    return code;
  }

  // Build parse_input function if not already present
  const parseInputDef = `
import json
import ast

def parse_input(s):
    parts = []
    current = []
    bracket_depth = 0
    in_quote = False
    quote_char = None
    for ch in s:
        if ch in ['"', "'"] and not in_quote:
            in_quote = True
            quote_char = ch
        elif in_quote and ch == quote_char:
            in_quote = False
            quote_char = None
        elif not in_quote:
            if ch in '([{':
                bracket_depth += 1
            elif ch in ')]}':
                bracket_depth -= 1
            elif ch == ',' and bracket_depth == 0:
                parts.append(''.join(current).strip())
                current = []
                continue
        current.append(ch)
    if current:
        parts.append(''.join(current).strip())

    values = []
    for part in parts:
        if '=' in part:
            _, value = part.split('=', 1)
            value = value.strip()
        else:
            value = part
        value = value.replace('null', 'None')
        try:
            values.append(ast.literal_eval(value))
        except:
            if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
                values.append(value[1:-1])
            else:
                values.append(value)
    return values
`;

  // Parse parameters: simple split by comma
  const paramNames = paramStr ? paramStr.split(',').map(p => p.trim()).filter(p => p) : [];
  const paramCount = paramNames.length;
  const argsList = Array.from({ length: paramCount }, (_, i) => `args[${i}]`).join(', ');

  let methodCall = '';
  if (className) {
    methodCall = `    obj = ${className}()\n    result = obj.${methodName}(${argsList})`;
  } else {
    methodCall = `    result = ${methodName}(${argsList})`;
  }

  // Serialization logic
  let serialization = 'return str(result)';
  if (returnType && (returnType === 'List' || returnType === 'Dict' || returnType === 'Set' || returnType.includes('['))) {
    serialization = 'return json.dumps(result, default=str)';
  } else if (returnType === 'str') {
    serialization = 'return result';
  } else if (returnType === 'int' || returnType === 'bool') {
    serialization = 'return str(result)';
  } else if (returnType === 'None') {
    serialization = 'return "null"';
  } else {
    serialization = 'return json.dumps(result, default=str)';
  }

  const solveFunction = `
def solve(input_str):
    values = parse_input(input_str)
    args = values[:${paramCount}]
${methodCall}
    ${serialization}
`;

  // Build final code
  let finalCode = code;
  if (!code.includes('def parse_input')) {
    finalCode = parseInputDef + '\n\n' + code;
  }
  finalCode += '\n\n' + solveFunction;

  // Also add the main block (already added by provider, but keep for completeness)
  finalCode += `
if __name__ == "__main__":
    import sys
    input_data = sys.stdin.read()
    output = solve(input_data)
    sys.stdout.write(str(output))
`;
  return finalCode;
};

module.exports = pythonNormalizer;