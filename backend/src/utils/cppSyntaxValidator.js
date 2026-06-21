/**
 * src/utils/cppSyntaxValidator.js
 *
 * Validates C++ code syntax using the system's C++ compiler.
 * We explicitly use -std=c++14 to match the default standard used by
 * the OnlineCompiler.io provider (g++-15 default is pre-C++17).
 * This ensures that local validation catches C++17 features early.
 *
 * To avoid "undeclared identifier" errors for data structures like ListNode,
 * we prepend the contents of structures.h (which defines all required types)
 * before running the syntax check.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { prependCppAutoIncludes } = require('./autoImports');

// Read and cache the structures header (defines ListNode, TreeNode, Node, etc.)
const STRUCTURES_HEADER_PATH = path.join(
  __dirname,
  '../services/codeExecution/helpers/cpp/structures.h'
);
let structuresHeader = null;

try {
  structuresHeader = fs.readFileSync(STRUCTURES_HEADER_PATH, 'utf8');
} catch (err) {
  console.warn('[cppSyntaxValidator] Could not read structures.h:', err.message);
  // Fallback to a minimal definition if the file is missing (should not happen in production)
  structuresHeader = `
    struct ListNode { int val; ListNode *next; ListNode() : val(0), next(nullptr) {} ListNode(int x) : val(x), next(nullptr) {} ListNode(int x, ListNode *next) : val(x), next(next) {} };
    struct TreeNode { int val; TreeNode *left; TreeNode *right; TreeNode() : val(0), left(nullptr), right(nullptr) {} TreeNode(int x) : val(x), left(nullptr), right(nullptr) {} TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {} };
    struct Node { int val; std::vector<Node*> neighbors; Node* next; Node* random; Node() : val(0), next(nullptr), random(nullptr) {} Node(int _val) : val(_val), next(nullptr), random(nullptr) {} Node(int _val, std::vector<Node*> _neighbors) : val(_val), neighbors(_neighbors), next(nullptr), random(nullptr) {} Node(int _val, Node* _next, Node* _random) : val(_val), next(_next), random(_random) {} };
    class NestedInteger { private: int value; std::vector<NestedInteger> list; bool isInt; public: NestedInteger() : isInt(false) {} NestedInteger(int val) : value(val), isInt(true) {} bool isInteger() const { return isInt; } int getInteger() const { return value; } void setInteger(int val) { value = val; isInt = true; list.clear(); } void add(const NestedInteger& ni) { list.push_back(ni); } const std::vector<NestedInteger>& getList() const { return list; } };
  `;
}

/**
 * Detect available C++ compiler.
 * @returns {string|null} Compiler command or null if none found.
 */
function getCppCompiler() {
  const candidates = ['g++', 'clang++'];
  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: 'ignore', shell: true });
      return cmd;
    } catch (e) {
      // continue
    }
  }
  return null;
}

/**
 * Validates C++ code syntax using the compiler's -fsyntax-only flag.
 * Prepends the data structure definitions (structures.h) to the user's code,
 * and also ensures standard includes and using namespace std; are present.
 * Forces -std=c++14 to align with the execution provider's default.
 *
 * @param {string} code - C++ source code
 * @returns {string|null} Clean error message if invalid, otherwise null.
 */
function validateCppSyntax(code) {
  const compiler = getCppCompiler();
  if (!compiler) {
    return 'C++ compiler not found. Please install g++ or clang++ and ensure it is in PATH.';
  }

  // 1. Add auto-includes (standard headers and using namespace std)
  let fullCode = prependCppAutoIncludes(code);

  // 2. Prepend the structures header to define ListNode, TreeNode, etc.
  fullCode = structuresHeader + '\n\n' + fullCode;

  const tempFile = path.join(os.tmpdir(), `_syntax_check_${Date.now()}.cpp`);
  try {
    fs.writeFileSync(tempFile, fullCode, 'utf8');
    // Use -fsyntax-only to check syntax without generating output.
    // Force -std=c++14 to match the default standard used by onlinecompiler.io (g++-15 default is C++14 or earlier).
    execSync(`${compiler} -std=c++14 -fsyntax-only "${tempFile}"`, { stdio: 'pipe', shell: true });
    return null;
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    // Extract the first relevant error line
    const lines = stderr.split('\n');
    let errorMsg = lines.find(line =>
      line.includes('error:') ||
      line.includes('Error') ||
      line.includes('syntax error')
    );
    if (!errorMsg) errorMsg = stderr.substring(0, 200);
    // Remove the temporary filename from the error message
    errorMsg = errorMsg.replace(/\(_syntax_check_[^)]+\.cpp, /g, '(');
    errorMsg = errorMsg.replace(/_syntax_check_[^:]+:/g, '');
    return errorMsg;
  } finally {
    try { fs.unlinkSync(tempFile); } catch (e) { /* ignore */ }
  }
}

module.exports = { validateCppSyntax };