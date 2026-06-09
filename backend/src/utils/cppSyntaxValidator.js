const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { prependCppAutoIncludes } = require('./autoImports');

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
 * Validates C++ code syntax using compiler's -fsyntax-only flag.
 * Auto-includes standard headers and using namespace std; if missing.
 * @param {string} code - C++ source code
 * @returns {string|null} Clean error message if invalid, otherwise null.
 */
function validateCppSyntax(code) {
  const compiler = getCppCompiler();
  if (!compiler) {
    return 'C++ compiler not found. Please install g++ or clang++ and ensure it is in PATH.';
  }

  // Prepend auto-includes to ensure standard library types are recognized
  const fullCode = prependCppAutoIncludes(code);

  const tempFile = path.join(os.tmpdir(), `_syntax_check_${Date.now()}.cpp`);
  try {
    fs.writeFileSync(tempFile, fullCode, 'utf8');
    // Use -fsyntax-only to check syntax without generating output
    execSync(`${compiler} -fsyntax-only "${tempFile}"`, { stdio: 'pipe', shell: true });
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