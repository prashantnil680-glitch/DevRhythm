const javaNormalizer = (code, starterCode = null) => {
  // If code already contains a solve method (or main), skip normalization
  if (code.includes('public static void main') || code.includes('public String solve(') || code.includes('public static String solve(')) {
    return code;
  }

  // Detect class name (usually 'Solution' but could be anything)
  const classPattern = /public\s+class\s+(\w+)\s*\{/;
  const classMatch = code.match(classPattern);
  if (!classMatch) {
    // No class found, return original
    return code;
  }
  const className = classMatch[1];

  // Detect method signature: public returnType methodName(params)
  // We need to find the method that LeetCode expects (usually the only public method besides constructor)
  const methodPattern = /public\s+(static\s+)?(\w+)\s+(\w+)\s*\(([^)]*)\)\s*\{/;
  let methodName = null;
  let returnType = null;
  let params = [];
  let isStatic = false;

  // Find first public method (excluding constructor)
  const lines = code.split('\n');
  let insideClass = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(classPattern)) {
      insideClass = true;
      continue;
    }
    if (insideClass && line.match(methodPattern)) {
      const methodMatch = line.match(methodPattern);
      isStatic = !!methodMatch[1];
      returnType = methodMatch[2];
      methodName = methodMatch[3];
      const paramString = methodMatch[4];
      // Parse parameters: e.g., "int[] nums, int target"
      if (paramString.trim()) {
        params = paramString.split(',').map(p => {
          const trimmed = p.trim();
          const lastSpace = trimmed.lastIndexOf(' ');
          return trimmed.substring(lastSpace + 1); // parameter name
        });
      }
      break;
    }
    if (insideClass && line.trim() === '') continue;
    if (insideClass && !line.match(/^\s/)) break;
  }

  if (!methodName) {
    return code; // fallback
  }

  // Build a wrapper that reads input and calls the method
  const wrapper = `
import java.util.*;
import java.lang.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws Exception {
        Scanner scanner = new Scanner(System.in);
        String inputLine = scanner.nextLine();
        // Parse input as JSON array of arguments
        com.google.gson.JsonParser parser = new com.google.gson.JsonParser();
        com.google.gson.JsonElement element = parser.parse(inputLine);
        com.google.gson.JsonArray argsArray = element.getAsJsonArray();
        
        // Convert argsArray to appropriate Java types based on method signature
        ${params.map((p, idx) => `Object arg${idx} = convert(argsArray.get(${idx}));`).join('\n        ')}
        
        ${className} obj = new ${className}();
        ${returnType === 'void' ? '' : returnType} result = obj.${methodName}(${params.map((_, idx) => `arg${idx}`).join(', ')});
        
        // Serialize result to JSON string
        System.out.print(serialize(result));
    }
    
    private static Object convert(com.google.gson.JsonElement elem) {
        if (elem.isJsonPrimitive()) {
            com.google.gson.JsonPrimitive prim = elem.getAsJsonPrimitive();
            if (prim.isNumber()) return prim.getAsNumber();
            if (prim.isBoolean()) return prim.getAsBoolean();
            return prim.getAsString();
        }
        if (elem.isJsonArray()) {
            List<Object> list = new ArrayList<>();
            for (com.google.gson.JsonElement e : elem.getAsJsonArray()) {
                list.add(convert(e));
            }
            return list;
        }
        if (elem.isJsonObject()) {
            Map<String, Object> map = new HashMap<>();
            for (Map.Entry<String, com.google.gson.JsonElement> entry : elem.getAsJsonObject().entrySet()) {
                map.put(entry.getKey(), convert(entry.getValue()));
            }
            return map;
        }
        return null;
    }
    
    private static String serialize(Object obj) {
        if (obj == null) return "null";
        if (obj instanceof String) return "\\"" + escape((String) obj) + "\\"";
        if (obj instanceof Number || obj instanceof Boolean) return obj.toString();
        if (obj instanceof List) {
            List<?> list = (List<?>) obj;
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < list.size(); i++) {
                if (i > 0) sb.append(",");
                sb.append(serialize(list.get(i)));
            }
            sb.append("]");
            return sb.toString();
        }
        if (obj instanceof Map) {
            Map<?,?> map = (Map<?,?>) obj;
            StringBuilder sb = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<?,?> e : map.entrySet()) {
                if (!first) sb.append(",");
                first = false;
                sb.append("\\"").append(e.getKey()).append("\\":").append(serialize(e.getValue()));
            }
            sb.append("}");
            return sb.toString();
        }
        return obj.toString();
    }
    
    private static String escape(String s) {
        return s.replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"");
    }
}
`;

  // Combine original code (without its own main) with wrapper
  // Remove any existing main method from user code (if present)
  let cleanedCode = code.replace(/public\s+static\s+void\s+main\s*\([^)]*\)\s*\{[^}]*\}/s, '');
  // Ensure the class is public and not already wrapped
  if (!cleanedCode.includes('public class ' + className)) {
    // If class is not public, make it public (rare)
    cleanedCode = cleanedCode.replace('class ' + className, 'public class ' + className);
  }
  
  // Place the user class and the Main class together
  const finalCode = cleanedCode + '\n\n' + wrapper;
  return finalCode;
};

module.exports = javaNormalizer;