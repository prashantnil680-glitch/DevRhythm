const { DateTime } = require('luxon');
const { executeBatch } = require("../services/codeExecution.service");
const { formatResponse } = require("../utils/helpers/response");
const AppError = require("../utils/errors/AppError");
const Question = require("../models/Question");
const UserQuestionProgress = require("../models/UserQuestionProgress");
const CodeExecutionHistory = require("../models/CodeExecutionHistory");
const RevisionSchedule = require("../models/RevisionSchedule"); 
const { invalidateCache, invalidateProgressCache } = require('../middleware/cache');
const revisionActivityService = require("../services/revisionActivity.service");
const { jobQueue } = require('../services/queue.service');
const { markTestPassedForQuestion } = require('../services/revisionActivity.service');
const constants = require('../config/constants');

const SUPPORTED_LANGUAGES = ["cpp", "python", "java", "javascript"];
const normalize = (str) => (str || "").replace(/\s/g, "");

// Normalize language aliases: "C++" → "cpp", "Python3" → "python"
const normalizeLanguage = (lang) => {
  const lower = lang.toLowerCase();
  if (lower === 'c++') return 'cpp';
  if (lower === 'python3') return 'python';
  if (lower === 'javascript') return 'javascript';
  if (lower === 'java') return 'java';
  return lower;
};


const hasSolveFunction = (code, language) => {
  if (language === "python") return /def\s+solve\s*\(/.test(code);
  if (language === "javascript")
    return (
      /function\s+solve\s*\(/.test(code) ||
      /const\s+solve\s*=\s*function/.test(code) ||
      /let\s+solve\s*=\s*\(/.test(code)
    );
  if (language === "cpp") return /string\s+solve\s*\(/.test(code);
  if (language === "java")
    return /public\s+static\s+String\s+solve\s*\(/.test(code);
  return false;
};

function generatePythonWrapper(userCode, starterCode, testCases) {
  // ----- Step 1: Extract method signature from Solution class -----
  let methodName, paramStr, returnType;
  const extractFromCode = (code) => {
    const classMatch = code.match(/class\s+Solution\s*:/);
    if (!classMatch) return null;
    const methodRegex = /^\s+def\s+(\w+)\(self,\s*(.*?)\)\s*->\s*([^:]+):/gm;
    let match = methodRegex.exec(code);
    if (!match) return null;
    return {
      methodName: match[1],
      paramStr: match[2],
      returnType: match[3].trim(),
    };
  };

  let extracted = extractFromCode(starterCode || userCode);
  if (!extracted && starterCode) extracted = extractFromCode(userCode);
  if (!extracted) {
    // Fallback to interactive problem handling
    const anyClassMatch = userCode.match(/class\s+(\w+)\s*:/);
    if (anyClassMatch) {
      const className = anyClassMatch[1];
      const interactiveWrapper = `
import json
from collections import deque

def solve(input_str):
    data = json.loads(input_str)
    results = []
    obj = None
    if isinstance(data, dict):
        # Extract constructor arguments (all keys except 'ops')
        constructor_args = {k: v for k, v in data.items() if k != 'ops'}
        obj = ${className}(**constructor_args)
        results.append(None)
        for op in data['ops']:
            if isinstance(op, list):
                method = op[0]
                args = op[1:]
                if hasattr(obj, method):
                    res = getattr(obj, method)(*args)
                    results.append(res)
                else:
                    results.append(None)
            else:
                if hasattr(obj, op):
                    res = getattr(obj, op)()
                    results.append(res)
                else:
                    results.append(None)
        return json.dumps(results)
    elif isinstance(data, list):
        for op in data:
            if not isinstance(op, list):
                results.append(None)
                continue
            if op[0] == '${className}':
                # Constructor
                obj = ${className}(*op[1:])
                results.append(None)
            else:
                # Method call
                if obj is None:
                    results.append(None)
                else:
                    method = op[0]
                    args = op[1:]
                    if hasattr(obj, method):
                        res = getattr(obj, method)(*args)
                        results.append(res)
                    else:
                        results.append(None)
        return json.dumps(results)
    else:
        return "[]"
`;
      return `${userCode}\n\n${interactiveWrapper}`;
    }
    throw new Error("Could not find method signature in user code");
  }

  // ----- Standard wrapper for Solution class -----
  methodName = extracted.methodName;
  paramStr = extracted.paramStr;
  returnType = extracted.returnType;

  // ----- Parse parameters -----
  const parseParam = (paramStr) => {
    const parts = [];
    let current = "";
    let bracketDepth = 0;
    for (let ch of paramStr) {
      if (ch === "[") bracketDepth++;
      if (ch === "]") bracketDepth--;
      if (ch === "," && bracketDepth === 0) {
        parts.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim()) parts.push(current.trim());
    return parts.map((part) => {
      const [name, typeHint] = part.split(":").map((s) => s.trim());
      return { name, typeHint: typeHint || null };
    });
  };
  const params = parseParam(paramStr);
  const paramCount = params.length;

  // ----- Determine needed data structures -----
  const neededDS = new Set();
  const addType = (typeHint) => {
    if (!typeHint) return;
    if (typeHint.includes("ListNode")) neededDS.add("ListNode");
    if (typeHint.includes("DoublyListNode")) neededDS.add("DoublyListNode");
    if (typeHint.includes("TreeNode")) neededDS.add("TreeNode");
    if (typeHint.includes("NaryTreeNode")) neededDS.add("NaryTreeNode");
    if (typeHint.includes("NestedInteger")) neededDS.add("NestedInteger");
    if (typeHint.includes("Dict[")) neededDS.add("DictHelper");
    if (typeHint.includes("List[")) neededDS.add("ListHelper");
    if (typeHint.includes("Tuple[")) neededDS.add("TupleHelper");
    if (typeHint.includes("Set[")) neededDS.add("SetHelper");
    if (typeHint.includes("Node")) neededDS.add("Node");
  };
  params.forEach((p) => addType(p.typeHint));
  addType(returnType);

  // ----- Helper code snippets (complete, with SetHelper) -----
  const helpers = {
    ListNode: `
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def deserialize_linked_list(arr):
    if not arr:
        return None
    head = ListNode(arr[0])
    curr = head
    for val in arr[1:]:
        curr.next = ListNode(val)
        curr = curr.next
    return head

def serialize_linked_list(head):
    res = []
    curr = head
    while curr:
        res.append(curr.val)
        curr = curr.next
    return res
`,
    DoublyListNode: `
class DoublyListNode:
    def __init__(self, val=0, prev=None, next=None):
        self.val = val
        self.prev = prev
        self.next = next

def deserialize_doubly_linked_list(arr):
    if not arr:
        return None
    nodes = [DoublyListNode(v) for v in arr]
    for i, node in enumerate(nodes):
        if i > 0:
            node.prev = nodes[i-1]
        if i < len(nodes)-1:
            node.next = nodes[i+1]
    return nodes[0] if nodes else None

def serialize_doubly_linked_list(head):
    res = []
    curr = head
    while curr:
        res.append(curr.val)
        curr = curr.next
    return res
`,
    TreeNode: `
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def deserialize_tree(arr):
    if not arr:
        return None
    nodes = [TreeNode(v) if v is not None else None for v in arr]
    kids = nodes[::-1]
    root = kids.pop()
    for node in nodes:
        if node:
            if kids: node.left = kids.pop()
            if kids: node.right = kids.pop()
    return root

def serialize_tree(root):
    if not root:
        return []
    from collections import deque
    q = deque([root])
    res = []
    while q:
        node = q.popleft()
        if node:
            res.append(node.val)
            q.append(node.left)
            q.append(node.right)
        else:
            res.append(None)
    while res and res[-1] is None:
        res.pop()
    return res
`,
    NaryTreeNode: `
class NaryTreeNode:
    def __init__(self, val=None, children=None):
        self.val = val
        self.children = children if children is not None else []

def deserialize_nary_tree(arr):
    if not arr:
        return None
    root = NaryTreeNode(arr[0])
    stack = [root]
    for val in arr[1:]:
        if val is None:
            stack.pop()
        else:
            node = NaryTreeNode(val)
            stack[-1].children.append(node)
            stack.append(node)
    return root

def serialize_nary_tree(root):
    if not root:
        return []
    from collections import deque
    res = [root.val]
    q = deque([root])
    while q:
        node = q.popleft()
        for child in node.children:
            res.append(child.val)
            q.append(child)
        res.append(None)
    while res and res[-1] is None:
        res.pop()
    return res
`,
    NestedInteger: `
class NestedInteger:
    def __init__(self, value=None):
        self.value = value
        self.list = []
    def isInteger(self):
        return self.value is not None
    def getInteger(self):
        return self.value
    def setInteger(self, value):
        self.value = value
    def add(self, ni):
        self.list.append(ni)
    def getList(self):
        return self.list

def deserialize_nested_integer(data):
    if isinstance(data, int):
        return NestedInteger(data)
    elif isinstance(data, list):
        ni = NestedInteger()
        for item in data:
            ni.add(deserialize_nested_integer(item))
        return ni

def serialize_nested_integer(ni):
    if ni.isInteger():
        return ni.getInteger()
    else:
        return [serialize_nested_integer(child) for child in ni.getList()]
`,
    DictHelper: `
def deserialize_dict(s):
    if not isinstance(s, str):
        return s
    import ast
    try:
        return ast.literal_eval(s)
    except:
        return eval(s)
`,
    ListHelper: `
def deserialize_list(s):
    if not isinstance(s, str):
        return s
    import ast
    try:
        return ast.literal_eval(s)
    except:
        return eval(s)
`,
    TupleHelper: `
def deserialize_tuple(s):
    if not isinstance(s, str):
        return s
    import ast
    try:
        return ast.literal_eval(s)
    except:
        return eval(s)
`,
    SetHelper: `
def deserialize_set(s):
    return s
`,
    RandomList: {
      funcs: `
def deserialize_random_list(arr):
    if not arr:
        return None
    nodes = [Node(pair[0]) for pair in arr]
    for i in range(len(nodes)-1):
        nodes[i].next = nodes[i+1]
    for i, pair in enumerate(arr):
        if pair[1] is not None:
            nodes[i].random = nodes[pair[1]]
    return nodes[0] if nodes else None

def serialize_random_list(head):
    if not head:
        return []
    index = {}
    cur = head
    idx = 0
    while cur:
        index[cur] = idx
        cur = cur.next
        idx += 1
    res = []
    cur = head
    while cur:
        random_index = index.get(cur.random) if cur.random else None
        res.append([cur.val, random_index])
        cur = cur.next
    return res
`,
    },
    Graph: {
      classDef: `
class Node:
    def __init__(self, val=0, neighbors=None):
        self.val = val
        self.neighbors = neighbors if neighbors is not None else []
`,
      funcs: `
def deserialize_graph(arr):
    if not arr:
        return None
    from collections import deque
    nodes = {}
    for i, neighbors in enumerate(arr):
        node_val = i+1
        if node_val not in nodes:
            nodes[node_val] = Node(node_val)
        for nb_val in neighbors:
            if nb_val not in nodes:
                nodes[nb_val] = Node(nb_val)
            nodes[node_val].neighbors.append(nodes[nb_val])
    return nodes[1] if nodes else None

def serialize_graph(node):
    if not node:
        return []
    from collections import deque
    visited = set()
    nodes = []
    q = deque([node])
    while q:
        cur = q.popleft()
        if cur.val in visited:
            continue
        visited.add(cur.val)
        nodes.append(cur)
        for nbr in cur.neighbors:
            if nbr.val not in visited:
                q.append(nbr)
    nodes.sort(key=lambda n: n.val)
    res = []
    for n in nodes:
        neighbor_vals = [nbr.val for nbr in n.neighbors]
        res.append(neighbor_vals)
    return res
`,
    },
  };

  // ----- Node variant detection -----
  const classDefined = (className) => {
    const regex = new RegExp(`class\\s+${className}\\s*:`);
    return regex.test(userCode);
  };

  let nodeType = null;
  if (neededDS.has("Node")) {
    const nodeClassMatch = userCode.match(
      /class\s+Node\s*:\s*([^]*?)(?=\n\S|$)/,
    );
    if (nodeClassMatch) {
      const classBody = nodeClassMatch[1];
      if (classBody.includes("self.random") || classBody.includes("random =")) {
        nodeType = "random";
      } else if (
        classBody.includes("self.neighbors") ||
        classBody.includes("neighbors =")
      ) {
        nodeType = "graph";
      } else {
        nodeType = "graph";
      }
    } else {
      nodeType = "graph";
    }
    neededDS.delete("Node");
    if (nodeType === "random") {
      neededDS.add("RandomList");
    } else if (nodeType === "graph") {
      neededDS.add("Graph");
    }
  }

  // ----- Primitive types list -----
  const isPrimitive = (type) => {
    const primitives = ["int", "str", "bool", "float", "Any", "None"];
    return primitives.includes(type) || type === "";
  };

  // ----- Deserialization call (always uses helpers for complex types) -----
  const deserializeCall = (typeHint, idx) => {
    if (!typeHint) return `values[${idx}]`;
    let innerType = typeHint;
    if (innerType.startsWith("Optional[")) {
      innerType = innerType.slice(9, -1);
    }
    if (innerType.includes("List[")) {
      return `deserialize_list(values[${idx}])`;
    }
    if (innerType.includes("Dict[")) {
      return `deserialize_dict(values[${idx}])`;
    }
    if (innerType.includes("Tuple[")) {
      return `deserialize_tuple(values[${idx}])`;
    }
    if (innerType.includes("Set[")) {
      return `deserialize_set(values[${idx}])`;
    }
    if (innerType.includes("ListNode"))
      return `deserialize_linked_list(values[${idx}])`;
    if (innerType.includes("DoublyListNode"))
      return `deserialize_doubly_linked_list(values[${idx}])`;
    if (innerType.includes("TreeNode"))
      return `deserialize_tree(values[${idx}])`;
    if (innerType.includes("NaryTreeNode"))
      return `deserialize_nary_tree(values[${idx}])`;
    if (innerType.includes("NestedInteger"))
      return `deserialize_nested_integer(values[${idx}])`;
    if (innerType.includes("Node")) {
      if (neededDS.has("RandomList")) {
        return `deserialize_random_list(values[${idx}])`;
      } else if (neededDS.has("Graph")) {
        return `deserialize_graph(values[${idx}])`;
      }
    }
    return `values[${idx}]`;
  };

  const deserializeCalls = params.map((_, i) =>
    deserializeCall(params[i].typeHint, i),
  );

  // ----- Serialization of result -----
  const serializeResult = (typeHint, resultVar) => {
    let innerType = typeHint;
    if (innerType.startsWith("Optional[")) innerType = innerType.slice(9, -1);
    if (innerType === "None" || innerType === "NoneType") {
      const firstParam = params[0];
      const firstType = firstParam?.typeHint || "";
      if (firstType.includes("ListNode"))
        return `json.dumps(serialize_linked_list(params[0]))`;
      if (firstType.includes("DoublyListNode"))
        return `json.dumps(serialize_doubly_linked_list(params[0]))`;
      if (firstType.includes("TreeNode"))
        return `json.dumps(serialize_tree(params[0]))`;
      if (firstType.includes("NaryTreeNode"))
        return `json.dumps(serialize_nary_tree(params[0]))`;
      if (firstType.includes("NestedInteger"))
        return `json.dumps(serialize_nested_integer(params[0]))`;
      if (firstType.includes("Node")) {
        if (neededDS.has("RandomList")) {
          return `json.dumps(serialize_random_list(params[0]))`;
        } else if (neededDS.has("Graph")) {
          return `json.dumps(serialize_graph(params[0]))`;
        }
      }
      return `json.dumps(params[0], default=str)`;
    }
    if (
      innerType.includes("List[") ||
      innerType.includes("Dict[") ||
      innerType.includes("Tuple[") ||
      innerType.includes("Set[")
    ) {
      return `json.dumps(${resultVar}, default=str)`;
    }
    if (innerType.includes("ListNode"))
      return `json.dumps(serialize_linked_list(${resultVar}))`;
    if (innerType.includes("DoublyListNode"))
      return `json.dumps(serialize_doubly_linked_list(${resultVar}))`;
    if (innerType.includes("TreeNode"))
      return `json.dumps(serialize_tree(${resultVar}))`;
    if (innerType.includes("NaryTreeNode"))
      return `json.dumps(serialize_nary_tree(${resultVar}))`;
    if (innerType.includes("NestedInteger"))
      return `json.dumps(serialize_nested_integer(${resultVar}))`;
    if (innerType.includes("Node")) {
      if (neededDS.has("RandomList")) {
        return `json.dumps(serialize_random_list(${resultVar}))`;
      } else if (neededDS.has("Graph")) {
        return `json.dumps(serialize_graph(${resultVar}))`;
      }
    }
    // Special handling for string return type: return the string directly (without JSON quotes)
    if (innerType === "str") {
      return resultVar;
    }
    // For any other primitive type (int, bool, etc.), use json.dumps to produce correct JSON literals
    return `json.dumps(${resultVar})`;
  };

  const serializedReturn = serializeResult(returnType, "result");

  // ----- Input parser (handles brackets, braces, parentheses) -----
  const parseInputFunction = `
import ast

def parse_input(s):
    # Split by commas not inside brackets, parentheses, braces, or quotes
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

  // ----- Solve function -----
  const solveFunction = `
def solve(input_str):
    values = parse_input(input_str)
    if len(values) < ${paramCount}:
        return ""
    params = [${deserializeCalls.join(", ")}]
    sol = Solution()
    result = sol.${methodName}(*params)
    return ${serializedReturn}
`;

  // ----- Common imports -----
  const defaultImports = `
import json
import sys
import ast
import bisect
import collections
import heapq
import math
import itertools
from typing import List, Optional, Dict, Tuple, Set, Any
from collections import deque
`;

  // ----- Build final script -----
  let usedHelpers = "";
  for (const ds of neededDS) {
    if (ds === "RandomList") {
      usedHelpers += helpers.RandomList.funcs + "\n";
    } else if (ds === "Graph") {
      const helper = helpers.Graph;
      if (!classDefined("Node")) {
        usedHelpers += helper.classDef + "\n";
      }
      usedHelpers += helper.funcs + "\n";
    } else {
      const helper = helpers[ds];
      if (typeof helper === "string") {
        usedHelpers += helper + "\n";
      } else if (typeof helper === "object" && helper.funcs) {
        usedHelpers += helper.funcs + "\n";
      }
    }
  }

  const fullScript = `${defaultImports}
${usedHelpers}
${parseInputFunction}

${userCode}

${solveFunction}
`;
  return fullScript;
}

// ========== cpp Wrapper Generation ==========
function generateCppWrapper(userCode, starterCode) {
  // ----------------------------- Helper: extract method signature from a C++ class -----------------------------
  const extractSignature = (code) => {
    // Find class Solution start
    const classStart = code.match(/class\s+Solution\s*\{/);
    if (!classStart) return null;
    const startIdx = classStart.index;
    let braceCount = 1;
    let i = startIdx + classStart[0].length;
    // Find matching closing brace for the class
    while (i < code.length && braceCount > 0) {
      if (code[i] === "{") braceCount++;
      else if (code[i] === "}") braceCount--;
      i++;
    }
    if (braceCount !== 0) return null;
    const classBody = code.substring(startIdx, i);
    // Find public section
    const publicIdx = classBody.indexOf("public:");
    if (publicIdx === -1) return null;
    // Search for method signature after 'public:'
    const afterPublic = classBody.substring(publicIdx + 7);
    // Match method signature (returnType, methodName, parameters) across lines
    const methodMatch = afterPublic.match(
      /^\s*(\S+(?:\s+\S+)*?)\s+(\w+)\s*\(([\s\S]*?)\)\s*\{/,
    );
    if (!methodMatch) return null;
    let returnType = methodMatch[1].trim();
    const methodName = methodMatch[2];
    const paramStr = methodMatch[3];
    // Parse parameter types (ignore parameter names)
    const paramTypes = [];
    let depth = 0,
      start = 0;
    for (let j = 0; j <= paramStr.length; j++) {
      const ch = paramStr[j];
      if (ch === "<") depth++;
      else if (ch === ">") depth--;
      else if ((ch === "," && depth === 0) || j === paramStr.length) {
        let param = paramStr.substring(start, j).trim();
        if (param) {
          // Remove parameter name (keep only type)
          const lastSpace = param.lastIndexOf(" ");
          if (lastSpace !== -1) param = param.substring(0, lastSpace);
          param = param
            .replace(/const\s+/g, "")
            .replace(/&/g, "")
            .trim();
          paramTypes.push(param);
        }
        start = j + 1;
      }
    }
    returnType = returnType
      .replace(/const\s+/g, "")
      .replace(/&/g, "")
      .trim();
    return { methodName, returnType, paramTypes };
  };

  let signature = extractSignature(userCode);
  if (!signature && starterCode) signature = extractSignature(starterCode);
  const isInteractive = !signature;

  // ----------------------------- Determine needed data structures -----------------------------
  const neededDS = new Set();
  const addType = (type) => {
    if (!type) return;
    if (type.includes("ListNode")) neededDS.add("ListNode");
    else if (type.includes("TreeNode")) neededDS.add("TreeNode");
    else if (type.includes("NestedInteger")) neededDS.add("NestedInteger");
    else if (type === "Node" || type === "Node*" || type === "Node&")
      neededDS.add("Node");
    if (type.includes("vector<int>")) neededDS.add("VectorInt");
    if (type.includes("vector<vector<int>>")) neededDS.add("VectorVectorInt");
    if (type.includes("vector<string>")) neededDS.add("VectorString");
    // string and bool are primitive, no helpers needed
  };
  if (!isInteractive) {
    signature.paramTypes.forEach(addType);
    addType(signature.returnType);
  }

  const hasStruct = (name) =>
    new RegExp(`struct\\s+${name}\\s*\\{`).test(userCode);

  // ----------------------------- Generate data structures (if missing) -----------------------------
  let dataStructs = "";
  if (neededDS.has("ListNode")) {
    dataStructs += `
#ifndef LISTNODE_DEFINED
#define LISTNODE_DEFINED
struct ListNode {
    int val;
    ListNode *next;
    ListNode() : val(0), next(nullptr) {}
    ListNode(int x) : val(x), next(nullptr) {}
    ListNode(int x, ListNode *next) : val(x), next(next) {}
};
#endif
`;
  }
  if (neededDS.has("TreeNode")) {
    dataStructs += `
#ifndef TREENODE_DEFINED
#define TREENODE_DEFINED
struct TreeNode {
    int val;
    TreeNode *left;
    TreeNode *right;
    TreeNode() : val(0), left(nullptr), right(nullptr) {}
    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
    TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
};
#endif
`;
  }
  if (neededDS.has("NestedInteger")) {
    dataStructs += `
#ifndef NESTEDINTEGER_DEFINED
#define NESTEDINTEGER_DEFINED
class NestedInteger {
private:
    int value;
    vector<NestedInteger> list;
    bool isInt;
public:
    NestedInteger() : isInt(false) {}
    NestedInteger(int val) : value(val), isInt(true) {}
    bool isInteger() const { return isInt; }
    int getInteger() const { return value; }
    void setInteger(int val) { value = val; isInt = true; list.clear(); }
    void add(const NestedInteger& ni) { list.push_back(ni); }
    const vector<NestedInteger>& getList() const { return list; }
};
#endif
`;
  }
  if (neededDS.has("Node")) {
    dataStructs += `
#ifndef NODE_DEFINED
#define NODE_DEFINED
class Node {
public:
    int val;
    vector<Node*> neighbors;
    Node() : val(0) {}
    Node(int _val) : val(_val) {}
    Node(int _val, vector<Node*> _neighbors) : val(_val), neighbors(_neighbors) {}
};
#endif
`;
  }

  // ----------------------------- Safe JSON parser (no delete on shared_ptr) -----------------------------
  const jsonParser = `
#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <unordered_map>
#include <set>
#include <algorithm>
#include <sstream>
#include <cctype>
#include <memory>
#include <queue>
#include <stack>

using namespace std;

// -------------------------------------------------------------------
// Safe JSON value type using shared_ptr for heap data
// -------------------------------------------------------------------
struct JsonValue {
    enum Type { JSON_NULL, JSON_BOOL, JSON_NUMBER, JSON_STRING, JSON_ARRAY, JSON_OBJECT };
    Type type;
    union {
        bool bool_val;
        double number_val;
    };
    shared_ptr<string> string_val;
    shared_ptr<vector<JsonValue>> array_val;
    shared_ptr<map<string, JsonValue>> object_val;

    JsonValue() : type(JSON_NULL), bool_val(false) {}
    JsonValue(bool b) : type(JSON_BOOL), bool_val(b) {}
    JsonValue(double n) : type(JSON_NUMBER), number_val(n) {}
    JsonValue(const string& s) : type(JSON_STRING), string_val(make_shared<string>(s)) {}
    JsonValue(const vector<JsonValue>& arr) : type(JSON_ARRAY), array_val(make_shared<vector<JsonValue>>(arr)) {}
    JsonValue(const map<string, JsonValue>& obj) : type(JSON_OBJECT), object_val(make_shared<map<string, JsonValue>>(obj)) {}

    JsonValue(const JsonValue& other) : type(other.type) {
        switch (type) {
            case JSON_NULL: break;
            case JSON_BOOL: bool_val = other.bool_val; break;
            case JSON_NUMBER: number_val = other.number_val; break;
            case JSON_STRING: string_val = other.string_val; break;
            case JSON_ARRAY: array_val = other.array_val; break;
            case JSON_OBJECT: object_val = other.object_val; break;
        }
    }

    JsonValue(JsonValue&& other) noexcept : type(other.type) {
        switch (type) {
            case JSON_NULL: break;
            case JSON_BOOL: bool_val = other.bool_val; break;
            case JSON_NUMBER: number_val = other.number_val; break;
            case JSON_STRING: string_val = move(other.string_val); break;
            case JSON_ARRAY: array_val = move(other.array_val); break;
            case JSON_OBJECT: object_val = move(other.object_val); break;
        }
        other.type = JSON_NULL;
    }

    JsonValue& operator=(JsonValue other) {
        swap(*this, other);
        return *this;
    }

    friend void swap(JsonValue& a, JsonValue& b) noexcept {
        using std::swap;
        swap(a.type, b.type);
        swap(a.bool_val, b.bool_val);
        swap(a.number_val, b.number_val);
        swap(a.string_val, b.string_val);
        swap(a.array_val, b.array_val);
        swap(a.object_val, b.object_val);
    }

    bool isNull() const { return type == JSON_NULL; }
    bool isBool() const { return type == JSON_BOOL; }
    bool isNumber() const { return type == JSON_NUMBER; }
    bool isString() const { return type == JSON_STRING; }
    bool isArray() const { return type == JSON_ARRAY; }
    bool isObject() const { return type == JSON_OBJECT; }

    bool asBool() const { return bool_val; }
    double asNumber() const { return number_val; }
    string asString() const { return *string_val; }
    vector<JsonValue> asArray() const { return *array_val; }
    map<string, JsonValue> asObject() const { return *object_val; }
};

// -------------------------------------------------------------------
// Recursive‑descent JSON parser
// -------------------------------------------------------------------
class JsonParser {
    string json;
    size_t pos;
public:
    JsonParser(const string& s) : json(s), pos(0) {}

    JsonValue parse() {
        skipWhitespace();
        return parseValue();
    }

private:
    void skipWhitespace() {
        while (pos < json.size() && isspace(json[pos])) ++pos;
    }

    JsonValue parseValue() {
        skipWhitespace();
        if (pos >= json.size()) throw runtime_error("Unexpected EOF");
        char c = json[pos];
        if (c == '{') return parseObject();
        if (c == '[') return parseArray();
        if (c == '"') return parseString();
        if (c == 't' || c == 'f') return parseBool();
        if (c == 'n') return parseNull();
        return parseNumber();
    }

    JsonValue parseObject() {
        map<string, JsonValue> obj;
        ++pos; // skip '{'
        skipWhitespace();
        if (json[pos] == '}') { ++pos; return obj; }
        while (true) {
            skipWhitespace();
            string key = parseString().asString();
            skipWhitespace();
            if (json[pos] != ':') throw runtime_error("Expected ':'");
            ++pos;
            JsonValue val = parseValue();
            obj[key] = val;
            skipWhitespace();
            if (json[pos] == '}') { ++pos; break; }
            if (json[pos] != ',') throw runtime_error("Expected ',' or '}'");
            ++pos;
        }
        return obj;
    }

    JsonValue parseArray() {
        vector<JsonValue> arr;
        ++pos; // skip '['
        skipWhitespace();
        if (json[pos] == ']') { ++pos; return arr; }
        while (true) {
            arr.push_back(parseValue());
            skipWhitespace();
            if (json[pos] == ']') { ++pos; break; }
            if (json[pos] != ',') throw runtime_error("Expected ',' or ']'");
            ++pos;
        }
        return arr;
    }

    JsonValue parseString() {
        ++pos; // skip opening '"'
        string str;
        while (pos < json.size() && json[pos] != '"') {
            if (json[pos] == '\\\\') {
                ++pos;
                if (pos >= json.size()) throw runtime_error("Unterminated escape");
                switch (json[pos]) {
                    case '"': str += '"'; break;
                    case '\\\\': str += '\\\\'; break;
                    case '/': str += '/'; break;
                    case 'b': str += '\\b'; break;
                    case 'f': str += '\\f'; break;
                    case 'n': str += '\\n'; break;
                    case 'r': str += '\\r'; break;
                    case 't': str += '\\t'; break;
                    default: str += json[pos];
                }
            } else {
                str += json[pos];
            }
            ++pos;
        }
        if (pos >= json.size() || json[pos] != '"') throw runtime_error("Unterminated string");
        ++pos;
        return JsonValue(str);
    }

    JsonValue parseBool() {
        if (json.compare(pos, 4, "true") == 0) {
            pos += 4;
            return JsonValue(true);
        } else if (json.compare(pos, 5, "false") == 0) {
            pos += 5;
            return JsonValue(false);
        }
        throw runtime_error("Invalid boolean");
    }

    JsonValue parseNull() {
        if (json.compare(pos, 4, "null") == 0) {
            pos += 4;
            return JsonValue();
        }
        throw runtime_error("Invalid null");
    }

    JsonValue parseNumber() {
        size_t start = pos;
        while (pos < json.size() && (isdigit(json[pos]) || json[pos] == '.' || json[pos] == '-' || json[pos] == 'e' || json[pos] == 'E'))
            ++pos;
        string numStr = json.substr(start, pos - start);
        char* end;
        double num = strtod(numStr.c_str(), &end);
        if (end == numStr.c_str()) throw runtime_error("Invalid number");
        return JsonValue(num);
    }
};
`;

  // ----------------------------- Serialization/deserialization helpers -----------------------------
  let helpers = "";

  // Vector<int>
  if (neededDS.has("VectorInt")) {
    helpers += `
vector<int> deserializeIntVector(const JsonValue& val) {
    vector<int> res;
    if (!val.isArray()) return res;
    for (const auto& elem : val.asArray()) {
        res.push_back((int)elem.asNumber());
    }
    return res;
}

JsonValue serializeIntVector(const vector<int>& vec) {
    vector<JsonValue> res;
    for (int v : vec) res.push_back(JsonValue((double)v));
    return JsonValue(res);
}
`;
  }

  // vector<vector<int>>
  if (neededDS.has("VectorVectorInt")) {
    helpers += `
vector<vector<int>> deserializeIntVectorVector(const JsonValue& val) {
    vector<vector<int>> res;
    if (!val.isArray()) return res;
    for (const auto& row : val.asArray()) {
        res.push_back(deserializeIntVector(row));
    }
    return res;
}

JsonValue serializeIntVectorVector(const vector<vector<int>>& vec) {
    vector<JsonValue> res;
    for (const auto& row : vec) {
        res.push_back(serializeIntVector(row));
    }
    return JsonValue(res);
}
`;
  }

  // vector<string>
  if (neededDS.has("VectorString")) {
    helpers += `
vector<string> deserializeStringVector(const JsonValue& val) {
    vector<string> res;
    if (!val.isArray()) return res;
    for (const auto& elem : val.asArray()) {
        if (elem.isString()) res.push_back(elem.asString());
        else res.push_back("");
    }
    return res;
}

JsonValue serializeStringVector(const vector<string>& vec) {
    vector<JsonValue> res;
    for (const string& s : vec) res.push_back(JsonValue(s));
    return JsonValue(res);
}
`;
  }

  // ListNode
  if (neededDS.has("ListNode")) {
    helpers += `
ListNode* deserializeListNode(const JsonValue& val) {
    if (!val.isArray()) return nullptr;
    auto arr = val.asArray();
    ListNode dummy(0);
    ListNode* cur = &dummy;
    for (const auto& elem : arr) {
        cur->next = new ListNode((int)elem.asNumber());
        cur = cur->next;
    }
    return dummy.next;
}

JsonValue serializeListNode(ListNode* head) {
    vector<JsonValue> res;
    while (head) {
        res.push_back(JsonValue((double)head->val));
        head = head->next;
    }
    return JsonValue(res);
}
`;
  }

  // TreeNode (level‑order with nulls)
  if (neededDS.has("TreeNode")) {
    helpers += `
TreeNode* deserializeTreeNode(const JsonValue& val) {
    if (!val.isArray()) return nullptr;
    auto arr = val.asArray();
    if (arr.empty()) return nullptr;
    vector<TreeNode*> nodes;
    for (const auto& elem : arr) {
        if (elem.isNull()) nodes.push_back(nullptr);
        else nodes.push_back(new TreeNode((int)elem.asNumber()));
    }
    int i = 0, j = 1;
    while (j < nodes.size()) {
        if (nodes[i]) {
            nodes[i]->left = nodes[j++];
            if (j < nodes.size()) nodes[i]->right = nodes[j++];
        }
        i++;
    }
    return nodes[0];
}

JsonValue serializeTreeNode(TreeNode* root) {
    vector<JsonValue> res;
    queue<TreeNode*> q;
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
`;
  }

  // NestedInteger
  if (neededDS.has("NestedInteger")) {
    helpers += `
NestedInteger deserializeNestedInteger(const JsonValue& val) {
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

JsonValue serializeNestedInteger(const NestedInteger& ni) {
    if (ni.isInteger()) {
        return JsonValue((double)ni.getInteger());
    } else {
        vector<JsonValue> arr;
        for (const auto& child : ni.getList()) {
            arr.push_back(serializeNestedInteger(child));
        }
        return JsonValue(arr);
    }
}
`;
  }

  // Node (graph with neighbors)
  if (neededDS.has("Node")) {
    helpers += `
Node* deserializeGraphNode(const JsonValue& val) {
    if (!val.isArray()) return nullptr;
    auto adj = val.asArray();
    if (adj.empty()) return nullptr;
    map<int, Node*> nodes;
    for (size_t i = 0; i < adj.size(); ++i) {
        int nodeVal = i + 1;
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

JsonValue serializeGraphNode(Node* node) {
    if (!node) return JsonValue();
    map<Node*, int> idx;
    vector<Node*> order;
    queue<Node*> q;
    q.push(node);
    while (!q.empty()) {
        Node* cur = q.front(); q.pop();
        if (idx.count(cur)) continue;
        idx[cur] = order.size();
        order.push_back(cur);
        for (Node* nb : cur->neighbors) q.push(nb);
    }
    sort(order.begin(), order.end(), [](Node* a, Node* b) { return a->val < b->val; });
    vector<vector<int>> res;
    for (Node* n : order) {
        vector<int> nbVals;
        for (Node* nb : n->neighbors) nbVals.push_back(idx[nb] + 1);
        res.push_back(nbVals);
    }
    return serializeIntVectorVector(res);
}
`;
  }

  // ----------------------------- JSON stringification helpers -----------------------------
  const jsonToStringHelpers = `
string escapeJson(const string& s) {
    string out;
    for (char c : s) {
        switch (c) {
            case '"': out += "\\\\\\""; break;
            case '\\\\': out += "\\\\\\\\"; break;
            case '\\b': out += "\\\\b"; break;
            case '\\f': out += "\\\\f"; break;
            case '\\n': out += "\\\\n"; break;
            case '\\r': out += "\\\\r"; break;
            case '\\t': out += "\\\\t"; break;
            default: out += c; break;
        }
    }
    return out;
}

string jsonToString(const JsonValue& val) {
    if (val.isNull()) return "null";
    if (val.isBool()) return val.asBool() ? "true" : "false";
    if (val.isNumber()) {
        double num = val.asNumber();
        if (num == floor(num)) return to_string((long long)num);
        else return to_string(num);
    }
    if (val.isString()) return "\\"" + escapeJson(val.asString()) + "\\"";
    if (val.isArray()) {
        string res = "[";
        const auto& arr = val.asArray();
        for (size_t i = 0; i < arr.size(); ++i) {
            if (i > 0) res += ",";
            res += jsonToString(arr[i]);
        }
        res += "]";
        return res;
    }
    if (val.isObject()) {
        string res = "{";
        bool first = true;
        for (const auto& pair : val.asObject()) {
            if (!first) res += ",";
            first = false;
            res += "\\"" + escapeJson(pair.first) + "\\":" + jsonToString(pair.second);
        }
        res += "}";
        return res;
    }
    return "null";
}
`;

  // ----------------------------- Generate main() function -----------------------------
  let mainCode = "";
  if (!isInteractive) {
    const { methodName, returnType, paramTypes } = signature;
    const deserializeCalls = paramTypes
      .map((type, idx) => {
        if (type === "int") return `(int)argsArray[${idx}].asNumber()`;
        if (type === "double") return `argsArray[${idx}].asNumber()`;
        if (type === "string") return `argsArray[${idx}].asString()`;
        if (type === "bool") return `argsArray[${idx}].asBool()`;
        if (type === "vector<int>")
          return `deserializeIntVector(argsArray[${idx}])`;
        if (type === "vector<vector<int>>")
          return `deserializeIntVectorVector(argsArray[${idx}])`;
        if (type === "vector<string>")
          return `deserializeStringVector(argsArray[${idx}])`;
        if (type === "ListNode*")
          return `deserializeListNode(argsArray[${idx}])`;
        if (type === "TreeNode*")
          return `deserializeTreeNode(argsArray[${idx}])`;
        if (type === "NestedInteger")
          return `deserializeNestedInteger(argsArray[${idx}])`;
        if (type === "Node*") return `deserializeGraphNode(argsArray[${idx}])`;
        return `argsArray[${idx}]`;
      })
      .join(", ");

    // ---------- FIX: Separate method call line for void vs non-void ----------
    let methodCallLine;
    if (returnType === "void") {
      methodCallLine = `sol.${methodName}(${paramTypes.map((_, i) => `arg${i}`).join(", ")});`;
    } else {
      methodCallLine = `auto result = sol.${methodName}(${paramTypes.map((_, i) => `arg${i}`).join(", ")});`;
    }

    let serializeResult = "";
    if (returnType === "void") {
      const firstType = paramTypes[0] || "int";
      if (firstType === "ListNode*")
        serializeResult = "cout << jsonToString(serializeListNode(arg0));";
      else if (firstType === "TreeNode*")
        serializeResult = "cout << jsonToString(serializeTreeNode(arg0));";
      else if (firstType === "vector<int>")
        serializeResult = "cout << jsonToString(serializeIntVector(arg0));";
      else if (firstType === "vector<vector<int>>")
        serializeResult =
          "cout << jsonToString(serializeIntVectorVector(arg0));";
      else if (firstType === "vector<string>")
        serializeResult = "cout << jsonToString(serializeStringVector(arg0));";
      else if (firstType === "NestedInteger")
        serializeResult = "cout << jsonToString(serializeNestedInteger(arg0));";
      else if (firstType === "Node*")
        serializeResult = "cout << jsonToString(serializeGraphNode(arg0));";
      else serializeResult = "cout << arg0;";
    } else if (
      returnType === "int" ||
      returnType === "double" ||
      returnType === "bool"
    ) {
      serializeResult = "cout << result;";
    } else if (returnType === "string") {
      serializeResult = 'cout << "\\"" << result << "\\"";';
    } else if (returnType === "vector<int>") {
      serializeResult = "cout << jsonToString(serializeIntVector(result));";
    } else if (returnType === "vector<vector<int>>") {
      serializeResult =
        "cout << jsonToString(serializeIntVectorVector(result));";
    } else if (returnType === "vector<string>") {
      serializeResult = "cout << jsonToString(serializeStringVector(result));";
    } else if (returnType === "ListNode*") {
      serializeResult = "cout << jsonToString(serializeListNode(result));";
    } else if (returnType === "TreeNode*") {
      serializeResult = "cout << jsonToString(serializeTreeNode(result));";
    } else if (returnType === "NestedInteger") {
      serializeResult = "cout << jsonToString(serializeNestedInteger(result));";
    } else if (returnType === "Node*") {
      serializeResult = "cout << jsonToString(serializeGraphNode(result));";
    } else {
      serializeResult = "cout << result;";
    }

    // ----- FIX: Add helper to parse legacy value from a string -----
    const legacyValueParser = `
JsonValue parseLegacyValue(const string& input) {
    size_t eqPos = input.find('=');
    if (eqPos == string::npos) {
        throw runtime_error("Legacy input missing '='");
    }
    string valueStr = input.substr(eqPos + 1);
    size_t start = valueStr.find_first_not_of(" \\t");
    if (start == string::npos) throw runtime_error("Empty value after '='");
    size_t end = valueStr.find_last_not_of(" \\t");
    valueStr = valueStr.substr(start, end - start + 1);
    JsonParser parser(valueStr);
    return parser.parse();
}
`;

    mainCode = `
// Legacy input parser (kept for compatibility, but input is now JSON)
JsonValue parseLegacyInput(const string& input) {
    size_t eqPos = input.find('=');
    if (eqPos == string::npos) {
        throw runtime_error("Legacy input missing '='");
    }
    string valueStr = input.substr(eqPos + 1);
    size_t start = valueStr.find_first_not_of(" \\t");
    if (start == string::npos) throw runtime_error("Empty value after '='");
    size_t end = valueStr.find_last_not_of(" \\t");
    valueStr = valueStr.substr(start, end - start + 1);
    JsonParser parser(valueStr);
    JsonValue parsed = parser.parse();
    map<string, JsonValue> obj;
    vector<JsonValue> args;
    args.push_back(parsed);
    obj["args"] = JsonValue(args);
    return JsonValue(obj);
}

${legacyValueParser}

int main() {
    string input;
    getline(cin, input);
    JsonValue root;
    size_t firstNonSpace = input.find_first_not_of(" \\t");
    if (firstNonSpace != string::npos && input[firstNonSpace] == '{') {
        JsonParser parser(input);
        root = parser.parse();
    } else {
        root = parseLegacyInput(input);
    }
    if (!root.isObject()) { cerr << "Invalid input" << endl; return 1; }
    auto obj = root.asObject();
    if (obj.find("args") == obj.end()) { cerr << "Missing 'args'" << endl; return 1; }
    vector<JsonValue> argsArray = obj.at("args").asArray();
    // Convert any string argument that looks like legacy input into its JSON value
    for (auto& arg : argsArray) {
        if (arg.isString()) {
            string s = arg.asString();
            if (s.find('=') != string::npos) {
                arg = parseLegacyValue(s);
            }
        }
    }
    if (argsArray.size() != ${paramTypes.length}) { cerr << "Argument count mismatch" << endl; return 1; }
    ${paramTypes.map((t, i) => `auto arg${i} = ${deserializeCalls.split(", ")[i]};`).join("\n    ")}
    Solution sol;
    ${methodCallLine}
    ${serializeResult}
    return 0;
}
`;
  } else {
    const classNameMatch = userCode.match(/class\s+(\w+)\s*\{/);
    const className = classNameMatch ? classNameMatch[1] : "UserClass";
    const methodMatches = [
      ...userCode.matchAll(/public:\s*(?:\w+\s+)?(\w+)\s*\([^)]*\)\s*\{/g),
    ];
    const methodNames = methodMatches
      .map((m) => m[1])
      .filter((v, i, a) => a.indexOf(v) === i);

    // Build dispatch chain for known methods
    let dispatch = "";
    for (const mname of methodNames) {
      dispatch += `
    if (method == "${mname}") {
        if (args.size() == 0) {
            result = obj->${mname}();
        } else if (args.size() == 1 && args[0].isNumber()) {
            result = obj->${mname}((int)args[0].asNumber());
        } else if (args.size() == 1 && args[0].isString()) {
            result = obj->${mname}(args[0].asString());
        } else if (args.size() == 2 && args[0].isNumber() && args[1].isNumber()) {
            result = obj->${mname}((int)args[0].asNumber(), (int)args[1].asNumber());
        } else if (args.size() == 2 && args[0].isString() && args[1].isString()) {
            result = obj->${mname}(args[0].asString(), args[1].asString());
        } else {
            result = JsonValue();
        }
    } else `;
    }
    dispatch += ` {
    result = JsonValue();
}`;

    mainCode = `
int main() {
    string input;
    getline(cin, input);
    JsonParser parser(input);
    JsonValue root = parser.parse();

    // If the input is wrapped in {"args": ...}, unwrap it
    if (root.isObject()) {
        auto objMap = root.asObject();
        if (objMap.find("args") != objMap.end()) {
            root = objMap.at("args");
        }
    }

    vector<JsonValue> ctorArgs;
    vector<JsonValue> methodsList;
    string detectedClassName = "${className}";

    if (root.isArray()) {
        auto arr = root.asArray();
        if (arr.size() == 2 && arr[0].isArray() && arr[1].isArray()) {
            // LeetCode format: [method_names, arguments_array]
            auto methodNamesArr = arr[0].asArray();
            auto argsArr = arr[1].asArray();

            if (methodNamesArr.empty()) {
                cerr << "No method names provided" << endl;
                return 1;
            }

            // First method name is the class name (constructor)
            detectedClassName = methodNamesArr[0].asString();

            // Constructor arguments: first element of argsArr
            if (!argsArr.empty() && argsArr[0].isArray()) {
                ctorArgs = argsArr[0].asArray();
            } else {
                ctorArgs = {};
            }

            // Build methods list: each call is an array [methodName, arg1, arg2, ...]
            for (size_t i = 1; i < methodNamesArr.size(); ++i) {
                vector<JsonValue> call;
                call.push_back(methodNamesArr[i]);
                if (i < argsArr.size() && argsArr[i].isArray()) {
                    auto methodArgs = argsArr[i].asArray();
                    for (const auto& arg : methodArgs) {
                        call.push_back(arg);
                    }
                }
                methodsList.push_back(JsonValue(call));
            }
        } else {
            cerr << "Invalid input array format: expected 2 elements, both arrays" << endl;
            return 1;
        }
    } else {
        cerr << "Invalid input: expected array or object with 'args' key" << endl;
        return 1;
    }

    // ----- Instantiate the class -----
    ${className}* obj = nullptr;
    if (ctorArgs.empty()) {
        obj = new ${className}();
    } else if (ctorArgs.size() == 1 && ctorArgs[0].isNumber()) {
        obj = new ${className}((int)ctorArgs[0].asNumber());
    } else if (ctorArgs.size() == 1 && ctorArgs[0].isString()) {
        obj = new ${className}(ctorArgs[0].asString());
    } else if (ctorArgs.size() == 2 && ctorArgs[0].isNumber() && ctorArgs[1].isNumber()) {
        obj = new ${className}((int)ctorArgs[0].asNumber(), (int)ctorArgs[1].asNumber());
    } else if (ctorArgs.size() == 2 && ctorArgs[0].isString() && ctorArgs[1].isString()) {
        obj = new ${className}(ctorArgs[0].asString(), ctorArgs[1].asString());
    } else {
        cerr << "Unsupported constructor signature" << endl;
        return 1;
    }

    // ----- Execute methods -----
    vector<JsonValue> results;
    results.push_back(JsonValue()); // constructor placeholder

    for (const auto& call : methodsList) {
        if (!call.isArray()) { results.push_back(JsonValue()); continue; }
        auto arr = call.asArray();
        if (arr.empty()) { results.push_back(JsonValue()); continue; }
        string method = arr[0].asString();
        vector<JsonValue> args(arr.begin() + 1, arr.end());
        JsonValue result;
        ${dispatch}
        results.push_back(result);
    }

    cout << jsonToString(JsonValue(results));
    delete obj;
    return 0;
}
`;
  }

  // ----------------------------- Assemble final C++ code -----------------------------
  return `#include <bits/stdc++.h>
using namespace std;

${jsonParser}
${dataStructs}
${helpers}
${jsonToStringHelpers}

// ---------- User's code ----------
${userCode}
// ---------------------------------

${mainCode}
`;
}

// ========== Java Wrapper Generation ==========

// ========== Generate top‑level data structure classes ==========
function generateJavaDataStructures(neededHelpers, userCode) {
  let classes = "";

  if (neededHelpers.has("ListNode") || neededHelpers.has("Node")) {
    classes += `
class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}
`;
  }

  if (neededHelpers.has("DoublyListNode")) {
    classes += `
class DoublyListNode {
    int val;
    DoublyListNode prev;
    DoublyListNode next;
    DoublyListNode() {}
    DoublyListNode(int val) { this.val = val; }
    DoublyListNode(int val, DoublyListNode prev, DoublyListNode next) { this.val = val; this.prev = prev; this.next = next; }
}
`;
  }

  if (neededHelpers.has("TreeNode")) {
    classes += `
class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }
}
`;
  }

  if (neededHelpers.has("NaryTreeNode")) {
    classes += `
class NaryTreeNode {
    int val;
    List<NaryTreeNode> children;
    NaryTreeNode() { children = new ArrayList<>(); }
    NaryTreeNode(int val) { this.val = val; children = new ArrayList<>(); }
    NaryTreeNode(int val, List<NaryTreeNode> children) { this.val = val; this.children = children; }
}
`;
  }

  if (neededHelpers.has("NestedInteger")) {
    classes += `
class NestedInteger {
    private Integer value;
    private List<NestedInteger> list;

    public NestedInteger() {
        this.list = new ArrayList<>();
    }

    public NestedInteger(int value) {
        this.value = value;
        this.list = null;
    }

    public boolean isInteger() {
        return value != null;
    }

    public Integer getInteger() {
        return value;
    }

    public void setInteger(int value) {
        this.value = value;
        this.list = null;
    }

    public void add(NestedInteger ni) {
        if (list == null) {
            list = new ArrayList<>();
        }
        list.add(ni);
    }

    public List<NestedInteger> getList() {
        if (list == null) {
            return new ArrayList<>();
        }
        return list;
    }

    @Override
    public String toString() {
        if (isInteger()) {
            return String.valueOf(value);
        } else {
            StringBuilder sb = new StringBuilder("[");
            List<NestedInteger> lst = getList();
            for (int i = 0; i < lst.size(); i++) {
                if (i > 0) sb.append(",");
                sb.append(lst.get(i).toString());
            }
            sb.append("]");
            return sb.toString();
        }
    }
}
`;
  }

  // Graph Node (neighbors)
  if (neededHelpers.has("GraphNode")) {
    classes += `
class Node {
    int val;
    List<Node> neighbors;
    Node() { neighbors = new ArrayList<>(); }
    Node(int val) { this.val = val; neighbors = new ArrayList<>(); }
    Node(int val, List<Node> neighbors) { this.val = val; this.neighbors = neighbors; }
}
`;
  }

  // Random List Node (provided by user, but we generate if missing)
  if (neededHelpers.has("Node") && !/class\s+Node\s*\{/.test(userCode)) {
    classes += `
class Node {
    int val;
    Node next;
    Node random;

    public Node(int val) {
        this.val = val;
        this.next = null;
        this.random = null;
    }
}
`;
  }

  return classes;
}

// ========== Generate static helper methods (to be placed inside Main) ==========
function generateJavaHelpers(neededHelpers) {
  let helpers = "";

  // ListNode helpers
  if (neededHelpers.has("ListNode") || neededHelpers.has("Node")) {
    helpers += `
    public static ListNode deserializeListNode(Object obj) {
        if (obj == null) return null;
        List<?> list = (List<?>) obj;
        ListNode dummy = new ListNode(0);
        ListNode cur = dummy;
        for (Object val : list) {
            cur.next = new ListNode(((Number) val).intValue());
            cur = cur.next;
        }
        return dummy.next;
    }
    
    public static Object serializeListNode(ListNode head) {
        List<Integer> list = new ArrayList<>();
        while (head != null) {
            list.add(head.val);
            head = head.next;
        }
        return list;
    }
`;
  }

  // DoublyListNode helpers
  if (neededHelpers.has("DoublyListNode")) {
    helpers += `
    public static DoublyListNode deserializeDoublyListNode(Object obj) {
        if (obj == null) return null;
        List<?> list = (List<?>) obj;
        if (list.isEmpty()) return null;
        DoublyListNode[] nodes = new DoublyListNode[list.size()];
        for (int i = 0; i < list.size(); i++) {
            nodes[i] = new DoublyListNode(((Number) list.get(i)).intValue());
        }
        for (int i = 0; i < nodes.length; i++) {
            if (i > 0) nodes[i].prev = nodes[i-1];
            if (i < nodes.length-1) nodes[i].next = nodes[i+1];
        }
        return nodes[0];
    }
    
    public static Object serializeDoublyListNode(DoublyListNode head) {
        List<Integer> list = new ArrayList<>();
        while (head != null) {
            list.add(head.val);
            head = head.next;
        }
        return list;
    }
`;
  }

  // TreeNode helpers
  if (neededHelpers.has("TreeNode")) {
    helpers += `
    public static TreeNode deserializeTreeNode(Object obj) {
        if (obj == null) return null;
        List<?> list = (List<?>) obj;
        if (list.isEmpty()) return null;
        TreeNode root = new TreeNode(((Number) list.get(0)).intValue());
        Queue<TreeNode> queue = new LinkedList<>();
        queue.offer(root);
        int i = 1;
        while (!queue.isEmpty() && i < list.size()) {
            TreeNode node = queue.poll();
            Object leftVal = list.get(i++);
            if (leftVal != null) {
                node.left = new TreeNode(((Number) leftVal).intValue());
                queue.offer(node.left);
            }
            if (i < list.size()) {
                Object rightVal = list.get(i++);
                if (rightVal != null) {
                    node.right = new TreeNode(((Number) rightVal).intValue());
                    queue.offer(node.right);
                }
            }
        }
        return root;
    }
    
    public static Object serializeTreeNode(TreeNode root) {
        if (root == null) return new ArrayList<>();
        List<Object> list = new ArrayList<>();
        Queue<TreeNode> queue = new LinkedList<>();
        queue.offer(root);
        while (!queue.isEmpty()) {
            TreeNode node = queue.poll();
            if (node != null) {
                list.add(node.val);
                queue.offer(node.left);
                queue.offer(node.right);
            } else {
                list.add(null);
            }
        }
        while (!list.isEmpty() && list.get(list.size() - 1) == null) {
            list.remove(list.size() - 1);
        }
        return list;
    }
`;
  }

  // NaryTreeNode helpers
  if (neededHelpers.has("NaryTreeNode")) {
    helpers += `
    public static NaryTreeNode deserializeNaryTreeNode(Object obj) {
        if (obj == null) return null;
        List<?> list = (List<?>) obj;
        if (list.isEmpty()) return null;
        NaryTreeNode root = new NaryTreeNode(((Number) list.get(0)).intValue());
        Stack<NaryTreeNode> stack = new Stack<>();
        stack.push(root);
        for (int i = 1; i < list.size(); i++) {
            Object val = list.get(i);
            if (val == null) {
                stack.pop();
            } else {
                NaryTreeNode child = new NaryTreeNode(((Number) val).intValue());
                stack.peek().children.add(child);
                stack.push(child);
            }
        }
        return root;
    }
    
    public static Object serializeNaryTreeNode(NaryTreeNode root) {
        if (root == null) return new ArrayList<>();
        List<Object> list = new ArrayList<>();
        Queue<NaryTreeNode> queue = new LinkedList<>();
        queue.offer(root);
        while (!queue.isEmpty()) {
            NaryTreeNode node = queue.poll();
            if (node != null) {
                list.add(node.val);
                for (NaryTreeNode child : node.children) {
                    queue.offer(child);
                }
                list.add(null);
            }
        }
        while (!list.isEmpty() && list.get(list.size() - 1) == null) {
            list.remove(list.size() - 1);
        }
        return list;
    }
`;
  }

  // Graph Node helpers (neighbors)
  if (neededHelpers.has("GraphNode")) {
    helpers += `
    public static Node deserializeGraphNode(Object obj) {
        if (obj == null) return null;
        List<?> adjList = (List<?>) obj;
        if (adjList.isEmpty()) return null;
        Node[] nodes = new Node[adjList.size() + 1];
        for (int i = 1; i <= adjList.size(); i++) {
            nodes[i] = new Node(i);
        }
        for (int i = 1; i <= adjList.size(); i++) {
            List<?> neighbors = (List<?>) adjList.get(i-1);
            for (Object nb : neighbors) {
                int nbVal = ((Number) nb).intValue();
                nodes[i].neighbors.add(nodes[nbVal]);
            }
        }
        return nodes[1];
    }
    
    public static Object serializeGraphNode(Node node) {
        if (node == null) return new ArrayList<>();
        Map<Node, Integer> indexMap = new HashMap<>();
        List<Node> nodes = new ArrayList<>();
        Queue<Node> queue = new LinkedList<>();
        queue.offer(node);
        while (!queue.isEmpty()) {
            Node cur = queue.poll();
            if (!indexMap.containsKey(cur)) {
                indexMap.put(cur, indexMap.size() + 1);
                nodes.add(cur);
                for (Node nb : cur.neighbors) {
                    queue.offer(nb);
                }
            }
        }
        Collections.sort(nodes, (a, b) -> Integer.compare(a.val, b.val));
        List<List<Integer>> result = new ArrayList<>();
        for (Node n : nodes) {
            List<Integer> neighbors = new ArrayList<>();
            for (Node nb : n.neighbors) {
                neighbors.add(indexMap.get(nb));
            }
            result.add(neighbors);
        }
        return result;
    }
`;
  }

  // Random List Node helpers
  if (neededHelpers.has("Node")) {
    helpers += `
    public static Node deserializeRandomList(Object obj) {
        if (obj == null) return null;
        List<?> list = (List<?>) obj;
        if (list.isEmpty()) return null;
        Node[] nodes = new Node[list.size()];
        for (int i = 0; i < list.size(); i++) {
            List<?> nodeData = (List<?>) list.get(i);
            int val = ((Number) nodeData.get(0)).intValue();
            nodes[i] = new Node(val);
        }
        for (int i = 0; i < nodes.length - 1; i++) {
            nodes[i].next = nodes[i + 1];
        }
        for (int i = 0; i < list.size(); i++) {
            List<?> nodeData = (List<?>) list.get(i);
            Object randomIndexObj = nodeData.get(1);
            if (randomIndexObj != null) {
                int randomIdx = ((Number) randomIndexObj).intValue();
                nodes[i].random = nodes[randomIdx];
            } else {
                nodes[i].random = null;
            }
        }
        return nodes[0];
    }
    
    public static Object serializeRandomList(Node head) {
        if (head == null) return new ArrayList<>();
        Map<Node, Integer> indexMap = new HashMap<>();
        Node cur = head;
        int idx = 0;
        while (cur != null) {
            indexMap.put(cur, idx++);
            cur = cur.next;
        }
        List<List<Object>> result = new ArrayList<>();
        cur = head;
        while (cur != null) {
            List<Object> pair = new ArrayList<>();
            pair.add(cur.val);
            Node random = cur.random;
            if (random != null) {
                pair.add(indexMap.get(random));
            } else {
                pair.add(null);
            }
            result.add(pair);
            cur = cur.next;
        }
        return result;
    }
`;
  }

  // Collection helpers
  if (neededHelpers.has("CollectionHelpers")) {
    helpers += `
    public static List<Integer> deserializeIntList(Object obj) {
        if (obj == null) return null;
        List<?> list = (List<?>) obj;
        List<Integer> result = new ArrayList<>();
        for (Object item : list) {
            result.add(((Number) item).intValue());
        }
        return result;
    }
    
    public static List<List<Integer>> deserializeIntListList(Object obj) {
        if (obj == null) return null;
        List<?> outer = (List<?>) obj;
        List<List<Integer>> result = new ArrayList<>();
        for (Object innerObj : outer) {
            List<?> inner = (List<?>) innerObj;
            List<Integer> innerList = new ArrayList<>();
            for (Object val : inner) {
                innerList.add(((Number) val).intValue());
            }
            result.add(innerList);
        }
        return result;
    }
    
    public static List<String> deserializeStringList(Object obj) {
        if (obj == null) return null;
        List<?> list = (List<?>) obj;
        List<String> result = new ArrayList<>();
        for (Object item : list) {
            result.add((String) item);
        }
        return result;
    }
`;
  }

  // 2D array helpers (int[][])
  if (
    neededHelpers.has("Int2DArrayHelper") ||
    neededHelpers.has("IntArrayHelper")
  ) {
    helpers += `
    public static int[][] deserializeInt2DArray(Object obj) {
        if (obj == null) return null;
        List<?> outer = (List<?>) obj;
        int[][] arr = new int[outer.size()][];
        for (int i = 0; i < outer.size(); i++) {
            List<?> inner = (List<?>) outer.get(i);
            arr[i] = new int[inner.size()];
            for (int j = 0; j < inner.size(); j++) {
                arr[i][j] = ((Number) inner.get(j)).intValue();
            }
        }
        return arr;
    }
    
    public static Object serializeInt2DArray(int[][] arr) {
        if (arr == null) return new ArrayList<>();
        List<List<Integer>> result = new ArrayList<>();
        for (int[] row : arr) {
            List<Integer> list = new ArrayList<>();
            for (int val : row) {
                list.add(val);
            }
            result.add(list);
        }
        return result;
    }
`;
  }

  // Int array helper (1D)
  helpers += `
    public static int[] deserializeIntArray(Object obj) {
        if (obj == null) return null;
        List<?> list = (List<?>) obj;
        int[] arr = new int[list.size()];
        for (int i = 0; i < list.size(); i++) {
            arr[i] = ((Number) list.get(i)).intValue();
        }
        return arr;
    }
    
    public static String serializeArray(int[] arr) {
        if (arr == null) return "null";
        return Arrays.toString(arr);
    }
`;

  return helpers;
}

// ========== Improved type detection ==========
function determineNeededHelpersFromMethod(methodInfo) {
  const neededHelpers = new Set();
  const addType = (type) => {
    if (type.includes("ListNode")) neededHelpers.add("ListNode");
    if (type.includes("DoublyListNode")) neededHelpers.add("DoublyListNode");
    if (type.includes("TreeNode")) neededHelpers.add("TreeNode");
    if (type.includes("NaryTreeNode")) neededHelpers.add("NaryTreeNode");
    if (type.includes("NestedInteger")) neededHelpers.add("NestedInteger");
    if (type.includes("Node")) neededHelpers.add("Node");
    if (type.includes("List") || type.includes("Map") || type.includes("Set")) {
      neededHelpers.add("CollectionHelpers");
    }
    if (type.includes("int[]") && !type.includes("[][]")) {
      neededHelpers.add("IntArrayHelper");
    }
    if (type.includes("[][]")) {
      neededHelpers.add("Int2DArrayHelper");
    }
  };
  methodInfo.params.forEach((p) => addType(p.type));
  addType(methodInfo.returnType);
  return neededHelpers;
}

// ========== Main wrapper function ==========
function generateJavaWrapper(userCode, starterCode) {
  // Java 8 compatibility fixes
  userCode = userCode.replace(/!sb\.isEmpty\(\)/g, "sb.length() != 0");
  userCode = userCode.replace(/sb\.isEmpty\(\)/g, "sb.length() == 0");

  // Determine if it's interactive
  const isInteractive = isJavaInteractive(userCode);

  // Extract method signature for non‑interactive
  let methodInfo = null;
  if (!isInteractive) {
    methodInfo = extractJavaMethodSignature(userCode);
    if (!methodInfo && starterCode) {
      methodInfo = extractJavaMethodSignature(starterCode);
    }
    if (!methodInfo) {
      throw new Error("Could not extract method signature from Java code");
    }
  }

  // Determine needed helpers
  const neededHelpers = new Set();
  if (!isInteractive && methodInfo) {
    const helpersSet = determineNeededHelpersFromMethod(methodInfo);
    helpersSet.forEach((h) => neededHelpers.add(h));
  }
  // For interactive, we do NOT add any data structure helpers. Only array helpers are added unconditionally later.

  // Always include array helpers (they are safe and used for some problems)
  neededHelpers.add("IntArrayHelper");
  neededHelpers.add("Int2DArrayHelper");

  // Only for non‑interactive, check user‑defined Node class to avoid duplicate definitions
  if (!isInteractive) {
    const nodeClassMatch = userCode.match(/class\s+Node\s*\{([^}]*)\}/);
    if (nodeClassMatch && nodeClassMatch[1].includes("neighbors")) {
      neededHelpers.add("GraphNode");
      neededHelpers.delete("Node");
    }
  }

  // Generate components
  const jsonParser = generateJsonParser();
  const dataStructures = generateJavaDataStructures(neededHelpers, userCode);
  const helpers = generateJavaHelpers(neededHelpers);

  // Generate Main class
  let mainClass;
  if (!isInteractive) {
    mainClass = generateStandardMain(methodInfo, helpers);
  } else {
    mainClass = generateInteractiveMain(userCode, helpers);
  }

  // Assemble final code
  const imports = `
import java.util.*;
import java.io.*;
import java.lang.reflect.*;
import java.math.*;
import java.util.stream.*;
import java.util.Arrays;
`;

  const finalCode = `${imports}

${jsonParser}

${dataStructures}

// User's code
${userCode}

${mainClass}
`;

  return finalCode;
}

// Helper functions for Java wrapper generation
function extractJavaMethodSignature(code) {
  const classMatch = code.match(/class\s+Solution\s*\{/);
  if (!classMatch) return null;
  const classBody = code.substring(classMatch.index);
  const methodRegex = /public\s+(?:static\s+)?(\S+)\s+(\w+)\s*\(([^)]*)\)\s*\{/;
  const methodMatch = methodRegex.exec(classBody);
  if (!methodMatch) return null;
  const returnType = methodMatch[1];
  const methodName = methodMatch[2];
  const paramStr = methodMatch[3];
  const params = [];
  if (paramStr.trim()) {
    let depth = 0;
    let current = [];
    const paramParts = [];
    for (let i = 0; i < paramStr.length; i++) {
      const ch = paramStr[i];
      if (ch === "<") depth++;
      else if (ch === ">") depth--;
      else if (ch === "," && depth === 0) {
        paramParts.push(current.join("").trim());
        current = [];
        continue;
      }
      current.push(ch);
    }
    if (current.length) paramParts.push(current.join("").trim());
    for (const part of paramParts) {
      const lastSpace = part.lastIndexOf(" ");
      const type = part.substring(0, lastSpace).trim();
      const name = part.substring(lastSpace + 1).trim();
      params.push({ type, name });
    }
  }
  return { methodName, returnType, params };
}

function isJavaInteractive(code) {
  return !/class\s+Solution\s*\{/.test(code);
}

function generateJsonParser() {
  // Same as original – omitted for brevity (unchanged)
  return `
class JSONParser {
    private String json;
    private int pos;
    private int len;
    
    public JSONParser(String json) {
        this.json = json;
        this.pos = 0;
        this.len = json.length();
    }
    
    public Object parse() {
        skipWhitespace();
        Object result = parseValue();
        skipWhitespace();
        return result;
    }
    
    private Object parseValue() {
        skipWhitespace();
        char c = json.charAt(pos);
        if (c == '{') return parseObject();
        if (c == '[') return parseArray();
        if (c == '"') return parseString();
        if (c == 't' || c == 'f') return parseBoolean();
        if (c == 'n') return parseNull();
        return parseNumber();
    }
    
    private Map<String, Object> parseObject() {
        Map<String, Object> obj = new HashMap<>();
        pos++; // skip '{'
        skipWhitespace();
        if (json.charAt(pos) == '}') {
            pos++;
            return obj;
        }
        while (true) {
            skipWhitespace();
            String key = parseString();
            skipWhitespace();
            if (json.charAt(pos) != ':') throw new RuntimeException("Expected ':'");
            pos++;
            Object value = parseValue();
            obj.put(key, value);
            skipWhitespace();
            char next = json.charAt(pos);
            if (next == '}') {
                pos++;
                break;
            }
            if (next != ',') throw new RuntimeException("Expected ',' or '}'");
            pos++;
        }
        return obj;
    }
    
    private List<Object> parseArray() {
        List<Object> arr = new ArrayList<>();
        pos++; // skip '['
        skipWhitespace();
        if (json.charAt(pos) == ']') {
            pos++;
            return arr;
        }
        while (true) {
            arr.add(parseValue());
            skipWhitespace();
            char next = json.charAt(pos);
            if (next == ']') {
                pos++;
                break;
            }
            if (next != ',') throw new RuntimeException("Expected ',' or ']'");
            pos++;
        }
        return arr;
    }
    
    private String parseString() {
        pos++; // skip '"'
        StringBuilder sb = new StringBuilder();
        while (pos < len && json.charAt(pos) != '"') {
            char c = json.charAt(pos);
            if (c == '\\\\') {
                pos++;
                c = json.charAt(pos);
                switch (c) {
                    case '"': sb.append('"'); break;
                    case '\\\\': sb.append('\\\\'); break;
                    case '/': sb.append('/'); break;
                    case 'b': sb.append('\\b'); break;
                    case 'f': sb.append('\\f'); break;
                    case 'n': sb.append('\\n'); break;
                    case 'r': sb.append('\\r'); break;
                    case 't': sb.append('\\t'); break;
                    default: sb.append(c);
                }
            } else {
                sb.append(c);
            }
            pos++;
        }
        if (pos >= len) throw new RuntimeException("Unterminated string");
        pos++; // skip closing '"'
        return sb.toString();
    }
    
    private Boolean parseBoolean() {
        if (json.startsWith("true", pos)) {
            pos += 4;
            return true;
        } else if (json.startsWith("false", pos)) {
            pos += 5;
            return false;
        }
        throw new RuntimeException("Invalid boolean");
    }
    
    private Object parseNull() {
        if (json.startsWith("null", pos)) {
            pos += 4;
            return null;
        }
        throw new RuntimeException("Invalid null");
    }
    
    private Number parseNumber() {
        int start = pos;
        while (pos < len && (Character.isDigit(json.charAt(pos)) || json.charAt(pos) == '.' || json.charAt(pos) == '-' || json.charAt(pos) == 'e' || json.charAt(pos) == 'E')) {
            pos++;
        }
        String numStr = json.substring(start, pos);
        try {
            if (numStr.contains(".") || numStr.contains("e") || numStr.contains("E")) {
                return Double.parseDouble(numStr);
            } else {
                return Long.parseLong(numStr);
            }
        } catch (NumberFormatException e) {
            throw new RuntimeException("Invalid number: " + numStr);
        }
    }
    
    private void skipWhitespace() {
        while (pos < len && Character.isWhitespace(json.charAt(pos))) pos++;
    }
}
`;
}

function generateStandardMain(methodInfo, helpers) {
  const { methodName, returnType, params } = methodInfo;

  // Argument deserialization (unchanged)
  const argDeser = params
    .map((p, idx) => {
      const type = p.type.replace(/\s/g, "");
      const varName = `arg${idx}`;

      // Data structures
      if (type === "int")
        return `int ${varName} = ((Number) argsArray.get(${idx})).intValue();`;
      if (type === "long")
        return `long ${varName} = ((Number) argsArray.get(${idx})).longValue();`;
      if (type === "double")
        return `double ${varName} = ((Number) argsArray.get(${idx})).doubleValue();`;
      if (type === "boolean")
        return `boolean ${varName} = (Boolean) argsArray.get(${idx});`;
      if (type === "String")
        return `String ${varName} = (String) argsArray.get(${idx});`;
      if (type === "int[]")
        return `int[] ${varName} = deserializeIntArray(argsArray.get(${idx}));`;
      if (type === "int[][]")
        return `int[][] ${varName} = deserializeInt2DArray(argsArray.get(${idx}));`;
      if (type === "List<Integer>")
        return `List<Integer> ${varName} = deserializeIntList(argsArray.get(${idx}));`;
      if (type === "List<String>")
        return `List<String> ${varName} = deserializeStringList(argsArray.get(${idx}));`;
      if (type === "List<List<Integer>>")
        return `List<List<Integer>> ${varName} = deserializeIntListList(argsArray.get(${idx}));`;
      if (type.includes("ListNode"))
        return `ListNode ${varName} = deserializeListNode(argsArray.get(${idx}));`;
      if (type.includes("TreeNode"))
        return `TreeNode ${varName} = deserializeTreeNode(argsArray.get(${idx}));`;
      if (type === "Node")
        return `Node ${varName} = deserializeRandomList(argsArray.get(${idx}));`;

      return `Object ${varName} = argsArray.get(${idx});`;
    })
    .join("\n    ");

  const argNames = params.map((_, idx) => `arg${idx}`).join(", ");

  // Build method call line
  let methodCallLine;
  if (returnType === "void") {
    methodCallLine = `sol.${methodName}(${argNames});`;
  } else {
    methodCallLine = `${returnType} result = sol.${methodName}(${argNames});`;
  }

  // Build result serialization
  let resultSerialization;
  if (returnType === "void") {
    // Serialize the first argument (assumed to be modified in‑place)
    const firstParam = params[0];
    const firstType = firstParam.type;
    let serializeCall;
    if (firstType.includes("TreeNode")) {
      serializeCall = `serializeTreeNode(arg0)`;
    } else if (firstType.includes("ListNode")) {
      serializeCall = `serializeListNode(arg0)`;
    } else if (firstType === "Node") {
      serializeCall = `serializeRandomList(arg0)`;
    } else if (firstType === "int[][]") {
      serializeCall = `serializeInt2DArray(arg0)`;
    } else if (firstType === "int[]") {
      serializeCall = `serializeArray(arg0)`;
    } else {
      serializeCall = `arg0`; // fallback
    }
    resultSerialization = `System.out.print(${serializeCall});`;
  } else if (
    ["int", "long", "double", "boolean", "String"].includes(returnType)
  ) {
    resultSerialization = `System.out.print(result);`;
  } else if (returnType === "int[]") {
    resultSerialization = `System.out.print(serializeArray(result));`;
  } else if (returnType === "int[][]") {
    resultSerialization = `System.out.print(serializeInt2DArray(result));`;
  } else if (returnType.includes("ListNode")) {
    resultSerialization = `System.out.print(serializeListNode(result));`;
  } else if (returnType.includes("TreeNode")) {
    resultSerialization = `System.out.print(serializeTreeNode(result));`;
  } else if (returnType === "Node") {
    resultSerialization = `System.out.print(serializeRandomList(result));`;
  } else {
    resultSerialization = `System.out.print(result);`;
  }

  return `
public class Main {
    public static void main(String[] args) throws Exception {
        Scanner scanner = new Scanner(System.in);
        String inputLine = scanner.nextLine();
        List<?> argsArray = null;
        try {
            JSONParser parser = new JSONParser(inputLine);
            Object parsed = parser.parse();
            if (parsed instanceof Map) {
                Map<?,?> map = (Map<?,?>) parsed;
                argsArray = (List<?>) map.get("args");
            } else if (parsed instanceof List) {
                argsArray = (List<?>) parsed;
            } else {
                throw new RuntimeException("Invalid input format");
            }
        } catch (Exception e) {
            // Not JSON, try legacy format
            argsArray = parseLegacyInput(inputLine);
        }
        ${argDeser}
        Solution sol = new Solution();
        ${methodCallLine}
        ${resultSerialization}
    }
    
    // ---------- Legacy input parser (mimics Python's parse_input) ----------
    private static List<Object> parseLegacyInput(String input) {
        List<String> parts = new ArrayList<>();
        int bracketDepth = 0;
        StringBuilder current = new StringBuilder();
        for (int i = 0; i < input.length(); i++) {
            char ch = input.charAt(i);
            if (ch == '[') bracketDepth++;
            else if (ch == ']') bracketDepth--;
            else if (ch == ',' && bracketDepth == 0) {
                parts.add(current.toString().trim());
                current.setLength(0);
                continue;
            }
            current.append(ch);
        }
        if (current.length() > 0) parts.add(current.toString().trim());
        
        List<Object> values = new ArrayList<>();
        for (String part : parts) {
            String valuePart;
            int eqIdx = part.indexOf('=');
            if (eqIdx != -1) {
                valuePart = part.substring(eqIdx + 1).trim();
            } else {
                valuePart = part;
            }
            values.add(parseValue(valuePart));
        }
        return values;
    }
    
    private static Object parseValue(String s) {
        s = s.trim();
        if (s.equals("null")) return null;
        if (s.startsWith("[") && s.endsWith("]")) {
            String inner = s.substring(1, s.length() - 1).trim();
            if (inner.isEmpty()) return new ArrayList<>();
            List<Object> list = new ArrayList<>();
            int depth = 0;
            StringBuilder item = new StringBuilder();
            for (int i = 0; i < inner.length(); i++) {
                char ch = inner.charAt(i);
                if (ch == '[') depth++;
                else if (ch == ']') depth--;
                else if (ch == ',' && depth == 0) {
                    list.add(parseValue(item.toString().trim()));
                    item.setLength(0);
                    continue;
                }
                item.append(ch);
            }
            if (item.length() > 0) list.add(parseValue(item.toString().trim()));
            return list;
        }
        try {
            if (s.contains(".")) return Double.parseDouble(s);
            else return Long.parseLong(s);
        } catch (NumberFormatException e) {
            if (s.startsWith("\\\"") && s.endsWith("\\\"")) {
                return s.substring(1, s.length() - 1);
            }
            return s;
        }
    }
    // -----------------------------------------------------------------
    
    ${helpers}
}
`;
}

function generateInteractiveMain(userCode, helpers) {
  const classNameMatch = userCode.match(/class\s+(\w+)\s*\{/);
  if (!classNameMatch)
    throw new Error("No class found for interactive problem");
  const className = classNameMatch[1];

  return `
public class Main {
    public static void main(String[] args) throws Exception {
        Scanner scanner = new Scanner(System.in);
        String inputLine = scanner.nextLine().trim();
        
        List<Object> constructorArgs = null;
        List<Object> methodsList = null;
        String detectedClassName = null;
        
        // Try to split into two arrays: [methods] [args]
        List<?> methodNames = null;
        List<?> argsArray = null;
        if (inputLine.startsWith("[") && inputLine.contains("] [")) {
            int firstClose = findMatchingBracket(inputLine, 0);
            if (firstClose != -1) {
                String firstPart = inputLine.substring(0, firstClose + 1);
                String secondPart = inputLine.substring(firstClose + 1).trim();
                JSONParser parser1 = new JSONParser(firstPart);
                JSONParser parser2 = new JSONParser(secondPart);
                try {
                    methodNames = (List<?>) parser1.parse();
                    argsArray = (List<?>) parser2.parse();
                } catch (Exception e) {}
            }
        }
        
        if (methodNames != null && argsArray != null) {
            if (methodNames.isEmpty()) throw new RuntimeException("No method names provided");
            detectedClassName = (String) methodNames.get(0);
            if (argsArray.size() > 0 && argsArray.get(0) instanceof List) {
                constructorArgs = (List<Object>) argsArray.get(0);
            } else {
                constructorArgs = new ArrayList<>();
            }
            methodsList = new ArrayList<>();
            for (int i = 1; i < methodNames.size(); i++) {
                String methodName = (String) methodNames.get(i);
                List<?> methodArgs = (i < argsArray.size() && argsArray.get(i) instanceof List)
                    ? (List<?>) argsArray.get(i)
                    : new ArrayList<>();
                List<Object> call = new ArrayList<>();
                call.add(methodName);
                call.addAll(methodArgs);
                methodsList.add(call);
            }
        } else {
            JSONParser parser = new JSONParser(inputLine);
            Object parsed = parser.parse();
            if (parsed instanceof Map) {
                Map<String,Object> inputMap = (Map<String,Object>) parsed;
                constructorArgs = (List<Object>) inputMap.get("constructor");
                methodsList = (List<Object>) inputMap.get("methods");
                detectedClassName = (String) inputMap.get("class");
                if (detectedClassName == null) detectedClassName = "${className}";
            } else if (parsed instanceof List) {
                List<?> inputArray = (List<?>) parsed;
                if (inputArray.size() != 2) {
                    throw new RuntimeException("Invalid input array format: expected 2 elements");
                }
                methodNames = (List<?>) inputArray.get(0);
                argsArray = (List<?>) inputArray.get(1);
                if (methodNames.isEmpty()) throw new RuntimeException("No method names provided");
                detectedClassName = (String) methodNames.get(0);
                if (argsArray.size() > 0 && argsArray.get(0) instanceof List) {
                    constructorArgs = (List<Object>) argsArray.get(0);
                } else {
                    constructorArgs = new ArrayList<>();
                }
                methodsList = new ArrayList<>();
                for (int i = 1; i < methodNames.size(); i++) {
                    String methodName = (String) methodNames.get(i);
                    List<?> methodArgs = (i < argsArray.size() && argsArray.get(i) instanceof List)
                        ? (List<?>) argsArray.get(i)
                        : new ArrayList<>();
                    List<Object> call = new ArrayList<>();
                    call.add(methodName);
                    call.addAll(methodArgs);
                    methodsList.add(call);
                }
            } else {
                throw new RuntimeException("Invalid input format");
            }
        }
        
        if (constructorArgs == null) constructorArgs = new ArrayList<>();
        
        Class<?> clazz = Class.forName(detectedClassName);
        Constructor<?> ctor = findCompatibleConstructor(clazz, constructorArgs);
        Object[] ctorArgs = convertArguments(constructorArgs, ctor.getParameterTypes());
        Object obj = ctor.newInstance(ctorArgs);
        
        List<Object> results = new ArrayList<>();
        results.add(null);
        for (Object methodCall : methodsList) {
            if (methodCall instanceof List) {
                List<?> call = (List<?>) methodCall;
                String methodName = (String) call.get(0);
                List<?> methodArgs = call.subList(1, call.size());
                Method method = findCompatibleMethod(clazz, methodName, methodArgs);
                Object[] convertedArgs = convertArguments(methodArgs, method.getParameterTypes());
                Object result = method.invoke(obj, convertedArgs);
                results.add(result);
            } else {
                String methodName = (String) methodCall;
                Method method = clazz.getDeclaredMethod(methodName);
                Object result = method.invoke(obj);
                results.add(result);
            }
        }
        System.out.print(serialize(results));
    }
    
    // Helper to find matching closing bracket
    private static int findMatchingBracket(String s, int start) {
        if (s.charAt(start) != '[') return -1;
        int depth = 0;
        for (int i = start; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '[') depth++;
            else if (c == ']') {
                depth--;
                if (depth == 0) return i;
            }
        }
        return -1;
    }
    
    // Find constructor compatible with argument types
    private static Constructor<?> findCompatibleConstructor(Class<?> clazz, List<?> args) throws NoSuchMethodException {
        Class<?>[] paramTypes = getParameterTypes(args);
        try {
            return clazz.getDeclaredConstructor(paramTypes);
        } catch (NoSuchMethodException e) {
            Constructor<?>[] ctors = clazz.getDeclaredConstructors();
            for (Constructor<?> ctor : ctors) {
                if (ctor.getParameterCount() == paramTypes.length) {
                    boolean compatible = true;
                    Class<?>[] ctorParamTypes = ctor.getParameterTypes();
                    for (int i = 0; i < paramTypes.length; i++) {
                        if (!isCompatible(paramTypes[i], ctorParamTypes[i])) {
                            compatible = false;
                            break;
                        }
                    }
                    if (compatible) return ctor;
                }
            }
            throw e;
        }
    }
    
    // Find method compatible with argument types
    private static Method findCompatibleMethod(Class<?> clazz, String name, List<?> args) throws NoSuchMethodException {
        Class<?>[] paramTypes = getParameterTypes(args);
        try {
            return clazz.getDeclaredMethod(name, paramTypes);
        } catch (NoSuchMethodException e) {
            Method[] methods = clazz.getDeclaredMethods();
            for (Method m : methods) {
                if (m.getName().equals(name) && m.getParameterCount() == paramTypes.length) {
                    boolean compatible = true;
                    Class<?>[] mParamTypes = m.getParameterTypes();
                    for (int i = 0; i < paramTypes.length; i++) {
                        if (!isCompatible(paramTypes[i], mParamTypes[i])) {
                            compatible = false;
                            break;
                        }
                    }
                    if (compatible) return m;
                }
            }
            throw e;
        }
    }
    
    // Check if actual type can be passed to expected type (autoboxing/unboxing considered)
    private static boolean isCompatible(Class<?> actual, Class<?> expected) {
        if (actual == expected) return true;
        if (actual == Integer.class && expected == int.class) return true;
        if (actual == Long.class && expected == long.class) return true;
        if (actual == Long.class && expected == int.class) return true; // allow Long to int
        if (actual == Double.class && expected == double.class) return true;
        if (actual == Double.class && expected == int.class) return true; // allow Double to int (lossy but typical)
        if (actual == Boolean.class && expected == boolean.class) return true;
        if (actual == String.class && expected == String.class) return true;
        return false;
    }
    
    // Convert raw arguments to target parameter types
    private static Object[] convertArguments(List<?> args, Class<?>[] paramTypes) {
        Object[] converted = new Object[args.size()];
        for (int i = 0; i < args.size(); i++) {
            Object arg = args.get(i);
            Class<?> target = paramTypes[i];
            if (target == int.class) {
                if (arg instanceof Number) {
                    converted[i] = ((Number) arg).intValue();
                } else {
                    converted[i] = arg;
                }
            } else if (target == long.class) {
                if (arg instanceof Number) {
                    converted[i] = ((Number) arg).longValue();
                } else {
                    converted[i] = arg;
                }
            } else if (target == double.class) {
                if (arg instanceof Number) {
                    converted[i] = ((Number) arg).doubleValue();
                } else {
                    converted[i] = arg;
                }
            } else if (target == boolean.class) {
                if (arg instanceof Boolean) {
                    converted[i] = arg;
                } else {
                    converted[i] = arg;
                }
            } else {
                converted[i] = arg;
            }
        }
        return converted;
    }
    
    // Determine parameter types from raw arguments (used for method lookup)
    private static Class<?>[] getParameterTypes(List<?> args) {
        Class<?>[] types = new Class<?>[args.size()];
        for (int i = 0; i < args.size(); i++) {
            Object arg = args.get(i);
            if (arg instanceof Integer) {
                types[i] = int.class;
            } else if (arg instanceof Long) {
                long val = (Long) arg;
                if (val >= Integer.MIN_VALUE && val <= Integer.MAX_VALUE) {
                    types[i] = int.class;
                } else {
                    types[i] = long.class;
                }
            } else if (arg instanceof Double) {
                types[i] = double.class;
            } else if (arg instanceof Boolean) {
                types[i] = boolean.class;
            } else if (arg instanceof String) {
                types[i] = String.class;
            } else if (arg instanceof List) {
                types[i] = List.class;
            } else if (arg instanceof Map) {
                types[i] = Map.class;
            } else {
                types[i] = Object.class;
            }
        }
        return types;
    }
    
    // ---------- Serialization helpers ----------
    private static String serialize(Object obj) {
        if (obj == null) return "null";
        if (obj instanceof String) return "\\\"" + escape((String) obj) + "\\\"";
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
                sb.append("\\\"").append(e.getKey()).append("\\\":").append(serialize(e.getValue()));
            }
            sb.append("}");
            return sb.toString();
        }
        return obj.toString();
    }
    
    private static String escape(String s) {
        return s.replace("\\\\", "\\\\\\\\").replace("\\\"", "\\\\\\\"");
    }
    
    ${helpers}
}
`;
}

// Helper to convert raw test case input to JSON {"args": [...]}
const convertToJsonArgs = (rawInput) => {
  if (!rawInput) return '{"args":[]}';
  const trimmed = rawInput.trim();
  
  // Already a JSON object with "args"
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed);
      if (obj.args !== undefined) return trimmed;
    } catch (e) {}
  }
  
  // Already a JSON array
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed);
      return JSON.stringify({ args: arr });
    } catch (e) {}
  }
  
  // Split by newlines first
  const lines = rawInput.split(/\r?\n/).filter(line => line.trim() !== "");
  const args = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Try to parse as JSON (number, string, array, object)
    try {
      args.push(JSON.parse(trimmedLine));
      continue;
    } catch (e) {
      // Not valid JSON – attempt to parse key=value pairs
    }
    
    // Check if line looks like "key1 = value1, key2 = value2, ..."
    if (trimmedLine.includes('=') && trimmedLine.includes(',')) {
      const pairs = trimmedLine.split(',').map(p => p.trim());
      let allNumbers = true;
      const extracted = [];
      for (const pair of pairs) {
        const eqIndex = pair.indexOf('=');
        if (eqIndex !== -1) {
          const valueStr = pair.substring(eqIndex + 1).trim();
          const num = Number(valueStr);
          if (!isNaN(num)) {
            extracted.push(num);
          } else {
            allNumbers = false;
            break;
          }
        } else {
          allNumbers = false;
          break;
        }
      }
      if (allNumbers && extracted.length > 0) {
        args.push(...extracted);
        continue;
      }
    }
    
    // Fallback: treat line as a single string
    args.push(trimmedLine);
  }
  
  return JSON.stringify({ args });
};

const runCode = async (req, res, next) => {
  try {
    let { language, code, stdin, expected, testCases, questionId } = req.body;
    language = normalizeLanguage(language);

    if (!SUPPORTED_LANGUAGES.includes(language)) {
      throw new AppError(
        `Unsupported language. Supported: ${SUPPORTED_LANGUAGES.join(", ")}`,
        400,
      );
    }
    if (!code || typeof code !== "string" || code.trim().length === 0) {
      throw new AppError("Code cannot be empty", 400);
    }
    if (!questionId) {
      throw new AppError("questionId is required", 400);
    }

    const [question, userProgress] = await Promise.all([
      Question.findById(questionId).lean(),
      UserQuestionProgress.findOne({ userId: req.user._id, questionId }),
    ]);
    if (!question) throw new AppError("Question not found", 404);

    // --- Check if result order is irrelevant ---
    let isOrderIrrelevant = false;
    if (question.contentRef) {
      isOrderIrrelevant = /any order/i.test(question.contentRef);
    }

    // Normalization helper for test case comparison
    const normalizeForCompare = (str) => (str || "").replace(/\s+/g, " ").trim();

    // 1. Extract default test cases from the question
    let defaultTestCases = [];
    if (question.testCases && Array.isArray(question.testCases)) {
      defaultTestCases = question.testCases.map((tc) => ({
        stdin: tc.stdin || tc.input,
        expected: tc.expected || tc.expectedOutput,
      }));
    }

    // 2. Extract existing custom test cases from user progress (already stored)
    let userCustomTestCases = [];
    if (
      userProgress &&
      userProgress.customTestCases &&
      Array.isArray(userProgress.customTestCases)
    ) {
      userCustomTestCases = userProgress.customTestCases.map((tc) => ({
        stdin: tc.stdin,
        expected: tc.expected,
      }));
    }

    // 3. Build the set of test cases to run (deduplicated)
    const allTestCases = [
      ...defaultTestCases,
      ...userCustomTestCases,
      ...(testCases && Array.isArray(testCases) ? testCases : []),
    ];

    // Add single test case from stdin/expected if provided
    if (stdin !== undefined && !testCases) {
      allTestCases.push({ stdin: stdin || "", expected: expected || "" });
    }

    // Deduplicate using a Map keyed by normalized stdin|expected
    const uniqueMap = new Map();
    for (const tc of allTestCases) {
      const key = `${normalizeForCompare(tc.stdin)}|${normalizeForCompare(tc.expected)}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, tc);
      }
    }
    const finalTestCases = Array.from(uniqueMap.values());

    if (finalTestCases.length === 0) {
      throw new AppError("No test cases available for this question", 400);
    }

    // Auto‑wrap if needed
    let finalCode = code;
    if (!hasSolveFunction(code, language)) {
      if (language === "python") {
        const starterCode = question.starterCode
          ? question.starterCode["Python3"]
          : null;
        try {
          finalCode = generatePythonWrapper(code, starterCode, finalTestCases);
        } catch (wrapErr) {
          console.error("Wrapper generation error:", wrapErr.message);
        }
      } else if (language === "cpp") {
        const starterCode = question.starterCode
          ? question.starterCode["C++"]
          : null;
        try {
          finalCode = generateCppWrapper(code, starterCode);
        } catch (wrapErr) {
          console.error("C++ wrapper generation error:", wrapErr.message);
          finalCode = code;
        }
      } else if (language === "java") {
        const starterCode = question.starterCode
          ? question.starterCode["Java"]
          : null;
        try {
          finalCode = generateJavaWrapper(code, starterCode);
        } catch (wrapErr) {
          console.error("Java wrapper generation error:", wrapErr.message);
        }
      } else {
        console.warn(
          `Auto-wrap not implemented for ${language}, using raw code`,
        );
      }
    }

    // ----- CONVERT TEST CASES FOR C++ -----
    if (language === "cpp") {
      finalTestCases = finalTestCases.map((tc) => ({
        stdin: convertToJsonArgs(tc.stdin),
        expected: tc.expected,
      }));
    }
    // -------------------------------------

    const batchResults = await executeBatch({
      language,
      code: finalCode,
      testCases: finalTestCases,
    });

    const results = batchResults.map((res, idx) => {
      const testCase = finalTestCases[idx];
      const actualOutput = res.stdout;
      const expectedOutput = testCase.expected || "";
      const normalizedActual = normalize(actualOutput);
      const normalizedExpected = normalize(expectedOutput);

      let passed = false;
      if (isOrderIrrelevant) {
        try {
          const actualParsed = JSON.parse(actualOutput);
          const expectedParsed = JSON.parse(expectedOutput);
          if (Array.isArray(actualParsed) && Array.isArray(expectedParsed)) {
            const actualSorted = [...actualParsed].sort((a, b) => a - b);
            const expectedSorted = [...expectedParsed].sort((a, b) => a - b);
            passed = JSON.stringify(actualSorted) === JSON.stringify(expectedSorted);
          } else {
            passed = normalizedActual === normalizedExpected;
          }
        } catch (e) {
          passed = normalizedActual === normalizedExpected;
        }
      } else {
        passed = normalizedActual === normalizedExpected;
      }

      return {
        input: testCase.stdin,
        output: actualOutput,
        expected: expectedOutput,
        error: res.stderr,
        exitCode: res.exitCode,
        passed,
      };
    });

    // --- EMIT ONE AGGREGATED JOB FOR THE ENTIRE SUBMISSION (not per test case) ---
    if (jobQueue) {
      const passedCount = results.filter(r => r.passed).length;
      const failedCount = results.filter(r => !r.passed).length;
      const totalTestCases = results.length;
       await jobQueue.add('test_case.executed', {
        userId: req.user._id,
        questionId,
        passedCount,
        failedCount,
        totalTestCases,
        allPassed: passedCount === totalTestCases,
        executedAt: new Date(),
        language,
      });
    }
    // ---------------------------------------------------------------------------

    const passedCount = results.filter((r) => r.passed).length;
    const totalCount = finalTestCases.length;
    const allPassed = passedCount === totalCount;

    // ========== SAVE CUSTOM TEST CASES (only those that are NOT default) ==========
    let customToSave = [];
    if (testCases && Array.isArray(testCases)) {
      customToSave = testCases;
    } else if (stdin !== undefined) {
      customToSave = [{ stdin: stdin || "", expected: expected || "" }];
    }

    // Filter out any custom test case that matches a default test case
    if (customToSave.length > 0 && defaultTestCases.length > 0) {
      const defaultSet = new Set(
        defaultTestCases.map((tc) =>
          `${normalizeForCompare(tc.stdin)}|${normalizeForCompare(tc.expected)}`
        )
      );

      const uniqueCustom = customToSave.filter((tc) => {
        const key = `${normalizeForCompare(tc.stdin)}|${normalizeForCompare(tc.expected)}`;
        return !defaultSet.has(key);
      });

      customToSave = uniqueCustom;
    }

    if (customToSave.length > 0) {
      await UserQuestionProgress.findOneAndUpdate(
        { userId: req.user._id, questionId },
        {
          $set: {
            customTestCases: customToSave.map((tc) => ({
              stdin: tc.stdin,
              expected: tc.expected,
              updatedAt: new Date(),
            })),
          },
        },
        { upsert: true, new: true }
      );
    } else if (testCases || stdin !== undefined) {
      // If custom test cases were provided but all were duplicates, clear stored ones
      await UserQuestionProgress.findOneAndUpdate(
        { userId: req.user._id, questionId },
        { $set: { customTestCases: [] } },
        { upsert: true }
      );
    }
    // ======================================================================

    // --- Save execution history with original user code ---
    await CodeExecutionHistory.create({
      userId: req.user._id,
      questionId,
      language,
      code: code,
      testCases: results.map((r) => ({
        stdin: r.input,
        expected: r.expected,
        output: r.output,
        error: r.error,
        exitCode: r.exitCode,
        passed: r.passed,
      })),
      summary: {
        passedCount,
        totalCount,
        allPassed,
        defaultTestCasesCount: defaultTestCases.length,
        userCustomTestCasesCount: userCustomTestCases.length,
        customTestCasesCount: customToSave.length,
      },
    });

    // --- Per‑language cleanup: keep 1 all‑passed + 2 latest (any outcome) ---
    const cleanupExecutionHistory = async (userId, questionId, language) => {
      const records = await CodeExecutionHistory.find({
        userId,
        questionId,
        language,
      }).sort({ executedAt: -1 });

      const passedRecords = records.filter((r) => r.summary?.allPassed === true);
      const nonPassedRecords = records.filter((r) => r.summary?.allPassed !== true);

      const toDelete = [];

      if (passedRecords.length > 1) {
        const extraPassed = passedRecords.slice(1);
        toDelete.push(...extraPassed.map((r) => r._id));
      }

      if (nonPassedRecords.length > 2) {
        const extraNonPassed = nonPassedRecords.slice(2);
        toDelete.push(...extraNonPassed.map((r) => r._id));
      }

      if (toDelete.length > 0) {
        await CodeExecutionHistory.deleteMany({ _id: { $in: toDelete } });
      }
    };

    await cleanupExecutionHistory(req.user._id, questionId, language);

    const responseData = {
      questionId,
      results,
      passedCount,
      totalCount,
      allPassed,
      defaultTestCasesCount: defaultTestCases.length,
      userCustomTestCasesCount: userCustomTestCases.length,
      customTestCasesCount: customToSave.length,
    };

    // ----- Create revision schedule on first submission (any result) -----
    const existingRevision = await RevisionSchedule.findOne({
      userId: req.user._id,
      questionId
    });
    if (!existingRevision) {
      const timeZone = req.user.preferences?.timezone || 'UTC';
      const solvedLocal = DateTime.fromJSDate(new Date(), { zone: timeZone });
      const scheduleDays = constants.REVISION_SCHEDULE; // [1, 3, 7, 14, 30]
      const scheduleUTC = scheduleDays.map(days => {
        // For all offsets, use start of the target day (midnight)
        const localDate = solvedLocal.startOf('day').plus({ days });
        return localDate.toUTC().toJSDate();
      });
      await RevisionSchedule.create({
        userId: req.user._id,
        questionId,
        schedule: scheduleUTC,
        baseDate: new Date(),
        status: 'active',
        currentRevisionIndex: 0,
        completedRevisions: []
      });
      await invalidateCache(`revisions:*:user:${req.user._id}:*`);
      await invalidateCache(`question-details:*:${questionId}:*`);
    }

    // ----- If all tests passed, mark question as Solved (if not already) -----
    if (allPassed) {
      let progress = await UserQuestionProgress.findOne({ userId: req.user._id, questionId });
      if (!progress) {
        progress = new UserQuestionProgress({
          userId: req.user._id,
          questionId,
          status: 'Solved',
          attempts: { count: 1, solvedAt: new Date(), lastAttemptAt: new Date(), firstAttemptAt: new Date() },
          totalTimeSpent: 0
        });
      } else if (progress.status !== 'Solved') {
        progress.status = 'Solved';
        progress.attempts.solvedAt = new Date();
        progress.attempts.lastAttemptAt = new Date();
        progress.attempts.count = (progress.attempts.count || 0) + 1;
      }
      await progress.save();
      await invalidateProgressCache(req.user._id);

      // --- Queue question.solved job for goal and revision sync ---
      if (jobQueue) {
        await jobQueue.add('question.solved', {
          userId: req.user._id,
          questionId,
          progressId: progress._id,
          timeSpent: 0,
          solvedAt: new Date(),
          source: 'test_case'
        });
      }

      await revisionActivityService.recordCodeSubmission(req.user._id, questionId, new Date());
      
      // Mark test passed for active revision sessions AND cancel any pending auto-completion jobs
      await markTestPassedForQuestion(req.user._id, questionId);

      // Automatically complete today's revision by skipping any overdue revisions
      const revisionResult = await revisionActivityService.checkAndCompleteRevision(
        req.user._id,
        questionId,
        new Date(),
        'auto',
        { targetDate: new Date() }
      );

      if (revisionResult.completed) {
        responseData.revisionCompleted = true;
        responseData.revisionMessage = revisionResult.message;
        responseData.revisionOutOfOrder = revisionResult.outOfOrder || false;
        responseData.revisionOverdueCompleted = revisionResult.overdueCompleted || false;
      }
    }

    return res.json(formatResponse("Code executed successfully", responseData));
  } catch (error) {
    next(error);
  }
};

module.exports = { runCode };