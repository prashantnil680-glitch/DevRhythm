const fs = require('fs');
const path = require('path');

class CppGenerator {
  generateWrapper(userCode, metadata, testCases) {
    if (!userCode || typeof userCode !== 'string') {
      throw new Error('Invalid user code');
    }
    if (!metadata || !metadata.methodName) {
      throw new Error('Invalid metadata: missing methodName');
    }

    const jsonParserCode = this._getJsonParser();
    const helpersCode = this._getEmbeddedHelpers();
    const { deserCode, callCode } = this._generateExecutionCode(metadata);
    const mainCode = this._buildMain(metadata, deserCode, callCode);
    const includes = this._generateIncludes();

    const finalCode = `${includes}\n\n${jsonParserCode}\n\n${helpersCode}\n\n${userCode}\n\n${mainCode}`;
    return finalCode;
  }

  _getJsonParser() {
    return `
class JsonValue {
public:
    enum Type { JSON_NULL, JSON_BOOL, JSON_NUMBER, JSON_STRING, JSON_ARRAY, JSON_OBJECT };
    Type type;
    union {
        bool bool_val;
        double number_val;
    };
    std::shared_ptr<std::string> string_val;
    std::shared_ptr<std::vector<JsonValue>> array_val;
    std::shared_ptr<std::map<std::string, JsonValue>> object_val;

    JsonValue() : type(JSON_NULL), bool_val(false) {}
    JsonValue(bool b) : type(JSON_BOOL), bool_val(b) {}
    JsonValue(double n) : type(JSON_NUMBER), number_val(n) {}
    JsonValue(const std::string& s) : type(JSON_STRING), string_val(std::make_shared<std::string>(s)) {}
    JsonValue(const std::vector<JsonValue>& arr) : type(JSON_ARRAY), array_val(std::make_shared<std::vector<JsonValue>>(arr)) {}
    JsonValue(const std::map<std::string, JsonValue>& obj) : type(JSON_OBJECT), object_val(std::make_shared<std::map<std::string, JsonValue>>(obj)) {}

    bool isNull() const { return type == JSON_NULL; }
    bool isBool() const { return type == JSON_BOOL; }
    bool isNumber() const { return type == JSON_NUMBER; }
    bool isString() const { return type == JSON_STRING; }
    bool isArray() const { return type == JSON_ARRAY; }
    bool isObject() const { return type == JSON_OBJECT; }

    bool asBool() const { return bool_val; }
    double asNumber() const { return number_val; }
    std::string asString() const { return *string_val; }
    std::vector<JsonValue> asArray() const { return *array_val; }
    std::map<std::string, JsonValue> asObject() const { return *object_val; }
};

class JsonParser {
    std::string json;
    size_t pos;
public:
    JsonParser(const std::string& s) : json(s), pos(0) {}
    JsonValue parse() { skipWhitespace(); return parseValue(); }
private:
    void skipWhitespace() { while (pos < json.size() && std::isspace(json[pos])) ++pos; }
    JsonValue parseValue() {
        skipWhitespace();
        char c = json[pos];
        if (c == '{') return parseObject();
        if (c == '[') return parseArray();
        if (c == '"') return parseString();
        if (c == 't' || c == 'f') return parseBool();
        if (c == 'n') return parseNull();
        return parseNumber();
    }
    JsonValue parseObject() {
        std::map<std::string, JsonValue> obj;
        ++pos; skipWhitespace();
        if (json[pos] == '}') { ++pos; return obj; }
        while (true) {
            skipWhitespace();
            std::string key = parseString().asString();
            skipWhitespace();
            if (json[pos] != ':') throw std::runtime_error("Expected ':'");
            ++pos;
            JsonValue val = parseValue();
            obj[key] = val;
            skipWhitespace();
            if (json[pos] == '}') { ++pos; break; }
            if (json[pos] != ',') throw std::runtime_error("Expected ',' or '}'");
            ++pos;
        }
        return obj;
    }
    JsonValue parseArray() {
        std::vector<JsonValue> arr;
        ++pos; skipWhitespace();
        if (json[pos] == ']') { ++pos; return arr; }
        while (true) {
            arr.push_back(parseValue());
            skipWhitespace();
            if (json[pos] == ']') { ++pos; break; }
            if (json[pos] != ',') throw std::runtime_error("Expected ',' or ']'");
            ++pos;
        }
        return arr;
    }
    JsonValue parseString() {
        ++pos;
        std::string str;
        while (pos < json.size() && json[pos] != '"') {
            if (json[pos] == '\\\\') {
                ++pos;
                char c = json[pos];
                switch (c) {
                    case '"': str += '"'; break;
                    case '\\\\': str += '\\\\'; break;
                    case '/': str += '/'; break;
                    case 'b': str += '\\b'; break;
                    case 'f': str += '\\f'; break;
                    case 'n': str += '\\n'; break;
                    case 'r': str += '\\r'; break;
                    case 't': str += '\\t'; break;
                    default: str += c;
                }
            } else {
                str += json[pos];
            }
            ++pos;
        }
        if (pos >= json.size() || json[pos] != '"') throw std::runtime_error("Unterminated string");
        ++pos;
        return JsonValue(str);
    }
    JsonValue parseBool() {
        if (json.compare(pos, 4, "true") == 0) { pos += 4; return JsonValue(true); }
        if (json.compare(pos, 5, "false") == 0) { pos += 5; return JsonValue(false); }
        throw std::runtime_error("Invalid boolean");
    }
    JsonValue parseNull() {
        if (json.compare(pos, 4, "null") == 0) { pos += 4; return JsonValue(); }
        throw std::runtime_error("Invalid null");
    }
    JsonValue parseNumber() {
        size_t start = pos;
        while (pos < json.size() && (std::isdigit(json[pos]) || json[pos] == '.' || json[pos] == '-' || json[pos] == 'e' || json[pos] == 'E')) ++pos;
        std::string numStr = json.substr(start, pos - start);
        char* end;
        double num = std::strtod(numStr.c_str(), &end);
        if (end == numStr.c_str()) throw std::runtime_error("Invalid number");
        return JsonValue(num);
    }
};
`;
  }

  _getEmbeddedHelpers() {
    return `
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wunused-function"

// ----------------------------------------------------------------------
// Helper functions for deserialization and serialization
// ----------------------------------------------------------------------

// ---------- vector<int> ----------
static std::vector<int> deserializeIntVector(const JsonValue& val) {
    std::vector<int> res;
    if (!val.isArray()) return res;
    for (const auto& elem : val.asArray()) {
        res.push_back((int)elem.asNumber());
    }
    return res;
}

static JsonValue serializeIntVector(const std::vector<int>& vec) {
    std::vector<JsonValue> res;
    for (int v : vec) res.push_back(JsonValue((double)v));
    return JsonValue(res);
}

// ---------- vector<vector<int>> ----------
static std::vector<std::vector<int>> deserializeIntVectorVector(const JsonValue& val) {
    std::vector<std::vector<int>> res;
    if (!val.isArray()) return res;
    for (const auto& row : val.asArray()) {
        res.push_back(deserializeIntVector(row));
    }
    return res;
}

static JsonValue serializeIntVectorVector(const std::vector<std::vector<int>>& vec) {
    std::vector<JsonValue> res;
    for (const auto& row : vec) {
        res.push_back(serializeIntVector(row));
    }
    return JsonValue(res);
}

// ---------- vector<string> ----------
static std::vector<std::string> deserializeStringVector(const JsonValue& val) {
    std::vector<std::string> res;
    if (!val.isArray()) return res;
    for (const auto& elem : val.asArray()) {
        if (elem.isString()) res.push_back(elem.asString());
        else res.push_back("");
    }
    return res;
}

static JsonValue serializeStringVector(const std::vector<std::string>& vec) {
    std::vector<JsonValue> res;
    for (const std::string& s : vec) res.push_back(JsonValue(s));
    return JsonValue(res);
}

// ---------- ListNode ----------
struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};

static ListNode* deserializeListNode(const JsonValue& val) {
    if (!val.isArray()) return nullptr;
    auto arr = val.asArray();
    if (arr.empty()) return nullptr;
    ListNode* head = new ListNode((int)arr[0].asNumber());
    ListNode* cur = head;
    for (size_t i = 1; i < arr.size(); ++i) {
        cur->next = new ListNode((int)arr[i].asNumber());
        cur = cur->next;
    }
    return head;
}

static JsonValue serializeListNode(ListNode* head) {
    std::vector<JsonValue> res;
    while (head) {
        res.push_back(JsonValue((double)head->val));
        head = head->next;
    }
    return JsonValue(res);
}

// ---------- TreeNode ----------
struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
};

static TreeNode* deserializeTreeNode(const JsonValue& val) {
    if (!val.isArray()) return nullptr;
    auto arr = val.asArray();
    if (arr.empty()) return nullptr;
    std::vector<TreeNode*> nodes;
    for (const auto& elem : arr) {
        if (elem.isNull()) nodes.push_back(nullptr);
        else nodes.push_back(new TreeNode((int)elem.asNumber()));
    }
    int i = 0, j = 1;
    while (j < (int)nodes.size()) {
        if (nodes[i]) {
            nodes[i]->left = nodes[j++];
            if (j < (int)nodes.size()) nodes[i]->right = nodes[j++];
        }
        i++;
    }
    return nodes[0];
}

static JsonValue serializeTreeNode(TreeNode* root) {
    std::vector<JsonValue> res;
    std::queue<TreeNode*> q;
    q.push(root);
    while (!q.empty()) {
        TreeNode* node = q.front(); q.pop();
        if (node) {
            res.push_back(JsonValue((double)node->val));
            q.push(node->left);
            q.push(node->right);
        } else {
            res.push_back(JsonValue()); // null
        }
    }
    while (!res.empty() && res.back().isNull()) res.pop_back();
    return JsonValue(res);
}

// ---------- Node (graph & random list) ----------
struct Node {
    int val;
    std::vector<Node*> neighbors;
    Node* next;
    Node* random;
    Node() : val(0), next(nullptr), random(nullptr) {}
    Node(int _val) : val(_val), next(nullptr), random(nullptr) {}
    Node(int _val, std::vector<Node*> _neighbors) : val(_val), neighbors(_neighbors), next(nullptr), random(nullptr) {}
    Node(int _val, Node* _next, Node* _random) : val(_val), next(_next), random(_random) {}
};

static Node* deserializeGraphNode(const JsonValue& val) {
    if (!val.isArray()) return nullptr;
    auto adj = val.asArray();
    if (adj.empty()) return nullptr;
    std::map<int, Node*> nodes;
    for (size_t i = 0; i < adj.size(); ++i) {
        int nodeVal = (int)i + 1;
        if (!nodes.count(nodeVal)) nodes[nodeVal] = new Node(nodeVal);
        auto neighbors = adj[i].asArray();
        for (const auto& nb : neighbors) {
            int nbVal = (int)nb.asNumber();
            if (!nodes.count(nbVal)) nodes[nbVal] = new Node(nbVal);
            nodes[nodeVal]->neighbors.push_back(nodes[nbVal]);
        }
    }
    return nodes[1];
}

static JsonValue serializeGraphNode(Node* node) {
    if (!node) return JsonValue();
    std::map<Node*, int> idx;
    std::vector<Node*> order;
    std::queue<Node*> q;
    q.push(node);
    while (!q.empty()) {
        Node* cur = q.front(); q.pop();
        if (idx.count(cur)) continue;
        idx[cur] = (int)order.size();
        order.push_back(cur);
        for (Node* nb : cur->neighbors) q.push(nb);
    }
    std::sort(order.begin(), order.end(), [](Node* a, Node* b) { return a->val < b->val; });
    std::vector<std::vector<int>> res;
    for (Node* n : order) {
        std::vector<int> nbVals;
        for (Node* nb : n->neighbors) nbVals.push_back(idx[nb] + 1);
        res.push_back(nbVals);
    }
    return serializeIntVectorVector(res);
}

static Node* deserializeRandomListNode(const JsonValue& val) {
    if (!val.isArray()) return nullptr;
    auto arr = val.asArray();
    if (arr.empty()) return nullptr;
    std::vector<Node*> nodes;
    for (const auto& pair : arr) {
        auto pairArr = pair.asArray();
        int nodeVal = (int)pairArr[0].asNumber();
        nodes.push_back(new Node(nodeVal));
    }
    for (size_t i = 0; i + 1 < nodes.size(); ++i) {
        nodes[i]->next = nodes[i+1];
    }
    for (size_t i = 0; i < arr.size(); ++i) {
        auto pairArr = arr[i].asArray();
        if (pairArr.size() >= 2 && !pairArr[1].isNull()) {
            int randomIdx = (int)pairArr[1].asNumber();
            nodes[i]->random = nodes[randomIdx];
        }
    }
    return nodes.empty() ? nullptr : nodes[0];
}

static JsonValue serializeRandomListNode(Node* head) {
    if (!head) return JsonValue();
    std::map<Node*, int> idx;
    Node* cur = head;
    int i = 0;
    while (cur) {
        idx[cur] = i++;
        cur = cur->next;
    }
    std::vector<JsonValue> res;
    cur = head;
    while (cur) {
        std::vector<JsonValue> pair;
        pair.push_back(JsonValue((double)cur->val));
        if (cur->random && idx.count(cur->random))
            pair.push_back(JsonValue((double)idx[cur->random]));
        else
            pair.push_back(JsonValue());
        res.push_back(JsonValue(pair));
        cur = cur->next;
    }
    return JsonValue(res);
}

static Node* deserializeNode(const JsonValue& val) {
    if (!val.isArray()) return nullptr;
    auto arr = val.asArray();
    if (arr.empty()) return nullptr;
    if (arr[0].isArray()) {
        auto first = arr[0].asArray();
        if (first.size() == 2 && (first[1].isNumber() || first[1].isNull())) {
            return deserializeRandomListNode(val);
        }
    }
    return deserializeGraphNode(val);
}

static JsonValue serializeNode(Node* node) {
    if (!node) return JsonValue();
    if (node->next != nullptr) {
        return serializeRandomListNode(node);
    } else {
        return serializeGraphNode(node);
    }
}

// ---------- NestedInteger ----------
class NestedInteger {
private:
    int value;
    std::vector<NestedInteger> list;
    bool isInt;
public:
    NestedInteger() : isInt(false) {}
    NestedInteger(int val) : value(val), isInt(true) {}
    bool isInteger() const { return isInt; }
    int getInteger() const { return value; }
    void setInteger(int val) { value = val; isInt = true; list.clear(); }
    void add(const NestedInteger& ni) { list.push_back(ni); }
    const std::vector<NestedInteger>& getList() const { return list; }
};

static NestedInteger deserializeNestedInteger(const JsonValue& val) {
    if (val.isNumber()) {
        return NestedInteger((int)val.asNumber());
    } else if (val.isArray()) {
        NestedInteger ni;
        for (const auto& elem : val.asArray()) {
            ni.add(deserializeNestedInteger(elem));
        }
        return ni;
    }
    return NestedInteger();
}

static JsonValue serializeNestedInteger(const NestedInteger& ni) {
    if (ni.isInteger()) {
        return JsonValue((double)ni.getInteger());
    } else {
        std::vector<JsonValue> arr;
        for (const auto& child : ni.getList()) {
            arr.push_back(serializeNestedInteger(child));
        }
        return JsonValue(arr);
    }
}

#pragma GCC diagnostic pop
`;
  }

  _generateExecutionCode(metadata) {
    const { className, methodName, parameters, returnType, interactive, methods, constructorParams } = metadata;
    if (interactive) {
      return this._generateInteractiveExecution(className, methods, constructorParams);
    } else {
      return this._generateStandardExecution(className, methodName, parameters, returnType);
    }
  }

  _generateStandardExecution(className, methodName, parameters, returnType) {
    const deserLines = [];
    for (let i = 0; i < parameters.length; i++) {
      const param = parameters[i];
      const type = param.type;
      let deserExpr = '';
      if (type == "int") {
        deserExpr = `(int)argsArray[${i}].asNumber()`;
      } else if (type == "double") {
        deserExpr = `argsArray[${i}].asNumber()`;
      } else if (type == "bool") {
        deserExpr = `argsArray[${i}].asBool()`;
      } else if (type == "string" || type == "std::string") {
        deserExpr = `argsArray[${i}].asString()`;
      } else if (type == "vector<int>" || type == "vector<int>&") {
        deserExpr = `deserializeIntVector(argsArray[${i}])`;
      } else if (type == "vector<vector<int>>" || type == "vector<vector<int>>&") {
        deserExpr = `deserializeIntVectorVector(argsArray[${i}])`;
      } else if (type == "vector<string>" || type == "vector<string>&") {
        deserExpr = `deserializeStringVector(argsArray[${i}])`;
      } else if (type.includes("ListNode")) {
        deserExpr = `deserializeListNode(argsArray[${i}])`;
      } else if (type.includes("TreeNode")) {
        deserExpr = `deserializeTreeNode(argsArray[${i}])`;
      } else if (type.includes("Node")) {
        deserExpr = `deserializeNode(argsArray[${i}])`;
      } else if (type.includes("NestedInteger")) {
        deserExpr = `deserializeNestedInteger(argsArray[${i}])`;
      } else {
        deserExpr = `argsArray[${i}]`;
      }
      deserLines.push(`    auto arg${i} = ${deserExpr};`);
    }
    const deserCode = deserLines.join('\n');

    let callLine;
    if (className) {
      callLine = `    ${className} obj;
    ${returnType === "void" ? "" : "auto result = "}obj.${methodName}(${parameters.map((_, i) => `arg${i}`).join(", ")});
    ${this._serializeResult(returnType, "result")}`;
    } else {
      callLine = `    ${returnType === "void" ? "" : "auto result = "}${methodName}(${parameters.map((_, i) => `arg${i}`).join(", ")});
    ${this._serializeResult(returnType, "result")}`;
    }
    return { deserCode, callCode: callLine };
  }

  _generateInteractiveExecution(className, methods, constructorParams) {
    const instantiation = `    ${className} obj;
    try {
        obj = ${className}(${constructorParams.map((_, i) => `constrArgs[${i}]`).join(", ")});
    } catch (const std::exception& e) {
        std::cerr << e.what() << std::endl;
        return;
    }`;
    const dispatch = methods.map(m => {
      const paramTypes = m.parameters.map(p => this._cppTypeFromString(p));
      return `        if (methodName == "${m.name}") {
            try {
                ${m.returnType === "void" ? "" : "auto res = "}obj.${m.name}(${paramTypes.map((_, i) => `methodArgs[${i}]`).join(", ")});
                results.push_back(${m.returnType === "void" ? "nullptr" : "res"});
            } catch (const std::exception& e) {
                std::cerr << e.what() << std::endl;
                results.push_back(nullptr);
            }
        } else`;
    }).join(' ') + ` {
            results.push_back(nullptr);
        }`;
    const serialization = `    std::cout << serialize(results);`;

    const deserCode = `
    JsonParser parser(inputStr);
    JsonValue parsed = parser.parse();
    auto objMap = parsed.asObject();
    std::vector<JsonValue> constrArgs = objMap["constructor"].asArray();
    std::vector<std::vector<JsonValue>> methodsList;
    for (auto& call : objMap["methods"].asArray()) {
        methodsList.push_back(call.asArray());
    }
    std::vector<JsonValue> results;
    results.push_back(JsonValue());
    ${instantiation}
    for (auto& call : methodsList) {
        if (call.size() < 1) { results.push_back(JsonValue()); continue; }
        std::string methodName = call[0].asString();
        std::vector<JsonValue> methodArgs;
        for (size_t i = 1; i < call.size(); i++) methodArgs.push_back(call[i]);
        ${dispatch}
    }`;
    return { deserCode, callCode: serialization };
  }

  _serializeResult(returnType, resultVar) {
    if (returnType === "void") return 'std::cout << "null";';
    if (returnType.includes("ListNode")) return `std::cout << serializeListNode(${resultVar});`;
    if (returnType.includes("TreeNode")) return `std::cout << serializeTreeNode(${resultVar});`;
    if (returnType.includes("Node")) return `std::cout << serializeNode(${resultVar});`;
    if (returnType.includes("NestedInteger")) return `std::cout << serializeNestedInteger(${resultVar});`;
    if (returnType == "std::string") return `std::cout << "\\"" << ${resultVar} << "\\"";`;
    if (returnType == "bool") return `std::cout << std::boolalpha << ${resultVar};`;
    if (returnType == "vector<int>") return `std::cout << serializeIntVector(${resultVar});`;
    if (returnType == "vector<vector<int>>") return `std::cout << serializeIntVectorVector(${resultVar});`;
    if (returnType == "vector<string>") return `std::cout << serializeStringVector(${resultVar});`;
    return `std::cout << ${resultVar};`;
  }

  _buildMain(metadata, deserCode, callCode) {
    const interactive = metadata.interactive;
    if (interactive) {
      return `
int main() {
    std::string line;
    std::getline(std::cin, line);
    try {
        ${deserCode}
        ${callCode}
    } catch (const std::exception& e) {
        std::cerr << e.what() << std::endl;
    } catch (...) {
        std::cerr << "Unknown error" << std::endl;
    }
    return 0;
}
`;
    } else {
      return `
int main() {
    std::string line;
    std::getline(std::cin, line);
    try {
        JsonParser parser(line);
        JsonValue parsed = parser.parse();
        auto objMap = parsed.asObject();
        std::vector<JsonValue> argsArray = objMap["args"].asArray();
        ${deserCode}
        ${callCode}
        std::cout << std::endl;
    } catch (const std::exception& e) {
        std::cerr << "ERROR: " << e.what() << std::endl;
    } catch (...) {
        std::cerr << "Unknown error" << std::endl;
    }
    return 0;
}
`;
    }
  }

  _generateIncludes() {
    return `#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <memory>
#include <sstream>
#include <cctype>
#include <algorithm>
#include <queue>
#include <stack>
#include <cmath>
#include <cstring>
#include <functional>
#include <unordered_set>
using namespace std;`;
  }

  _cppTypeFromString(type) {
    if (type.includes("ListNode")) return "ListNode*";
    if (type.includes("TreeNode")) return "TreeNode*";
    if (type.includes("Node")) return "Node*";
    if (type.includes("NestedInteger")) return "NestedInteger";
    if (type == "int") return "int";
    if (type == "long") return "long";
    if (type == "double") return "double";
    if (type == "bool") return "bool";
    if (type == "string") return "string";
    if (type.contains("vector")) return type;
    return "auto";
  }
}

module.exports = CppGenerator;