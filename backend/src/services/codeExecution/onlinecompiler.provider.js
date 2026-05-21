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

    let finalCode = code;
    if (language === 'python') {
      finalCode = code + `

if __name__ == "__main__":
    import sys
    input_data = sys.stdin.read()
    output = solve(input_data)
    sys.stdout.write(str(output))
`;
    }

    const compiler = this.mapLanguage(language);
    const payload = {
      compiler: compiler,
      code: finalCode,
      input: stdin || '',
    };

    const url = `${this.apiUrl}/api/run-code-sync/`;
    
    if (this.isFirstLog) {
      this.isFirstLog = false;
      // console.log('[OnlineCompilerProvider] ===== DEBUG FIRST EXECUTION =====');
      // console.log('[OnlineCompilerProvider] Language:', language);
      // console.log('[OnlineCompilerProvider] Compiler:', compiler);
      // console.log('[OnlineCompilerProvider] Input (stdin):', stdin);
      // console.log('[OnlineCompilerProvider] Code (full):\n', finalCode);
      // console.log('[OnlineCompilerProvider] =================================');
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
      // console.log('[OnlineCompilerProvider] Response data:', JSON.stringify(data, null, 2));

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