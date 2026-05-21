const jsNormalizer = (code, starterCode = null) => {
  // If code already has a solve function or reads from stdin, skip normalization
  if (code.includes('function solve(') || code.includes('readline') || code.includes('process.stdin')) {
    return code;
  }

  // Detect exported function or class method
  let functionName = null;
  let paramNames = [];

  // Pattern 1: module.exports = { functionName }
  const exportPattern = /module\.exports\s*=\s*\{\s*(\w+)\s*\}/;
  const exportMatch = code.match(exportPattern);
  if (exportMatch) {
    functionName = exportMatch[1];
  }

  // Pattern 2: function functionName(params) { ... }
  if (!functionName) {
    const funcPattern = /function\s+(\w+)\s*\(([^)]*)\)\s*\{/;
    const funcMatch = code.match(funcPattern);
    if (funcMatch) {
      functionName = funcMatch[1];
      paramNames = funcMatch[2].split(',').map(p => p.trim());
    }
  }

  // Pattern 3: const functionName = function(params) { ... } or const functionName = (params) => { ... }
  if (!functionName) {
    const arrowPattern = /const\s+(\w+)\s*=\s*(?:function\s*\(([^)]*)\)|\(([^)]*)\)\s*=>)\s*\{/;
    const arrowMatch = code.match(arrowPattern);
    if (arrowMatch) {
      functionName = arrowMatch[1];
      const paramStr = arrowMatch[2] || arrowMatch[3] || '';
      paramNames = paramStr.split(',').map(p => p.trim());
    }
  }

  // Pattern 4: Class with method (LeetCode style)
  let className = null;
  let methodName = null;
  if (!functionName) {
    const classPattern = /class\s+(\w+)\s*\{/;
    const classMatch = code.match(classPattern);
    if (classMatch) {
      className = classMatch[1];
      // Find method inside class
      const methodPattern = /(\w+)\s*\(([^)]*)\)\s*\{/;
      const methodMatch = code.match(methodPattern);
      if (methodMatch) {
        methodName = methodMatch[1];
        paramNames = methodMatch[2].split(',').map(p => p.trim());
      }
    }
  }

  // If nothing detected, return original code
  if (!functionName && !methodName) {
    return code;
  }

  const entryPoint = functionName || `${className}.prototype.${methodName}`;
  const paramList = paramNames.join(', ');

  // Build a solve function that parses input and calls the original function
  const solveFunction = `
function solve(input_str) {
    // Parse input (supports JSON array or key=value pairs)
    let args;
    try {
        args = JSON.parse(input_str);
        if (args && typeof args === 'object' && !Array.isArray(args)) {
            if (args.args) args = args.args;
            else args = Object.values(args);
        }
    } catch (e) {
        // Legacy format: key=value pairs
        const parts = input_str.split(',').map(p => p.trim());
        args = [];
        for (const part of parts) {
            const eqIdx = part.indexOf('=');
            if (eqIdx !== -1) {
                let value = part.substring(eqIdx + 1).trim();
                try { value = JSON.parse(value); } catch(e2) {}
                args.push(value);
            } else {
                let value = part;
                try { value = JSON.parse(value); } catch(e2) {}
                args.push(value);
            }
        }
    }
    // Ensure args length matches parameter count
    while (args.length < ${paramNames.length}) args.push(undefined);
    // Call the original function
    ${functionName ? `let result = ${functionName}(${paramNames.map((_, i) => `args[${i}]`).join(', ')});` : `const obj = new ${className}(); let result = obj.${methodName}(${paramNames.map((_, i) => `args[${i}]`).join(', ')});`}
    // Serialize result to JSON string (for complex types)
    return JSON.stringify(result);
}
`;

  // Add the solve function and the stdin handling block
  const stdinHandler = `
if (require.main === module) {
    let input = '';
    process.stdin.on('data', chunk => input += chunk);
    process.stdin.on('end', () => {
        const output = solve(input);
        process.stdout.write(output);
    });
}
`;

  // Combine: original code + solve function + stdin handler
  let finalCode = code;
  if (!code.includes('function solve')) {
    finalCode += '\n\n' + solveFunction;
  }
  if (!code.includes('process.stdin.on')) {
    finalCode += '\n\n' + stdinHandler;
  }
  return finalCode;
};

module.exports = jsNormalizer;