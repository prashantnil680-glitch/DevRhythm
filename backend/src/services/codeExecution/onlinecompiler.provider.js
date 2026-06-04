const axios = require('axios');
const BaseCodeExecutionProvider = require('./base.provider');

class OnlineCompilerProvider extends BaseCodeExecutionProvider {
  constructor(apiUrl, apiKey, timeout = 30000) {
    super();
    this.apiUrl = apiUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.timeout = timeout;
    this.isFirstLog = true;
  }

  mapLanguage(language) {
    const map = {
      cpp: 'g++-15',
      python: 'python-3.14',
      java: 'openjdk-25',
      javascript: 'nodejs',
    };
    const mapped = map[language];
    if (!mapped) {
      throw new Error(`Unsupported language for onlinecompiler.io: ${language}`);
    }
    return mapped;
  }

  async execute({ language, code, stdin }) {
    if (!this.apiUrl || !this.apiKey) {
      throw new Error('OnlineCompiler API URL or API key not configured');
    }

    if (this.isFirstLog) {
      this.isFirstLog = false;
      console.log('[OnlineCompilerProvider] First execution, language:', language);
    }

    const compiler = this.mapLanguage(language);
    const payload = {
      compiler: compiler,
      code: code,
      input: stdin || '',
    };

    const url = `${this.apiUrl}/api/run-code-sync/`;

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
      });

      const data = response.data;
      // console.log('[OnlineCompilerProvider] API response:', JSON.stringify(data, null, 2));

      let stdout = '';
      let stderr = '';
      let exitCode = 0;

      // 1. Extract stdout
      if (data.output !== undefined) stdout = String(data.output);
      else if (data.stdout !== undefined) stdout = String(data.stdout);

      // 2. Extract stderr from various possible fields (nested)
      const errorSources = [
        data.stderr,
        data.error,
        data.message,
        data.err,
        data.exception,
        data.compilationError,
        data.runtimeError,
        data.result?.stderr,
        data.result?.error,
        data.result?.message,
        data.result?.output, // sometimes errors go to output
      ];

      for (const src of errorSources) {
        if (src && typeof src === 'string' && src.trim()) {
          stderr = src.trim();
          break;
        }
      }

      // 3. Fallback: if output contains typical error patterns
      if (!stderr && stdout && (stdout.includes('Traceback') || stdout.includes('Error') || stdout.includes('SyntaxError'))) {
        stderr = stdout;
        stdout = '';
      }

      // 4. Extract exit code
      if (typeof data.exit_code === 'number') exitCode = data.exit_code;
      else if (typeof data.exitCode === 'number') exitCode = data.exitCode;
      else if (stderr) exitCode = 1;
      else if (data.status === 'error') exitCode = 1;

      // 5. If still no error but exitCode != 0, create generic
      if (exitCode !== 0 && !stderr) {
        stderr = `Execution failed with exit code ${exitCode}`;
      }

      return { stdout, stderr, exitCode };
    } catch (error) {
      console.error('[OnlineCompilerProvider] Request error:', error.message);
      let stderr = '';
      let exitCode = 1;

      if (error.response && error.response.data) {
        const apiData = error.response.data;
        stderr = apiData.message || apiData.error || apiData.stderr || apiData.output;
        if (!stderr) stderr = `API error (${error.response.status}): ${error.response.statusText}`;
      } else if (error.request) {
        stderr = `Network error: ${error.message}`;
      } else {
        stderr = `Unexpected error: ${error.message}`;
      }

      if (stderr.length > 2000) stderr = stderr.substring(0, 2000) + '... (truncated)';
      return { stdout: '', stderr, exitCode };
    }
  }

  async executeBatch({ language, code, testCases }) {
    const promises = testCases.map(tc =>
      this.execute({ language, code, stdin: tc.stdin })
    );
    return Promise.all(promises);
  }
}

module.exports = OnlineCompilerProvider;