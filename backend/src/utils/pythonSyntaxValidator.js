const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Validate Python code syntax using py_compile.
 * Returns a clean error message if invalid, otherwise null.
 *
 * @param {string} code - Python source code
 * @returns {string|null}
 */
function validatePythonSyntax(code) {
  // Use environment variable or fallback to 'python'
  let pythonCmd = process.env.PYTHON_EXECUTABLE || 'python';

  // Quick check: ensure python command exists
  try {
    execSync(`"${pythonCmd}" --version`, { stdio: 'ignore', shell: true });
  } catch {
    return 'Python interpreter not found. Please set PYTHON_EXECUTABLE in .env or install Python.';
  }

  const tempFile = path.join(os.tmpdir(), `_syntax_check_${Date.now()}.py`);
  try {
    fs.writeFileSync(tempFile, code, 'utf8');
    execSync(`"${pythonCmd}" -m py_compile "${tempFile}"`, { stdio: 'pipe', shell: true });
    return null;
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    // Extract the first relevant error line
    const lines = stderr.split('\n');
    let errorMsg = lines.find(line =>
      line.includes('Error:') ||
      line.includes('SyntaxError') ||
      line.includes('IndentationError') ||
      line.includes('TabError') ||
      line.includes('NameError')
    );
    if (!errorMsg) errorMsg = stderr.substring(0, 200);
    // Remove the temporary filename (e.g., _syntax_check_12345.py)
    errorMsg = errorMsg.replace(/\(_syntax_check_[^)]+\.py, /g, '(');
    return errorMsg;
  } finally {
    try { fs.unlinkSync(tempFile); } catch (e) { /* ignore */ }
  }
}

module.exports = { validatePythonSyntax };