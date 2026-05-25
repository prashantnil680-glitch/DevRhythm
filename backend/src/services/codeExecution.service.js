const CodeExecutionProviderFactory = require('./codeExecution/provider.factory');

let provider = null;

const getProvider = () => {
  if (!provider) provider = CodeExecutionProviderFactory.createProvider();
  return provider;
};

/**
 * Execute a single test case with given code and stdin.
 * @param {Object} params - { language, code, stdin }
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
const executeCode = async ({ language, code, stdin }) => {
  return getProvider().execute({ language, code, stdin });
};

/**
 * Execute multiple test cases in batch.
 * @param {Object} params - { language, code, testCases: [{ stdin }] }
 * @returns {Promise<Array<{stdout: string, stderr: string, exitCode: number}>>}
 */
const executeBatch = async ({ language, code, testCases }) => {
  return getProvider().executeBatch({ language, code, testCases });
};

module.exports = { executeCode, executeBatch };