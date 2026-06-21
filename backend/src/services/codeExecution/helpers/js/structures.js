/**
 * structures.js – Helper functions for data structure serialization/deserialization.
 * Injected into generated JavaScript wrappers.
 */

// ----------------------------------------------------------------------
// ListNode
// ----------------------------------------------------------------------
class ListNode {
    constructor(val, next) {
        this.val = val === undefined ? 0 : val;
        this.next = next === undefined ? null : next;
    }
}

function deserializeLinkedList(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    let head = new ListNode(arr[0]);
    let cur = head;
    for (let i = 1; i < arr.length; i++) {
        cur.next = new ListNode(arr[i]);
        cur = cur.next;
    }
    return head;
}

/**
 * Build a linked list from data that may include a cycle.
 * The data can be:
 *   - A plain array (fallback to deserializeLinkedList)
 *   - An object with "list" (array) and "pos" (integer) keys
 * If pos == -1, returns a linear list (no cycle).
 * If pos is a valid index, creates a cycle from the tail to the node at pos.
 */
function deserializeCyclicLinkedList(data) {
    if (!data) return null;
    
    // If it's a plain array, use the standard deserializer
    if (Array.isArray(data)) {
        return deserializeLinkedList(data);
    }
    
    // If it's an object with "list" and "pos"
    if (typeof data === 'object' && data !== null) {
        const list = data.list;
        const pos = data.pos;
        
        if (!Array.isArray(list) || pos === undefined) return null;
        if (list.length === 0) return null;
        
        // Build linear list
        const head = deserializeLinkedList(list);
        if (!head) return null;
        
        // If pos == -1, return linear list (no cycle)
        if (pos === -1) return head;
        
        // If pos out of bounds, return linear list
        if (pos < 0 || pos >= list.length) return head;
        
        // Find tail
        let tail = head;
        while (tail.next) {
            tail = tail.next;
        }
        
        // Find node at position pos
        let posNode = head;
        for (let i = 0; i < pos; i++) {
            if (posNode.next) {
                posNode = posNode.next;
            } else {
                return head; // safety fallback
            }
        }
        
        // Create cycle
        tail.next = posNode;
        return head;
    }
    
    return null;
}

function serializeLinkedList(head) {
    const res = [];
    // To avoid infinite loops on cyclic lists, track visited nodes
    const visited = new Set();
    let cur = head;
    while (cur && !visited.has(cur)) {
        visited.add(cur);
        res.push(cur.val);
        cur = cur.next;
    }
    return res;
}

// ----------------------------------------------------------------------
// TreeNode
// ----------------------------------------------------------------------
class TreeNode {
    constructor(val, left, right) {
        this.val = val === undefined ? 0 : val;
        this.left = left === undefined ? null : left;
        this.right = right === undefined ? null : right;
    }
}

function deserializeTree(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const nodes = arr.map(v => (v === null ? null : new TreeNode(v)));
    const kids = nodes.slice().reverse();
    const root = kids.pop();
    for (const node of nodes) {
        if (node) {
            if (kids.length) node.left = kids.pop();
            if (kids.length) node.right = kids.pop();
        }
    }
    return root;
}

function serializeTree(root) {
    if (!root) return [];
    const q = [root];
    const res = [];
    while (q.length) {
        const node = q.shift();
        if (node) {
            res.push(node.val);
            q.push(node.left);
            q.push(node.right);
        } else {
            res.push(null);
        }
    }
    while (res.length && res[res.length - 1] === null) res.pop();
    return res;
}

// ----------------------------------------------------------------------
// Node (supports both graph and random list)
// ----------------------------------------------------------------------
class Node {
    constructor(val, neighbors, next, random) {
        this.val = val === undefined ? 0 : val;
        this.neighbors = neighbors === undefined ? [] : neighbors;
        this.next = next === undefined ? null : next;
        this.random = random === undefined ? null : random;
    }
}

// Graph variant
function deserializeGraph(adjList) {
    if (!Array.isArray(adjList) || adjList.length === 0) return null;
    const nodes = {};
    for (let i = 0; i < adjList.length; i++) {
        const nodeVal = i + 1;
        if (!nodes[nodeVal]) nodes[nodeVal] = new Node(nodeVal);
        const neighbors = adjList[i];
        for (const nbVal of neighbors) {
            if (!nodes[nbVal]) nodes[nbVal] = new Node(nbVal);
            nodes[nodeVal].neighbors.push(nodes[nbVal]);
        }
    }
    return nodes[1];
}

function serializeGraph(node) {
    if (!node) return [];
    const visited = new Set();
    const order = [];
    const q = [node];
    while (q.length) {
        const cur = q.shift();
        if (visited.has(cur.val)) continue;
        visited.add(cur.val);
        order.push(cur);
        for (const nb of cur.neighbors) q.push(nb);
    }
    order.sort((a, b) => a.val - b.val);
    const idx = {};
    order.forEach((n, i) => { idx[n.val] = i + 1; });
    return order.map(n => n.neighbors.map(nb => idx[nb.val]));
}

// Random list variant
function deserializeRandomList(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const nodes = arr.map(pair => new Node(pair[0]));
    for (let i = 0; i < nodes.length - 1; i++) {
        nodes[i].next = nodes[i + 1];
    }
    for (let i = 0; i < arr.length; i++) {
        const randomIndex = arr[i][1];
        if (randomIndex !== null && randomIndex !== undefined) {
            nodes[i].random = nodes[randomIndex];
        }
    }
    return nodes[0];
}

function serializeRandomList(head) {
    if (!head) return [];
    const idx = new Map();
    let cur = head;
    let i = 0;
    while (cur) {
        idx.set(cur, i++);
        cur = cur.next;
    }
    const res = [];
    cur = head;
    while (cur) {
        res.push([cur.val, idx.get(cur.random) ?? null]);
        cur = cur.next;
    }
    return res;
}

// Auto‑detection dispatcher
function deserializeNode(obj) {
    if (!obj) return null;
    // If obj is an array of arrays where each inner array has length 2 -> random list
    if (Array.isArray(obj) && obj.length && Array.isArray(obj[0]) && obj[0].length === 2) {
        return deserializeRandomList(obj);
    }
    // Otherwise treat as graph adjacency list
    return deserializeGraph(obj);
}

function serializeNode(node) {
    if (!node) return [];
    // Heuristic: if node has 'next' property (non‑null) treat as random list
    if (node.next !== undefined && node.next !== null) {
        return serializeRandomList(node);
    } else {
        return serializeGraph(node);
    }
}

// ----------------------------------------------------------------------
// NestedInteger
// ----------------------------------------------------------------------
class NestedInteger {
    constructor(value) {
        if (value === undefined) {
            this._isInt = false;
            this._list = [];
            this._value = null;
        } else if (typeof value === 'number') {
            this._isInt = true;
            this._value = value;
            this._list = null;
        } else {
            this._isInt = false;
            this._list = [];
            this._value = null;
        }
    }

    isInteger() {
        return this._isInt;
    }

    getInteger() {
        return this._value;
    }

    setInteger(value) {
        this._isInt = true;
        this._value = value;
        this._list = null;
    }

    add(ni) {
        if (this._isInt) {
            // Converting integer to list
            this._isInt = false;
            this._list = [];
            this._value = null;
        }
        this._list.push(ni);
    }

    getList() {
        if (this._isInt) return [];
        return this._list;
    }
}

function deserializeNestedInteger(data) {
    if (typeof data === 'number') {
        return new NestedInteger(data);
    } else if (Array.isArray(data)) {
        const ni = new NestedInteger();
        for (const item of data) {
            ni.add(deserializeNestedInteger(item));
        }
        return ni;
    } else {
        return new NestedInteger();
    }
}

function serializeNestedInteger(ni) {
    if (ni.isInteger()) {
        return ni.getInteger();
    } else {
        return ni.getList().map(child => serializeNestedInteger(child));
    }
}

// ----------------------------------------------------------------------
// Collection helpers (optional, for completeness)
// ----------------------------------------------------------------------
function deserializeIntVector(arr) {
    return arr;
}

function serializeIntVector(vec) {
    return vec;
}

function deserializeIntVectorVector(arr) {
    return arr;
}

function serializeIntVectorVector(vec) {
    return vec;
}

function deserializeStringVector(arr) {
    return arr;
}

function serializeStringVector(vec) {
    return vec;
}

// Export for Node.js (if needed, but the wrapper will embed this whole file)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ListNode,
        deserializeLinkedList,
        deserializeCyclicLinkedList,
        serializeLinkedList,
        TreeNode,
        deserializeTree,
        serializeTree,
        Node,
        deserializeGraph,
        serializeGraph,
        deserializeRandomList,
        serializeRandomList,
        deserializeNode,
        serializeNode,
        NestedInteger,
        deserializeNestedInteger,
        serializeNestedInteger,
        deserializeIntVector,
        serializeIntVector,
        deserializeIntVectorVector,
        serializeIntVectorVector,
        deserializeStringVector,
        serializeStringVector,
    };
}