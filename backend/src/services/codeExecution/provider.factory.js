const config = require('../../config');
const Judge0Provider = require('./judge0.provider');
const OnlineCompilerProvider = require('./onlinecompiler.provider');

class CodeExecutionProviderFactory {
  static createProvider() {
    const provider = config.codeExecution.provider;
    
    if (provider === 'judge0') {
      return new Judge0Provider(
        config.codeExecution.judge0.apiUrl,
        config.codeExecution.judge0.cpuTimeLimit,
        config.codeExecution.judge0.memoryLimit,
      );
    }
    
    if (provider === 'onlinecompiler') {
      return new OnlineCompilerProvider(
        config.codeExecution.onlineCompiler.apiUrl,
        config.codeExecution.onlineCompiler.apiKey,
        config.codeExecution.onlineCompiler.timeout,
      );
    }
    
    throw new Error(`Unsupported code execution provider: ${provider}`);
  }
}

module.exports = CodeExecutionProviderFactory;