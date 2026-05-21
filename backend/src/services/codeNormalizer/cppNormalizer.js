const cppNormalizer = (code, starterCode = null) => {
  // If code already contains a main function, skip normalization
  if (code.includes('int main(') || code.includes('int main ()')) {
    return code;
  }

  // Detect class name (usually Solution)
  const classPattern = /class\s+(\w+)\s*\{/;
  const classMatch = code.match(classPattern);
  let className = null;
  let methodName = null;
  let returnType = null;
  let params = [];

  if (classMatch) {
    className = classMatch[1];
    // Find public method signature inside class
    // Look for lines like: int twoSum(vector<int>& nums, int target)
    const methodPattern = /public:\s*\n\s*(\S+(?:\s+\S+)*?)\s+(\w+)\s*\(([^)]*)\)\s*;/;
    const methodMatch = code.match(methodPattern);
    if (methodMatch) {
      returnType = methodMatch[1].trim();
      methodName = methodMatch[2];
      const paramStr = methodMatch[3];
      // Parse parameters: e.g., "vector<int>& nums, int target"
      if (paramStr.trim()) {
        params = paramStr.split(',').map(p => {
          const trimmed = p.trim();
          const lastSpace = trimmed.lastIndexOf(' ');
          const namePart = trimmed.substring(lastSpace + 1);
          // Remove any '&' or '*' from name
          return namePart.replace(/[&*]/, '');
        });
      }
    }
  }

  // If no class found, look for standalone function
  if (!methodName) {
    const funcPattern = /(\S+(?:\s+\S+)*?)\s+(\w+)\s*\(([^)]*)\)\s*\{/;
    const funcMatch = code.match(funcPattern);
    if (funcMatch) {
      returnType = funcMatch[1].trim();
      methodName = funcMatch[2];
      const paramStr = funcMatch[3];
      if (paramStr.trim()) {
        params = paramStr.split(',').map(p => {
          const trimmed = p.trim();
          const lastSpace = trimmed.lastIndexOf(' ');
          const namePart = trimmed.substring(lastSpace + 1);
          return namePart.replace(/[&*]/, '');
        });
      }
    }
  }

  if (!methodName) {
    // Cannot detect, return original
    return code;
  }

  // Build wrapper with main function
  // We'll add necessary includes and a JSON parser (similar to existing wrapper generator)
  // But to keep it simple, we'll reuse the existing generateCppWrapper which already works well.
  // The normalization only ensures the user code is in a standard format (class + method).
  // Since the existing generateCppWrapper already handles all cases, we can leave the code as is.
  // However, we need to add a main function if missing. The existing wrapper generator does that.
  // So for C++, normalization can be minimal: just ensure the class is public and method is accessible.
  
  // To avoid breaking existing working solutions, we will not modify the code heavily.
  // Instead, we rely on the existing generateCppWrapper (called later in controller) to add main.
  // So the normalizer for C++ will be a no-op (return original code).
  // This is safe because generateCppWrapper already adds the main function and handles JSON parsing.

  return code;
};

module.exports = cppNormalizer;