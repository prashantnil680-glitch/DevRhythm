const fs = require('fs');
const path = require('path');

class JavaGenerator {
  generateWrapper(userCode, metadata, testCases) {
    if (!userCode || typeof userCode !== 'string') {
      throw new Error('Invalid user code');
    }
    if (!metadata || !metadata.methodName) {
      throw new Error('Invalid metadata: missing methodName');
    }

    const helpersCode = this._getRequiredHelpers(metadata.dataStructures || []);
    const { deserCode, callCode, interactiveMain } = this._generateExecutionCode(metadata);
    const imports = this._generateImports();
    const finalCode = `${imports}\n\n${helpersCode}\n\n${userCode}\n\n${interactiveMain || this._buildNonInteractiveMain(deserCode, callCode, metadata.returnType)}\n`;

    return finalCode;
  }

  _getRequiredHelpers(dataStructures) {
    if (!dataStructures.length) return '';
    const helpersPath = path.join(__dirname, '../helpers/java/Structures.java');
    try {
      return fs.readFileSync(helpersPath, 'utf-8');
    } catch (err) {
      console.warn(`Could not read Structures.java: ${err.message}`);
      return this._fallbackHelpers();
    }
  }

  _fallbackHelpers() {
    return `
// Fallback helper classes (should not be used in production)
import java.util.*;
class ListNode { int val; ListNode next; ListNode() {} ListNode(int val) { this.val = val; } ListNode(int val, ListNode next) { this.val = val; this.next = next; } }
class TreeNode { int val; TreeNode left; TreeNode right; TreeNode() {} TreeNode(int val) { this.val = val; } TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; } }
class Node {
    int val;
    List<Node> neighbors;
    Node next;
    Node random;
    Node() { neighbors = new ArrayList<>(); }
    Node(int val) { this.val = val; neighbors = new ArrayList<>(); }
    Node(int val, List<Node> neighbors) { this.val = val; this.neighbors = neighbors; }
    Node(int val, Node next, Node random) { this.val = val; this.next = next; this.random = random; neighbors = new ArrayList<>(); }
}
class NestedInteger {
    private Integer value;
    private List<NestedInteger> list;
    public NestedInteger() { list = new ArrayList<>(); }
    public NestedInteger(int value) { this.value = value; }
    public boolean isInteger() { return value != null; }
    public Integer getInteger() { return value; }
    public void setInteger(int value) { this.value = value; list = null; }
    public void add(NestedInteger ni) { if (list == null) list = new ArrayList<>(); list.add(ni); }
    public List<NestedInteger> getList() { return list == null ? new ArrayList<>() : list; }
}
`;
  }

  _generateExecutionCode(metadata) {
    const { interactive, className, methodName, parameters, returnType, constructorParams, methods } = metadata;
    if (interactive) {
      return this._generateInteractive(className, constructorParams, methods);
    } else {
      const deserCode = this._generateDeserialization(parameters);
      const callCode = this._generateStandardCall(className, methodName, parameters, returnType);
      return { deserCode, callCode, interactiveMain: null };
    }
  }

  _generateDeserialization(parameters) {
    const lines = [];
    lines.push(`        if (argsArray.size() < ${parameters.length}) {`);
    lines.push(`            while (argsArray.size() < ${parameters.length}) argsArray.add(null);`);
    lines.push(`        }`);
    for (let i = 0; i < parameters.length; i++) {
      const param = parameters[i];
      const type = param.type;
      const typeStr = (typeof type === 'string') ? type : String(type);
      const expr = this._deserializeExpression(typeStr, i);
      lines.push(`        ${this._javaTypeCast(typeStr)} arg${i} = ${expr};`);
    }
    return lines.join('\n');
  }

  /**
   * Generate the correct Java expression to convert an Object from argsArray
   * into the desired parameter type.
   */
  _deserializeExpression(typeStr, index) {
    // Custom data structures
    if (typeStr.includes("ListNode")) {
      return `deserializeListNode(argsArray.get(${index}))`;
    }
    if (typeStr.includes("TreeNode")) {
      return `deserializeTreeNode(argsArray.get(${index}))`;
    }
    if (typeStr.includes("Node")) {
      return `deserializeNode(argsArray.get(${index}))`;
    }
    if (typeStr.includes("NestedInteger")) {
      return `deserializeNestedInteger(argsArray.get(${index}))`;
    }
    // Primitive and standard types
    if (typeStr === "int") {
      return `((Number) argsArray.get(${index})).intValue()`;
    }
    if (typeStr === "long") {
      return `((Number) argsArray.get(${index})).longValue()`;
    }
    if (typeStr === "double") {
      return `((Number) argsArray.get(${index})).doubleValue()`;
    }
    if (typeStr === "boolean") {
      return `(boolean) argsArray.get(${index})`;
    }
    if (typeStr === "String") {
      return `(String) argsArray.get(${index})`;
    }
    // Fallback: treat as Object (may cause issues but prevents compilation error)
    return `argsArray.get(${index})`;
  }

  _generateStandardCall(className, methodName, parameters, returnType) {
    const argNames = parameters.map((_, i) => `arg${i}`).join(', ');
    const returnTypeStr = (typeof returnType === 'string') ? returnType : String(returnType);
    if (className) {
      return `        ${className} obj = new ${className}();
        try {
            ${returnTypeStr === "void" ? "" : returnTypeStr + " result = "}obj.${methodName}(${argNames});
            ${this._serializeResult(returnTypeStr, "result")}
        } catch (Exception e) {
            System.err.println(e.toString());
            System.out.print("null");
        }`;
    } else {
      return `        try {
            ${returnTypeStr === "void" ? "" : returnTypeStr + " result = "}${methodName}(${argNames});
            ${this._serializeResult(returnTypeStr, "result")}
        } catch (Exception e) {
            System.err.println(e.toString());
            System.out.print("null");
        }`;
    }
  }

  _generateInteractive(className, constructorParams, methods) {
    const constrArgs = constructorParams.map((_, i) => `(${this._javaTypeFromString(constructorParams[i])}) constrArgs.get(${i})`).join(', ');
    const dispatchLines = [];
    for (const m of methods) {
      const paramTypes = m.parameters.map(p => this._javaTypeFromString(p));
      const argsCast = paramTypes.map((pt, idx) => `(${pt}) methodArgs.get(${idx})`).join(', ');
      dispatchLines.push(`                    if (methodName.equals("${m.name}")) {`);
      dispatchLines.push(`                        try {`);
      dispatchLines.push(`                            ${m.returnType.equals("void") ? "" : m.returnType + " res = "}obj.${m.name}(${argsCast});`);
      dispatchLines.push(`                            results.add(${m.returnType.equals("void") ? "null" : "res"});`);
      dispatchLines.push(`                        } catch (Exception e) {`);
      dispatchLines.push(`                            System.err.println(e.toString());`);
      dispatchLines.push(`                            results.add(null);`);
      dispatchLines.push(`                        }`);
      dispatchLines.push(`                    } else`);
    }
    dispatchLines.push(`                    {`);
    dispatchLines.push(`                        results.add(null);`);
    dispatchLines.push(`                    }`);

    const interactiveCode = `
    public static String solveInteractive(String inputStr) {
        try {
            SimpleJsonParser parser = new SimpleJsonParser(inputStr);
            Map<String, Object> data = parser.parseObject();
            List<Object> constrArgs = (List<Object>) data.get("constructor");
            List<List<Object>> methodsList = (List<List<Object>>) data.get("methods");
            List<Object> results = new ArrayList<>();
            results.add(null);
            ${className} obj = new ${className}(${constrArgs});
            for (List<Object> call : methodsList) {
                if (call == null || call.isEmpty()) {
                    results.add(null);
                    continue;
                }
                String methodName = (String) call.get(0);
                List<Object> methodArgs = call.subList(1, call.size());
                ${dispatchLines.join('\n                ')}
            }
            return serialize(results);
        } catch (Exception e) {
            System.err.println(e.toString());
            return "[]";
        }
    }
`;
    return { deserCode: '', callCode: '', interactiveMain: interactiveCode };
  }

  _buildNonInteractiveMain(deserCode, callCode, returnType) {
    const parserClass = this._getJsonParserClass();
    return `
    ${parserClass}

    public static void main(String[] args) throws Exception {
        Scanner scanner = new Scanner(System.in);
        StringBuilder inputBuilder = new StringBuilder();
        while (scanner.hasNextLine()) {
            inputBuilder.append(scanner.nextLine());
        }
        String input = inputBuilder.toString();
        try {
            SimpleJsonParser parser = new SimpleJsonParser(input);
            Object parsed = parser.parse();
            Map<String, Object> data;
            if (parsed instanceof Map) {
                data = (Map<String, Object>) parsed;
            } else {
                data = new HashMap<>();
                data.put("args", parsed);
            }
            List<Object> argsArray = (List<Object>) data.get("args");
            ${deserCode}
            ${callCode}
        } catch (Exception e) {
            System.err.println(e.toString());
            System.out.print("null");
        }
    }

    private static String serialize(Object obj) {
        if (obj == null) return "null";
        if (obj instanceof String) return "\\"" + escape((String) obj) + "\\"";
        if (obj instanceof Number || obj instanceof Boolean) return obj.toString();
        if (obj instanceof ListNode) return serializeListNode((ListNode) obj).toString();
        if (obj instanceof TreeNode) return serializeTreeNode((TreeNode) obj).toString();
        if (obj instanceof Node) return serializeNode((Node) obj).toString();
        if (obj instanceof NestedInteger) return serializeNestedInteger((NestedInteger) obj).toString();
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
`;
  }

  _getJsonParserClass() {
    return `
    private static class SimpleJsonParser {
        private final String json;
        private int pos;

        public SimpleJsonParser(String json) {
            this.json = json;
            this.pos = 0;
        }

        public Object parse() {
            skipWhitespace();
            return parseValue();
        }

        public Map<String, Object> parseObject() {
            Object val = parse();
            if (val instanceof Map) return (Map<String, Object>) val;
            throw new RuntimeException("Expected JSON object");
        }

        private void skipWhitespace() {
            while (pos < json.length() && Character.isWhitespace(json.charAt(pos))) pos++;
        }

        private Object parseValue() {
            skipWhitespace();
            if (pos >= json.length()) throw new RuntimeException("Unexpected end of input");
            char c = json.charAt(pos);
            if (c == '{') return parseObjectValue();
            if (c == '[') return parseArray();
            if (c == '"') return parseString();
            if (c == 't' || c == 'f') return parseBoolean();
            if (c == 'n') return parseNull();
            return parseNumber();
        }

        private Map<String, Object> parseObjectValue() {
            pos++;
            Map<String, Object> map = new HashMap<>();
            skipWhitespace();
            if (pos < json.length() && json.charAt(pos) == '}') {
                pos++;
                return map;
            }
            while (true) {
                skipWhitespace();
                String key = parseString();
                skipWhitespace();
                if (pos >= json.length() || json.charAt(pos) != ':')
                    throw new RuntimeException("Expected ':' after key");
                pos++;
                Object value = parseValue();
                map.put(key, value);
                skipWhitespace();
                if (pos >= json.length()) break;
                char c = json.charAt(pos);
                if (c == '}') {
                    pos++;
                    break;
                }
                if (c != ',') throw new RuntimeException("Expected ',' or '}'");
                pos++;
            }
            return map;
        }

        private List<Object> parseArray() {
            pos++;
            List<Object> list = new ArrayList<>();
            skipWhitespace();
            if (pos < json.length() && json.charAt(pos) == ']') {
                pos++;
                return list;
            }
            while (true) {
                list.add(parseValue());
                skipWhitespace();
                if (pos >= json.length()) break;
                char c = json.charAt(pos);
                if (c == ']') {
                    pos++;
                    break;
                }
                if (c != ',') throw new RuntimeException("Expected ',' or ']'");
                pos++;
                skipWhitespace();
            }
            return list;
        }

        private String parseString() {
            pos++;
            StringBuilder sb = new StringBuilder();
            while (pos < json.length()) {
                char c = json.charAt(pos);
                if (c == '"') {
                    pos++;
                    return sb.toString();
                }
                if (c == '\\\\') {
                    pos++;
                    if (pos >= json.length()) throw new RuntimeException("Incomplete escape sequence");
                    char esc = json.charAt(pos);
                    switch (esc) {
                        case '"': sb.append('"'); break;
                        case '\\\\': sb.append('\\\\'); break;
                        case '/': sb.append('/'); break;
                        case 'b': sb.append('\\b'); break;
                        case 'f': sb.append('\\f'); break;
                        case 'n': sb.append('\\n'); break;
                        case 'r': sb.append('\\r'); break;
                        case 't': sb.append('\\t'); break;
                        default: sb.append(esc);
                    }
                } else {
                    sb.append(c);
                }
                pos++;
            }
            throw new RuntimeException("Unterminated string");
        }

        private Object parseBoolean() {
            if (json.startsWith("true", pos)) {
                pos += 4;
                return Boolean.TRUE;
            }
            if (json.startsWith("false", pos)) {
                pos += 5;
                return Boolean.FALSE;
            }
            throw new RuntimeException("Invalid boolean literal");
        }

        private Object parseNull() {
            if (json.startsWith("null", pos)) {
                pos += 4;
                return null;
            }
            throw new RuntimeException("Invalid null literal");
        }

        private Number parseNumber() {
            int start = pos;
            while (pos < json.length() && (Character.isDigit(json.charAt(pos)) ||
                   json.charAt(pos) == '.' || json.charAt(pos) == '-' ||
                   json.charAt(pos) == '+' || json.charAt(pos) == 'e' ||
                   json.charAt(pos) == 'E')) {
                pos++;
            }
            String numStr = json.substring(start, pos);
            try {
                if (numStr.contains(".") || numStr.contains("e") || numStr.contains("E"))
                    return Double.parseDouble(numStr);
                else
                    return Long.parseLong(numStr);
            } catch (NumberFormatException e) {
                throw new RuntimeException("Invalid number: " + numStr);
            }
        }
    }
`;
  }

  _serializeResult(returnType, resultVar) {
    const typeStr = (typeof returnType === 'string') ? returnType : String(returnType);
    if (typeStr === "void") {
      return 'System.out.print("null");';
    }
    if (typeStr.includes("ListNode")) {
      return `System.out.print(serializeListNode(${resultVar}));`;
    }
    if (typeStr.includes("TreeNode")) {
      return `System.out.print(serializeTreeNode(${resultVar}));`;
    }
    if (typeStr.includes("Node")) {
      return `System.out.print(serializeNode(${resultVar}));`;
    }
    if (typeStr.includes("NestedInteger")) {
      return `System.out.print(serializeNestedInteger(${resultVar}));`;
    }
    if (typeStr === "String") {
      return `System.out.print("\\"" + ${resultVar} + "\\"");`;
    }
    return `System.out.print(${resultVar});`;
  }

  _javaTypeCast(type) {
    const typeStr = (typeof type === 'string') ? type : String(type);
    if (typeStr.includes("ListNode")) return "ListNode";
    if (typeStr.includes("TreeNode")) return "TreeNode";
    if (typeStr.includes("Node")) return "Node";
    if (typeStr.includes("NestedInteger")) return "NestedInteger";
    if (typeStr === "int") return "int";
    if (typeStr === "long") return "long";
    if (typeStr === "double") return "double";
    if (typeStr === "boolean") return "boolean";
    if (typeStr === "String") return "String";
    return "Object";
  }

  _javaTypeFromString(type) {
    const typeStr = (typeof type === 'string') ? type : String(type);
    if (typeStr.includes("ListNode")) return "ListNode";
    if (typeStr.includes("TreeNode")) return "TreeNode";
    if (typeStr.includes("Node")) return "Node";
    if (typeStr.includes("NestedInteger")) return "NestedInteger";
    if (typeStr === "int") return "int";
    if (typeStr === "long") return "long";
    if (typeStr === "double") return "double";
    if (typeStr === "boolean") return "boolean";
    if (typeStr === "String") return "String";
    return "Object";
  }

  _generateImports() {
    return "import java.util.*;\nimport java.lang.*;\nimport java.io.*;";
  }
}

module.exports = JavaGenerator;