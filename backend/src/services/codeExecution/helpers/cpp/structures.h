#ifndef STRUCTURES_H
#define STRUCTURES_H

#include <iostream>
#include <vector>
#include <string>
#include <map>
#include <queue>
#include <memory>
#include <sstream>
#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstring>
#include <functional>
#include <unordered_set>
#include <stack>

// ----------------------------------------------------------------------
// JSON Parser (lightweight, used by wrapper)
// ----------------------------------------------------------------------
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
            if (json[pos] == '\\') {
                ++pos;
                char c = json[pos];
                switch (c) {
                    case '"': str += '"'; break;
                    case '\\': str += '\\'; break;
                    case '/': str += '/'; break;
                    case 'b': str += '\b'; break;
                    case 'f': str += '\f'; break;
                    case 'n': str += '\n'; break;
                    case 'r': str += '\r'; break;
                    case 't': str += '\t'; break;
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

// ----------------------------------------------------------------------
// Data Structures
// ----------------------------------------------------------------------
struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};

struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
};

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

// ----------------------------------------------------------------------
// Serialization / Deserialization Helpers
// ----------------------------------------------------------------------
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

static std::vector<std::vector<std::string>> deserializeStringVectorVector(const JsonValue& val) {
    std::vector<std::vector<std::string>> res;
    if (!val.isArray()) return res;
    for (const auto& elem : val.asArray()) {
        res.push_back(deserializeStringVector(elem));
    }
    return res;
}

static JsonValue serializeStringVectorVector(const std::vector<std::vector<std::string>>& vec) {
    std::vector<JsonValue> res;
    for (const auto& inner : vec) {
        res.push_back(serializeStringVector(inner));
    }
    return JsonValue(res);
}

static std::vector<char> deserializeCharVector(const JsonValue& val) {
    std::vector<char> res;
    if (!val.isArray()) return res;
    for (const auto& elem : val.asArray()) {
        if (elem.isString()) {
            std::string s = elem.asString();
            if (!s.empty()) res.push_back(s[0]);
        } else if (elem.isNumber()) {
            res.push_back((char)elem.asNumber());
        }
    }
    return res;
}

static JsonValue serializeCharVector(const std::vector<char>& vec) {
    std::vector<JsonValue> res;
    for (char c : vec) {
        std::string s(1, c);
        res.push_back(JsonValue(s));
    }
    return JsonValue(res);
}

static std::vector<std::vector<char>> deserializeCharVectorVector(const JsonValue& val) {
    std::vector<std::vector<char>> res;
    if (!val.isArray()) return res;
    for (const auto& row : val.asArray()) {
        res.push_back(deserializeCharVector(row));
    }
    return res;
}

static JsonValue serializeCharVectorVector(const std::vector<std::vector<char>>& vec) {
    std::vector<JsonValue> res;
    for (const auto& row : vec) {
        res.push_back(serializeCharVector(row));
    }
    return JsonValue(res);
}

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

/**
 * Deserialize a linked list that may have a cycle.
 * Expects the JsonValue to be an object with "list" and "pos" keys.
 * If the JsonValue is a plain array, falls back to deserializeListNode.
 */
static ListNode* deserializeCyclicListNode(const JsonValue& val, int pos) {
    // If it's a plain array, use the standard deserializer
    if (val.isArray()) {
        return deserializeListNode(val);
    }
    // If it's an object with "list" and "pos", handle it
    if (!val.isObject()) return nullptr;
    auto obj = val.asObject();
    auto listIt = obj.find("list");
    auto posIt = obj.find("pos");
    if (listIt == obj.end() || posIt == obj.end()) return nullptr;
    if (!listIt->second.isArray()) return nullptr;
    if (!posIt->second.isNumber()) return nullptr;
    int posVal = (int)posIt->second.asNumber();
    
    // Build linear list from the "list" array
    auto arr = listIt->second.asArray();
    if (arr.empty()) return nullptr;
    ListNode* head = new ListNode((int)arr[0].asNumber());
    ListNode* cur = head;
    for (size_t i = 1; i < arr.size(); ++i) {
        cur->next = new ListNode((int)arr[i].asNumber());
        cur = cur->next;
    }
    // If pos == -1, return linear list
    if (posVal == -1) return head;
    // If pos out of bounds, return linear list
    if (posVal < 0 || posVal >= (int)arr.size()) return head;
    // Find tail and node at pos
    ListNode* tail = head;
    while (tail->next) tail = tail->next;
    ListNode* posNode = head;
    for (int i = 0; i < posVal; ++i) {
        if (posNode->next) posNode = posNode->next;
        else return head; // safety
    }
    tail->next = posNode;
    return head;
}

static JsonValue serializeListNode(ListNode* head) {
    std::vector<JsonValue> res;
    // To avoid infinite loops on cyclic lists, limit traversal to 1000 nodes or detect visited.
    std::unordered_set<ListNode*> visited;
    while (head && visited.find(head) == visited.end()) {
        visited.insert(head);
        res.push_back(JsonValue((double)head->val));
        head = head->next;
    }
    return JsonValue(res);
}

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

#endif // STRUCTURES_H