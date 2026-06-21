import java.util.*;

// ----------------------------------------------------------------------
// ListNode
// ----------------------------------------------------------------------
class ListNode {
    int val;
    ListNode next;
    ListNode() {}
    ListNode(int val) { this.val = val; }
    ListNode(int val, ListNode next) { this.val = val; this.next = next; }
}

// ----------------------------------------------------------------------
// TreeNode
// ----------------------------------------------------------------------
class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;
    TreeNode() {}
    TreeNode(int val) { this.val = val; }
    TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }
}

// ----------------------------------------------------------------------
// Node (supports both graph and random list)
// ----------------------------------------------------------------------
class Node {
    int val;
    List<Node> neighbors;
    Node next;
    Node random;

    // Graph constructor
    Node() {
        this.neighbors = new ArrayList<>();
    }
    Node(int val) {
        this.val = val;
        this.neighbors = new ArrayList<>();
        this.next = null;
        this.random = null;
    }
    Node(int val, List<Node> neighbors) {
        this.val = val;
        this.neighbors = neighbors;
        this.next = null;
        this.random = null;
    }
    // Random list constructor (no neighbors)
    Node(int val, Node next, Node random) {
        this.val = val;
        this.next = next;
        this.random = random;
        this.neighbors = new ArrayList<>();
    }
}

// ----------------------------------------------------------------------
// NestedInteger
// ----------------------------------------------------------------------
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
}

// ----------------------------------------------------------------------
// Helper methods for serialization/deserialization
// ----------------------------------------------------------------------
public class Structures {

    // ---------- ListNode ----------
    public static ListNode deserializeListNode(Object obj) {
        if (obj == null) return null;
        List<?> list = (List<?>) obj;
        if (list.isEmpty()) return null;
        ListNode dummy = new ListNode(0);
        ListNode cur = dummy;
        for (Object val : list) {
            cur.next = new ListNode(((Number) val).intValue());
            cur = cur.next;
        }
        return dummy.next;
    }

    /**
     * Deserialize a linked list that may have a cycle.
     * Expects the input to be either:
     *   - A plain List (fallback to deserializeListNode)
     *   - A Map with "list" (List) and "pos" (Integer) keys
     * If pos == -1, returns a linear list (no cycle).
     * If pos is a valid index, creates a cycle from the tail to the node at pos.
     */
    public static ListNode deserializeCyclicListNode(Object obj) {
        if (obj == null) return null;
        
        // If it's a plain List, fall back to linear deserialization
        if (obj instanceof List) {
            return deserializeListNode(obj);
        }
        
        // If it's a Map with "list" and "pos"
        if (obj instanceof Map) {
            Map<?, ?> map = (Map<?, ?>) obj;
            Object listObj = map.get("list");
            Object posObj = map.get("pos");
            
            if (listObj == null || posObj == null) return null;
            if (!(listObj instanceof List)) return null;
            if (!(posObj instanceof Number)) return null;
            
            List<?> list = (List<?>) listObj;
            int pos = ((Number) posObj).intValue();
            
            if (list.isEmpty()) return null;
            
            // Build linear list
            ListNode dummy = new ListNode(0);
            ListNode cur = dummy;
            for (Object val : list) {
                cur.next = new ListNode(((Number) val).intValue());
                cur = cur.next;
            }
            ListNode head = dummy.next;
            
            // If pos == -1, return linear list (no cycle)
            if (pos == -1) return head;
            
            // If pos out of bounds, return linear list
            if (pos < 0 || pos >= list.size()) return head;
            
            // Find tail
            ListNode tail = head;
            while (tail.next != null) {
                tail = tail.next;
            }
            
            // Find node at position pos
            ListNode posNode = head;
            for (int i = 0; i < pos; i++) {
                if (posNode.next != null) {
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

    public static Object serializeListNode(ListNode head) {
        List<Integer> list = new ArrayList<>();
        // To avoid infinite loops on cyclic lists, track visited nodes by identity
        Set<ListNode> visited = new HashSet<>();
        ListNode cur = head;
        while (cur != null && !visited.contains(cur)) {
            visited.add(cur);
            list.add(cur.val);
            cur = cur.next;
        }
        return list;
    }

    // ---------- TreeNode ----------
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

    // ---------- Node (graph) ----------
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
                    if (!indexMap.containsKey(nb)) {
                        queue.offer(nb);
                    }
                }
            }
        }
        nodes.sort(Comparator.comparingInt(n -> n.val));
        List<List<Integer>> result = new ArrayList<>();
        for (Node n : nodes) {
            List<Integer> neighborVals = new ArrayList<>();
            for (Node nb : n.neighbors) {
                neighborVals.add(indexMap.get(nb));
            }
            result.add(neighborVals);
        }
        return result;
    }

    // ---------- Node (random list) ----------
    public static Node deserializeRandomListNode(Object obj) {
        if (obj == null) return null;
        List<?> list = (List<?>) obj;
        if (list.isEmpty()) return null;
        Node[] nodes = new Node[list.size()];
        for (int i = 0; i < list.size(); i++) {
            List<?> pair = (List<?>) list.get(i);
            int val = ((Number) pair.get(0)).intValue();
            nodes[i] = new Node(val);
        }
        for (int i = 0; i < nodes.length - 1; i++) {
            nodes[i].next = nodes[i+1];
        }
        for (int i = 0; i < list.size(); i++) {
            List<?> pair = (List<?>) list.get(i);
            Object randomIndexObj = pair.get(1);
            if (randomIndexObj != null) {
                int randomIdx = ((Number) randomIndexObj).intValue();
                nodes[i].random = nodes[randomIdx];
            }
        }
        return nodes[0];
    }

    public static Object serializeRandomListNode(Node head) {
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
            pair.add(cur.random != null ? indexMap.get(cur.random) : null);
            result.add(pair);
            cur = cur.next;
        }
        return result;
    }

    // ---------- Node auto‑detection ----------
    public static Node deserializeNode(Object obj) {
        if (obj == null) return null;
        if (obj instanceof List) {
            List<?> list = (List<?>) obj;
            if (!list.isEmpty() && list.get(0) instanceof List) {
                List<?> first = (List<?>) list.get(0);
                if (first.size() == 2 && (first.get(1) == null || first.get(1) instanceof Number)) {
                    return deserializeRandomListNode(obj);
                }
            }
            return deserializeGraphNode(obj);
        }
        return null;
    }

    public static Object serializeNode(Node node) {
        if (node == null) return new ArrayList<>();
        // Heuristic: if node has `next` field (non‑null) treat as random list
        if (node.next != null) {
            return serializeRandomListNode(node);
        } else {
            return serializeGraphNode(node);
        }
    }

    // ---------- NestedInteger ----------
    public static NestedInteger deserializeNestedInteger(Object obj) {
        if (obj == null) return new NestedInteger();
        if (obj instanceof Number) {
            return new NestedInteger(((Number) obj).intValue());
        } else if (obj instanceof List) {
            NestedInteger ni = new NestedInteger();
            for (Object item : (List<?>) obj) {
                ni.add(deserializeNestedInteger(item));
            }
            return ni;
        }
        return new NestedInteger();
    }

    public static Object serializeNestedInteger(NestedInteger ni) {
        if (ni.isInteger()) {
            return ni.getInteger();
        } else {
            List<Object> list = new ArrayList<>();
            for (NestedInteger child : ni.getList()) {
                list.add(serializeNestedInteger(child));
            }
            return list;
        }
    }

    // ---------- Collection helpers ----------
    public static List<Integer> deserializeIntVector(Object obj) {
        if (obj == null) return new ArrayList<>();
        List<?> list = (List<?>) obj;
        List<Integer> result = new ArrayList<>();
        for (Object item : list) {
            result.add(((Number) item).intValue());
        }
        return result;
    }

    public static Object serializeIntVector(List<Integer> vec) {
        return vec;
    }

    public static List<List<Integer>> deserializeIntVectorVector(Object obj) {
        if (obj == null) return new ArrayList<>();
        List<?> outer = (List<?>) obj;
        List<List<Integer>> result = new ArrayList<>();
        for (Object inner : outer) {
            result.add(deserializeIntVector(inner));
        }
        return result;
    }

    public static Object serializeIntVectorVector(List<List<Integer>> vec) {
        return vec;
    }

    public static List<String> deserializeStringVector(Object obj) {
        if (obj == null) return new ArrayList<>();
        List<?> list = (List<?>) obj;
        List<String> result = new ArrayList<>();
        for (Object item : list) {
            result.add(item.toString());
        }
        return result;
    }

    public static Object serializeStringVector(List<String> vec) {
        return vec;
    }
}