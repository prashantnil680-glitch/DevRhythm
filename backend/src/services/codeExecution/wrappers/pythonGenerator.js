const fs = require('fs');
const path = require('path');

class PythonGenerator {
  generateWrapper(userCode, metadata, testCases) {
    if (!userCode || typeof userCode !== 'string') {
      throw new Error('Invalid user code');
    }
    if (!metadata || !metadata.methodName) {
      throw new Error('Invalid metadata: missing methodName');
    }

    const helperCode = this._getRequiredHelpers();
    const missingImpl = this._injectMissingImports(userCode);
    const imports = this._generateImports(metadata);
    const { deserCode, callCode, interactiveMain } = this._generateExecutionCode(metadata);
    const finalCode = `${imports}\n\n${helperCode}\n${missingImpl}\n\n${userCode}\n\n${interactiveMain || this._buildNonInteractiveMain(deserCode, callCode, metadata.returnType, metadata.methodName, metadata.className)}\n`;
    return finalCode;
  }

  _getRequiredHelpers() {
    const structuresPath = path.join(__dirname, '../helpers/python/structures.py');
    try {
      return fs.readFileSync(structuresPath, 'utf-8');
    } catch (err) {
      console.warn(`Could not read structures.py: ${err.message}`);
      return this._fallbackHelpers();
    }
  }

  _fallbackHelpers() {
    return `
# Fallback helpers (should not be used in production)
import json
from collections import deque
from typing import List, Optional, Any

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

class Node:
    def __init__(self, val=0, neighbors=None, next=None, random=None):
        self.val = val
        self.neighbors = neighbors if neighbors is not None else []
        self.next = next
        self.random = random

class NestedInteger:
    def __init__(self, value=None):
        self.value = value
        self.list = []
    def isInteger(self): return self.value is not None
    def getInteger(self): return self.value
    def setInteger(self, value): self.value = value; self.list = []
    def add(self, ni): self.list.append(ni)
    def getList(self): return self.list

def deserialize_linked_list(arr):
    if not arr: return None
    head = ListNode(arr[0])
    cur = head
    for v in arr[1:]: cur.next = ListNode(v); cur = cur.next
    return head

def deserialize_cyclic_linked_list(data, pos):
    """Fallback implementation for cyclic linked list."""
    if not data: return None
    head = deserialize_linked_list(data)
    if pos == -1:
        return head
    if pos < 0 or pos >= len(data):
        return head
    tail = head
    while tail.next:
        tail = tail.next
    pos_node = head
    for _ in range(pos):
        if pos_node.next:
            pos_node = pos_node.next
        else:
            return head
    tail.next = pos_node
    return head

def serialize_linked_list(head):
    res = []
    visited = set()
    cur = head
    while cur and id(cur) not in visited:
        visited.add(id(cur))
        res.append(cur.val)
        cur = cur.next
    return res

def deserialize_tree(arr):
    if not arr: return None
    root = TreeNode(arr[0])
    q = deque([root])
    i = 1
    while q and i < len(arr):
        node = q.popleft()
        if i < len(arr) and arr[i] is not None:
            node.left = TreeNode(arr[i]); q.append(node.left)
        i += 1
        if i < len(arr) and arr[i] is not None:
            node.right = TreeNode(arr[i]); q.append(node.right)
        i += 1
    return root

def serialize_tree(root):
    if not root: return []
    res = []
    q = deque([root])
    while q:
        node = q.popleft()
        if node:
            res.append(node.val)
            q.append(node.left)
            q.append(node.right)
        else:
            res.append(None)
    while res and res[-1] is None: res.pop()
    return res

def deserialize_graph(adj):
    if not adj: return None
    nodes = {}
    for i, neigh in enumerate(adj):
        val = i + 1
        if val not in nodes: nodes[val] = Node(val)
        for nb in neigh:
            if nb not in nodes: nodes[nb] = Node(nb)
            nodes[val].neighbors.append(nodes[nb])
    return nodes[1]

def serialize_graph(node):
    if not node: return []
    visited = set()
    order = []
    q = deque([node])
    while q:
        cur = q.popleft()
        if cur.val in visited: continue
        visited.add(cur.val)
        order.append(cur)
        for nb in cur.neighbors: q.append(nb)
    order.sort(key=lambda n: n.val)
    idx = {n.val: i+1 for i, n in enumerate(order)}
    return [[idx[nb.val] for nb in n.neighbors] for n in order]

def deserialize_random_list(arr):
    if not arr: return None
    nodes = [Node(pair[0]) for pair in arr]
    for i in range(len(nodes)-1): nodes[i].next = nodes[i+1]
    for i, pair in enumerate(arr):
        if pair[1] is not None: nodes[i].random = nodes[pair[1]]
    return nodes[0]

def serialize_random_list(head):
    if not head: return []
    idx = {}
    cur = head
    i = 0
    while cur:
        idx[cur] = i
        cur = cur.next
        i += 1
    res = []
    cur = head
    while cur:
        res.append([cur.val, idx.get(cur.random) if cur.random else None])
        cur = cur.next
    return res

def deserialize_node(obj):
    if not obj: return None
    if isinstance(obj, list) and len(obj) > 0 and isinstance(obj[0], list) and len(obj[0]) == 2:
        return deserialize_random_list(obj)
    return deserialize_graph(obj)

def serialize_node(node):
    if not node: return []
    if node.next is not None:
        return serialize_random_list(node)
    else:
        return serialize_graph(node)

def deserialize_nested_integer(data):
    if isinstance(data, int): return NestedInteger(data)
    if isinstance(data, list):
        ni = NestedInteger()
        for item in data: ni.add(deserialize_nested_integer(item))
        return ni
    return NestedInteger()

def serialize_nested_integer(ni):
    if ni.isInteger(): return ni.getInteger()
    return [serialize_nested_integer(child) for child in ni.getList()]
`;
  }

  _injectMissingImports(userCode) {
    let injections = '';
    if (userCode.includes('SortedList')) {
      injections += `
# Auto-injected SortedList implementation for compatibility
import bisect

class SortedList:
    def __init__(self, iterable=None):
        self._list = []
        if iterable:
            for item in iterable:
                self.add(item)
    def add(self, value):
        bisect.insort(self._list, value)
    def bisect_left(self, value):
        return bisect.bisect_left(self._list, value)
    def bisect_right(self, value):
        return bisect.bisect_right(self._list, value)
    def __len__(self):
        return len(self._list)
    def __getitem__(self, index):
        return self._list[index]
`;
    }
    if (userCode.includes('SortedSet')) {
      injections += `
# Auto-injected SortedSet implementation for compatibility
import bisect

class SortedSet:
    def __init__(self, iterable=None):
        self._list = []
        if iterable:
            for item in iterable:
                self.add(item)
    def add(self, value):
        idx = bisect.bisect_left(self._list, value)
        if idx == len(self._list) or self._list[idx] != value:
            self._list.insert(idx, value)
    def bisect_right(self, value):
        return bisect.bisect_right(self._list, value)
    def index(self, value):
        idx = bisect.bisect_left(self._list, value)
        if idx < len(self._list) and self._list[idx] == value:
            return idx
        raise ValueError(f"{value} not in SortedSet")
    def remove(self, value):
        idx = self.index(value)
        del self._list[idx]
    def __len__(self):
        return len(self._list)
    def __iter__(self):
        return iter(self._list)
    def __contains__(self, value):
        idx = bisect.bisect_left(self._list, value)
        return idx < len(self._list) and self._list[idx] == value
    def __getitem__(self, index):
        return self._list[index]
`;
    }
    return injections;
  }

  _generateExecutionCode(metadata) {
    const { interactive, className, methodName, parameters, constructorParams, methods } = metadata;
    if (interactive) {
      return this._generateInteractive(className, constructorParams, methods);
    } else {
      const deserCode = this._generateDeserialization(parameters);
      const callCode = this._generateStandardCall(className, methodName, parameters);
      return { deserCode, callCode, interactiveMain: null };
    }
  }

  /**
   * Generate Python deserialisation code for the given parameters.
   * For ListNode parameters, it generates code that handles both:
   *   - A plain array (legacy) → deserialize_linked_list
   *   - A dict with "list" and "pos" keys → deserialize_cyclic_linked_list
   * For all other types, it uses the existing heuristics.
   */
  _generateDeserialization(parameters) {
    if (!parameters.length) return '';
    const lines = [];
    lines.push(`        if len(args) < ${parameters.length}:`);
    lines.push(`            args += [None] * (${parameters.length} - len(args))`);
    for (let i = 0; i < parameters.length; i++) {
      const param = parameters[i];
      const paramName = param.name;
      const lowerName = (paramName || '').toLowerCase();
      const baseType = this._getBaseType(param.type);

      let expr = `args[${i}]`;

      // For ListNode parameters, use the conditional cyclic/linear logic
      if (baseType === 'ListNode') {
        expr = `deserialize_cyclic_linked_list(args[${i}].get("list"), args[${i}].get("pos")) if isinstance(args[${i}], dict) and "list" in args[${i}] and "pos" in args[${i}] else (deserialize_linked_list(args[${i}]) if isinstance(args[${i}], list) else args[${i}])`;
      } else if (baseType === 'TreeNode') {
        expr = `deserialize_tree(args[${i}]) if isinstance(args[${i}], list) else args[${i}]`;
      } else if (baseType === 'Node') {
        expr = `deserialize_node(args[${i}]) if isinstance(args[${i}], list) else args[${i}]`;
      } else if (baseType === 'NestedInteger') {
        expr = `deserialize_nested_integer(args[${i}])`;
      } else {
        // Fallback: use existing heuristics based on parameter name
        if (lowerName === 'head' || lowerName === 'list') {
          expr = `deserialize_linked_list(args[${i}]) if isinstance(args[${i}], list) else args[${i}]`;
        } else if (lowerName === 'root' || lowerName === 'tree') {
          expr = `deserialize_tree(args[${i}]) if isinstance(args[${i}], list) else args[${i}]`;
        } else if (lowerName.includes('graph') || lowerName.includes('adj')) {
          expr = `deserialize_graph(args[${i}]) if isinstance(args[${i}], list) else args[${i}]`;
        } else if (lowerName === 'node' || lowerName === 'random') {
          expr = `deserialize_node(args[${i}]) if isinstance(args[${i}], list) else args[${i}]`;
        } else if (lowerName.includes('nested')) {
          expr = `deserialize_nested_integer(args[${i}])`;
        }
      }

      lines.push(`        arg_${i} = ${expr}`);
    }
    return lines.join('\n');
  }

  _getBaseType(typeStr) {
    if (!typeStr) return 'Any';
    let cleaned = typeStr;
    if (cleaned.includes(' | None')) {
      cleaned = cleaned.split(' | None')[0];
    } else if (cleaned.startsWith('Optional[') && cleaned.endsWith(']')) {
      cleaned = cleaned.slice(9, -1);
    } else if (cleaned.startsWith('Union[') && cleaned.endsWith(']')) {
      const inner = cleaned.slice(6, -1);
      const parts = inner.split(',');
      const nonNone = parts.find(p => p.trim() !== 'None');
      if (nonNone) cleaned = nonNone.trim();
    }
    const bracketIndex = cleaned.indexOf('[');
    if (bracketIndex !== -1) {
      cleaned = cleaned.substring(0, bracketIndex);
    }
    return cleaned;
  }

  _generateStandardCall(className, methodName, parameters) {
    const argNames = parameters.map((_, i) => `arg_${i}`).join(', ');
    if (className) {
      return `        obj = ${className}()
        result = obj.${methodName}(${argNames})`;
    } else {
      return `        result = ${methodName}(${argNames})`;
    }
  }

  _generateInteractive(className, constructorParams, methods) {
    const constrArgs = constructorParams.map((_, i) => `constr_args[${i}]`).join(', ');
    const dispatchLines = [];
    for (const m of methods) {
      const paramCount = m.parameters.length;
      const argsPlaceholder = paramCount > 0 ? `*method_args` : '';
      dispatchLines.push(`            if method_name == "${m.name}":`);
      dispatchLines.push(`                try:`);
      dispatchLines.push(`                    res = obj.${m.name}(${argsPlaceholder})`);
      dispatchLines.push(`                    results.append(res)`);
      dispatchLines.push(`                except Exception as e:`);
      dispatchLines.push(`                    sys.stderr.write(str(e))`);
      dispatchLines.push(`                    results.append(None)`);
      dispatchLines.push(`                continue`);
    }
    dispatchLines.push(`            results.append(None)  # unknown method`);

    const interactiveCode = `
def solve(input_str):
    import json
    import sys
    try:
        data = json.loads(input_str)
        constr_args = data.get("constructor", [])
        methods_list = data.get("methods", [])
        results = [None]
        obj = ${className}(${constrArgs})
        for call in methods_list:
            if not isinstance(call, list) or len(call) == 0:
                results.append(None)
                continue
            method_name = call[0]
            method_args = call[1:]
            ${dispatchLines.join('\n')}
        return json.dumps(results)
    except Exception as e:
        sys.stderr.write(str(e))
        return "null"
`;
    return interactiveCode;
  }

  _buildNonInteractiveMain(deserCode, callCode, returnType, methodName, className) {
    // Special case for Codec (serialization/deserialization) – keep original
    if (className === 'Codec') {
      return `
def solve(input_str):
    import json
    import sys
    try:
        data = json.loads(input_str)
        args = data.get("args", [])
        if len(args) > 0:
            root_arg = args[0]
            root = deserialize_tree(root_arg) if isinstance(root_arg, list) else None
        else:
            root = None
        codec = Codec()
        serialized = codec.serialize(root)
        result = codec.deserialize(serialized)
        if result is None:
            return "[]"
        return json.dumps(serialize_tree(result))
    except Exception as e:
        sys.stderr.write(str(e))
        return "null"

if __name__ == "__main__":
    import sys
    input_data = sys.stdin.read()
    output = solve(input_data)
    sys.stdout.write(output)
`;
    }

    // Modified main block with proper void handling
    return `
def solve(input_str):
    import json
    import sys
    try:
        data = json.loads(input_str)
        args = data.get("args", [])
        raw_args = args.copy()
${deserCode}
${callCode}
        # If the method returns None (void) but modifies the first argument,
        # serialise that argument (TreeNode, ListNode, Node) as the result.
        if result is None:
            first_arg = arg_0 if 'arg_0' in locals() else None
            if first_arg is not None and hasattr(first_arg, '__class__'):
                class_name = first_arg.__class__.__name__
                if class_name in ('ListNode', 'TreeNode', 'Node'):
                    if class_name == 'ListNode':
                        return json.dumps(serialize_linked_list(first_arg))
                    elif class_name == 'TreeNode':
                        return json.dumps(serialize_tree(first_arg))
                    elif class_name == 'Node':
                        return json.dumps(serialize_node(first_arg))
            # Fallback: if raw input was an empty list, output empty list
            if len(raw_args) > 0 and isinstance(raw_args[0], list) and len(raw_args[0]) == 0:
                return "[]"
            return "null"
        if isinstance(result, (ListNode, TreeNode, Node, NestedInteger)):
            if isinstance(result, ListNode):
                return json.dumps(serialize_linked_list(result))
            elif isinstance(result, TreeNode):
                return json.dumps(serialize_tree(result))
            elif isinstance(result, Node):
                return json.dumps(serialize_node(result))
            elif isinstance(result, NestedInteger):
                return json.dumps(serialize_nested_integer(result))
        else:
            return json.dumps(result, default=str)
    except Exception as e:
        sys.stderr.write(str(e))
        return "null"

if __name__ == "__main__":
    import sys
    input_data = sys.stdin.read()
    output = solve(input_data)
    sys.stdout.write(output)
`;
  }

  _generateImports(metadata) {
    const standardImports = [
      'import json',
      'import sys',
      'import math',
      'import bisect',
      'import heapq',
      'import itertools',
      'import functools',
      'import copy',
      'from collections import defaultdict, deque, Counter, OrderedDict',
      'from typing import List, Optional, Dict, Any, Set, Tuple, Union, Callable',
      'from itertools import accumulate, product, combinations, permutations',
      'from functools import reduce'
    ];
    return standardImports.join('\n');
  }
}

module.exports = PythonGenerator;