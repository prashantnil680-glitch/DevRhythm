import json
from collections import deque
from typing import List, Optional, Any, Dict, Set, Tuple

# ----------------------------------------------------------------------
# ListNode Helpers
# ----------------------------------------------------------------------
class ListNode:
    def __init__(self, val: int = 0, next: 'ListNode' = None):
        self.val = val
        self.next = next

def deserialize_linked_list(arr: List[int]) -> Optional[ListNode]:
    if not arr:
        return None
    head = ListNode(arr[0])
    curr = head
    for val in arr[1:]:
        curr.next = ListNode(val)
        curr = curr.next
    return head

def serialize_linked_list(head: Optional[ListNode]) -> List[int]:
    res = []
    curr = head
    while curr:
        res.append(curr.val)
        curr = curr.next
    return res

# ----------------------------------------------------------------------
# TreeNode Helpers (level‑order with nulls)
# ----------------------------------------------------------------------
class TreeNode:
    def __init__(self, val: int = 0, left: 'TreeNode' = None, right: 'TreeNode' = None):
        self.val = val
        self.left = left
        self.right = right

def deserialize_tree(arr: List[Optional[int]]) -> Optional[TreeNode]:
    if not arr:
        return None
    nodes = [TreeNode(v) if v is not None else None for v in arr]
    kids = nodes[::-1]
    root = kids.pop()
    for node in nodes:
        if node:
            if kids:
                node.left = kids.pop()
            if kids:
                node.right = kids.pop()
    return root

def serialize_tree(root: Optional[TreeNode]) -> List[Optional[int]]:
    if not root:
        return []
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

# ----------------------------------------------------------------------
# Generic Node – supports both graph and random list
# ----------------------------------------------------------------------
class Node:
    def __init__(self, val: int = 0, neighbors: List['Node'] = None, next: 'Node' = None, random: 'Node' = None):
        self.val = val
        self.neighbors = neighbors if neighbors is not None else []
        self.next = next
        self.random = random

def deserialize_graph(adj_list: List[List[int]]) -> Optional[Node]:
    if not adj_list:
        return None
    nodes = {}
    for i, neighbors in enumerate(adj_list):
        node_val = i + 1
        if node_val not in nodes:
            nodes[node_val] = Node(node_val)
        for nb_val in neighbors:
            if nb_val not in nodes:
                nodes[nb_val] = Node(nb_val)
            nodes[node_val].neighbors.append(nodes[nb_val])
    return nodes[1] if nodes else None

def serialize_graph(node: Optional[Node]) -> List[List[int]]:
    if not node:
        return []
    visited = set()
    order = []
    q = deque([node])
    while q:
        cur = q.popleft()
        if cur.val in visited:
            continue
        visited.add(cur.val)
        order.append(cur)
        for nb in cur.neighbors:
            if nb.val not in visited:
                q.append(nb)
    order.sort(key=lambda n: n.val)
    mapping = {n: i+1 for i, n in enumerate(order)}  # 1‑based index
    res = []
    for n in order:
        neighbor_vals = [mapping[nb] for nb in n.neighbors]
        res.append(neighbor_vals)
    return res

def deserialize_random_list(arr: List[List[Optional[int]]]) -> Optional[Node]:
    if not arr:
        return None
    nodes = [Node(pair[0]) for pair in arr]
    for i in range(len(nodes) - 1):
        nodes[i].next = nodes[i+1]
    for i, pair in enumerate(arr):
        if pair[1] is not None:
            nodes[i].random = nodes[pair[1]]
    return nodes[0] if nodes else None

def serialize_random_list(head: Optional[Node]) -> List[List[Optional[int]]]:
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

def deserialize_node(obj: Any) -> Optional[Node]:
    """Auto‑detect Node type: graph (adjacency list) or random list."""
    if not obj:
        return None
    # Check for random list pattern: list of lists each with exactly 2 elements
    if (isinstance(obj, list) and len(obj) > 0 and
        isinstance(obj[0], list) and len(obj[0]) == 2):
        # Additional safety: for a random list, the random index (second element)
        # must be either None or an integer less than len(obj).
        is_random = True
        for pair in obj:
            if len(pair) != 2:
                is_random = False
                break
            idx = pair[1]
            if idx is not None and (not isinstance(idx, int) or idx >= len(obj)):
                is_random = False
                break
        if is_random:
            return deserialize_random_list(obj)
    # Otherwise treat as graph adjacency list
    return deserialize_graph(obj)

def serialize_node(node: Optional[Node]) -> Any:
    if not node:
        return []
    if node.next is not None:
        return serialize_random_list(node)
    else:
        return serialize_graph(node)

# ----------------------------------------------------------------------
# NestedInteger Helpers
# ----------------------------------------------------------------------
class NestedInteger:
    def __init__(self, value: Any = None):
        self.value = value
        self.list = []

    def isInteger(self) -> bool:
        return self.value is not None

    def getInteger(self) -> Any:
        return self.value

    def setInteger(self, value: int) -> None:
        self.value = value
        self.list = []

    def add(self, ni: 'NestedInteger') -> None:
        self.list.append(ni)

    def getList(self) -> List['NestedInteger']:
        return self.list

def deserialize_nested_integer(data: Any) -> NestedInteger:
    if isinstance(data, int):
        return NestedInteger(data)
    elif isinstance(data, list):
        ni = NestedInteger()
        for item in data:
            ni.add(deserialize_nested_integer(item))
        return ni
    else:
        return NestedInteger()

def serialize_nested_integer(ni: NestedInteger) -> Any:
    if ni.isInteger():
        return ni.getInteger()
    else:
        return [serialize_nested_integer(child) for child in ni.getList()]

# ----------------------------------------------------------------------
# Additional helpers for common collection types
# ----------------------------------------------------------------------
def deserialize_int_vector(arr: List[int]) -> List[int]:
    return arr

def serialize_int_vector(vec: List[int]) -> List[int]:
    return vec

def deserialize_int_vector_vector(arr: List[List[int]]) -> List[List[int]]:
    return arr

def serialize_int_vector_vector(vec: List[List[int]]) -> List[List[int]]:
    return vec

def deserialize_string_vector(arr: List[str]) -> List[str]:
    return arr

def serialize_string_vector(vec: List[str]) -> List[str]:
    return vec