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

    // No extra wrapping for any language – the language‑specific generator
    // already produces a fully runnable program with its own entry point.
    const finalCode = code;
    const compiler = this.mapLanguage(language);
    const payload = {
      compiler: compiler,
      code: finalCode,
      input: stdin || '',
    };

    const url = `${this.apiUrl}/api/run-code-sync/`;
    
    if (this.isFirstLog) {
      this.isFirstLog = false;
      // Optional debug log – can be removed in production
      // console.log('[OnlineCompilerProvider] First execution, language:', language);
    }

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': this.apiKey,
          'Content-Type': 'application/json',
        },
        timeout: this.timeout,
      });

      const data = response.data;
      return {
        stdout: data.output || '',
        stderr: data.error || '',
        exitCode: data.exit_code !== undefined ? data.exit_code : (data.error ? 1 : 0),
      };
    } catch (error) {
      console.error('[OnlineCompilerProvider] Execution error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: url,
      });

      let stderr = 'Execution service error';
      if (error.response) {
        const apiMsg = error.response.data?.message || error.response.data?.error || error.response.statusText;
        stderr = `API error (${error.response.status}): ${apiMsg}`;
      } else if (error.request) {
        stderr = `Network error: ${error.message}`;
      } else {
        stderr = `Unexpected error: ${error.message}`;
      }
      return {
        stdout: '',
        stderr,
        exitCode: 1,
      };
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