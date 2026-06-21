const fs = require('fs');
const path = require('path');

/**
 * JsGenerator – Produces a runnable JavaScript/Node.js program from user code and metadata.
 * Injects required helper functions and a main() entry point with error handling.
 */
class JsGenerator {
  generateWrapper(userCode, metadata, testCases) {
    if (!userCode || typeof userCode !== 'string') {
      throw new Error('Invalid user code');
    }
    if (!metadata || !metadata.methodName) {
      throw new Error('Invalid metadata: missing methodName');
    }

    const helpersCode = this._getRequiredHelpers(metadata.dataStructures || []);
    const { deserCode, callCode, interactiveMain } = this._generateExecutionCode(metadata);
    const finalScript = `${helpersCode}\n\n${userCode}\n\n${interactiveMain || this._buildNonInteractiveMain(deserCode, callCode)}\n`;

    return finalScript;
  }

  _getRequiredHelpers(dataStructures) {
    if (!dataStructures.length) return '';
    const helpersPath = path.join(__dirname, '../helpers/js/structures.js');
    try {
      return fs.readFileSync(helpersPath, 'utf-8');
    } catch (err) {
      console.warn(`Could not read structures.js: ${err.message}`);
      return this._fallbackHelpers();
    }
  }

  _fallbackHelpers() {
    return `
// Minimal data structure helpers (production version should use structures.js)
class ListNode { constructor(val, next) { this.val = val === undefined ? 0 : val; this.next = next === undefined ? null : next; } }
class TreeNode { constructor(val, left, right) { this.val = val === undefined ? 0 : val; this.left = left === undefined ? null : left; this.right = right === undefined ? null : right; } }
class Node { constructor(val, neighbors, next, random) { this.val = val === undefined ? 0 : val; this.neighbors = neighbors === undefined ? [] : neighbors; this.next = next === undefined ? null : next; this.random = random === undefined ? null : random; } }
class NestedInteger { constructor(value) { this._isInt = (value !== undefined && typeof value === 'number'); this._value = this._isInt ? value : null; this._list = this._isInt ? null : []; } isInteger() { return this._isInt; } getInteger() { return this._value; } setInteger(value) { this._isInt = true; this._value = value; this._list = null; } add(ni) { if (this._isInt) { this._isInt = false; this._list = []; this._value = null; } this._list.push(ni); } getList() { return this._list || []; } }
function deserializeLinkedList(arr) { if (!arr) return null; let head = new ListNode(arr[0]); let cur = head; for (let i=1;i<arr.length;i++) { cur.next = new ListNode(arr[i]); cur = cur.next; } return head; }
function deserializeCyclicLinkedList(data) {
    if (!data) return null;
    if (Array.isArray(data)) return deserializeLinkedList(data);
    if (typeof data === 'object' && data !== null) {
        const list = data.list;
        const pos = data.pos;
        if (!Array.isArray(list) || pos === undefined) return null;
        if (list.length === 0) return null;
        const head = deserializeLinkedList(list);
        if (!head) return null;
        if (pos === -1) return head;
        if (pos < 0 || pos >= list.length) return head;
        let tail = head;
        while (tail.next) tail = tail.next;
        let posNode = head;
        for (let i = 0; i < pos; i++) {
            if (posNode.next) posNode = posNode.next;
            else return head;
        }
        tail.next = posNode;
        return head;
    }
    return null;
}
function serializeLinkedList(head) {
    const res = [];
    const visited = new Set();
    let cur = head;
    while (cur && !visited.has(cur)) {
        visited.add(cur);
        res.push(cur.val);
        cur = cur.next;
    }
    return res;
}
function deserializeTree(arr) { if (!arr.length) return null; let nodes = arr.map(v => v===null?null:new TreeNode(v)); let kids = nodes.slice().reverse(); let root = kids.pop(); for (let node of nodes) { if (node) { if (kids.length) node.left = kids.pop(); if (kids.length) node.right = kids.pop(); } } return root; }
function serializeTree(root) { if (!root) return []; let q = [root]; let res = []; while (q.length) { let node = q.shift(); if (node) { res.push(node.val); q.push(node.left); q.push(node.right); } else { res.push(null); } } while (res.length && res[res.length-1] === null) res.pop(); return res; }
function deserializeGraph(adjList) { if (!adjList) return null; let nodes = {}; for (let i=0;i<adjList.length;i++) { let val=i+1; if(!nodes[val]) nodes[val]=new Node(val); for(let nb of adjList[i]) { if(!nodes[nb]) nodes[nb]=new Node(nb); nodes[val].neighbors.push(nodes[nb]); } } return nodes[1]; }
function serializeGraph(node) { if (!node) return []; let visited=new Set(), order=[], q=[node]; while(q.length){ let cur=q.shift(); if(visited.has(cur.val)) continue; visited.add(cur.val); order.push(cur); for(let nb of cur.neighbors) q.push(nb); } order.sort((a,b)=>a.val-b.val); let idx={}; order.forEach((n,i)=>idx[n.val]=i+1); return order.map(n=>n.neighbors.map(nb=>idx[nb.val])); }
function deserializeRandomList(arr) { if(!arr) return null; let nodes=arr.map(pair=>new Node(pair[0])); for(let i=0;i<nodes.length-1;i++) nodes[i].next=nodes[i+1]; for(let i=0;i<arr.length;i++) { if(arr[i][1]!==null) nodes[i].random=nodes[arr[i][1]]; } return nodes[0]; }
function serializeRandomList(head) { if(!head) return []; let idx=new Map(), cur=head, i=0; while(cur){ idx.set(cur,i++); cur=cur.next; } let res=[]; cur=head; while(cur){ res.push([cur.val, idx.get(cur.random)??null]); cur=cur.next; } return res; }
function deserializeNode(obj){ if(!obj) return null; if(Array.isArray(obj) && obj.length && Array.isArray(obj[0]) && obj[0].length===2) return deserializeRandomList(obj); return deserializeGraph(obj); }
function serializeNode(node){ if(!node) return []; if(node.next!==undefined && node.next!==null) return serializeRandomList(node); return serializeGraph(node); }
function deserializeNestedInteger(data){ if(typeof data==='number') return new NestedInteger(data); if(Array.isArray(data)){ let ni=new NestedInteger(); for(let item of data) ni.add(deserializeNestedInteger(item)); return ni; } return new NestedInteger(); }
function serializeNestedInteger(ni){ if(ni.isInteger()) return ni.getInteger(); return ni.getList().map(child=>serializeNestedInteger(child)); }
`;
  }

  _generateExecutionCode(metadata) {
    const { interactive, className, constructorParams, methods, parameters } = metadata;
    if (interactive) {
      return this._generateInteractive(className, constructorParams, methods);
    } else {
      const deserCode = this._generateDeserialization(parameters);
      const callCode = this._generateStandardCall(className, metadata.methodName, parameters);
      return { deserCode, callCode, interactiveMain: null };
    }
  }

  /**
   * Generate JavaScript deserialisation code for the given parameters.
   * For linked-list parameters, we use deserializeCyclicLinkedList which handles
   * both plain arrays and objects with "list"/"pos".
   */
  _generateDeserialization(parameters) {
    if (!parameters.length) return '';
    const lines = [];
    for (let i = 0; i < parameters.length; i++) {
      const param = parameters[i];
      const paramName = param.name;
      const lowerName = (paramName || '').toLowerCase();
      const baseType = this._getBaseType(param.type);

      let expr = `args[${i}]`;

      // For ListNode parameters (based on type or name heuristics), use the cyclic deserializer
      const isListNode = baseType === 'ListNode' || lowerName === 'head' || lowerName === 'list';
      
      if (isListNode) {
        expr = `deserializeCyclicLinkedList(args[${i}])`;
      } else if (baseType === 'TreeNode' || lowerName === 'root' || lowerName === 'tree') {
        expr = `deserializeTree(args[${i}])`;
      } else if (baseType === 'Node' || lowerName.includes('graph') || lowerName.includes('adj') || lowerName === 'node' || lowerName === 'random') {
        expr = `deserializeNode(args[${i}])`;
      } else if (baseType === 'NestedInteger' || lowerName.includes('nested')) {
        expr = `deserializeNestedInteger(args[${i}])`;
      }
      
      lines.push(`    const arg${i} = ${expr};`);
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
    const argNames = parameters.map((_, i) => `arg${i}`).join(', ');
    if (className) {
      return `    let result;
    try {
        const obj = new ${className}();
        result = obj.${methodName}(${argNames});
    } catch (err) {
        process.stderr.write(err.toString());
        result = null;
    }`;
    } else {
      return `    let result;
    try {
        result = ${methodName}(${argNames});
    } catch (err) {
        process.stderr.write(err.toString());
        result = null;
    }`;
    }
  }

  _generateInteractive(className, constructorParams, methods) {
    const constrArgs = constructorParams.map((_, i) => `constrArgs[${i}]`).join(', ');
    const dispatchLines = [];
    for (const m of methods) {
      const paramCount = m.parameters.length;
      const argsPlaceholder = paramCount > 0 ? `...methodArgs` : '';
      dispatchLines.push(`        if (methodName === "${m.name}") {`);
      dispatchLines.push(`            try {`);
      dispatchLines.push(`                const res = obj.${m.name}(${argsPlaceholder});`);
      dispatchLines.push(`                results.push(res);`);
      dispatchLines.push(`            } catch (err) {`);
      dispatchLines.push(`                process.stderr.write(err.toString());`);
      dispatchLines.push(`                results.push(null);`);
      dispatchLines.push(`            }`);
      dispatchLines.push(`        } else`);
    }
    dispatchLines.push(`        {`);
    dispatchLines.push(`            results.push(null);`);
    dispatchLines.push(`        }`);

    const interactiveCode = `
function solve(inputStr) {
    let data;
    try {
        data = JSON.parse(inputStr);
    } catch (err) {
        process.stderr.write(err.toString());
        return "[]";
    }
    const constrArgs = data.constructor || [];
    const methodsList = data.methods || [];
    const results = [null];
    let obj;
    try {
        obj = new ${className}(${constrArgs});
    } catch (err) {
        process.stderr.write(err.toString());
        return JSON.stringify([]);
    }
    for (const call of methodsList) {
        if (!Array.isArray(call) || call.length === 0) {
            results.push(null);
            continue;
        }
        const methodName = call[0];
        const methodArgs = call.slice(1);
        ${dispatchLines.join('\n        ')}
    }
    return JSON.stringify(results);
}
`;
    return { deserCode: '', callCode: '', interactiveMain: interactiveCode };
  }

  _buildNonInteractiveMain(deserCode, callCode) {
    return `
function solve(inputStr) {
    let parsed;
    try {
        parsed = JSON.parse(inputStr);
    } catch (err) {
        process.stderr.write(err.toString());
        return "null";
    }
    const args = parsed.args || [];
    ${deserCode}
    ${callCode}
    // Serialise result using appropriate helper
    if (result && typeof result === 'object') {
        if (result.val !== undefined && result.next !== undefined) {
            return JSON.stringify(serializeLinkedList(result));
        }
        if (result.val !== undefined && (result.left !== undefined || result.right !== undefined)) {
            return JSON.stringify(serializeTree(result));
        }
        if (result.val !== undefined && result.neighbors !== undefined) {
            return JSON.stringify(serializeGraph(result));
        }
        if (result.val !== undefined && (result.next !== undefined || result.random !== undefined)) {
            return JSON.stringify(serializeRandomList(result));
        }
        if (result.isInteger && result.getList) {
            return JSON.stringify(serializeNestedInteger(result));
        }
    }
    return JSON.stringify(result);
}

if (require.main === module) {
    let input = '';
    process.stdin.on('data', chunk => input += chunk);
    process.stdin.on('end', () => {
        const output = solve(input);
        process.stdout.write(output);
    });
}
`;
  }
}

module.exports = JsGenerator;