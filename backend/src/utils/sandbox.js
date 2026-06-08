/**
 * src/utils/sandbox.js
 *
 * Sandbox execution wrapper for isolate/nsjail.
 * Not used when CODE_EXECUTION_PROVIDER=onlinecompiler.
 */

const { execFile, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const generateBoxId = () => {
  return Math.floor(Date.now() % 1000000) + Math.floor(Math.random() * 1000000);
};

const DEFAULT_CPU_LIMIT = 2;
const DEFAULT_MEMORY_LIMIT_KB = 256000;
const DEFAULT_WALL_TIME_LIMIT = 5;
const DEFAULT_OUTPUT_LIMIT_KB = 1024;

let detectedSandbox = null;

async function detectSandbox() {
  if (detectedSandbox !== null) return detectedSandbox;
  try {
    await new Promise((resolve, reject) => {
      execFile('isolate', ['--version'], (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    detectedSandbox = 'isolate';
    console.log('[Sandbox] Detected isolate');
  } catch (e) {
    detectedSandbox = 'none';
    console.warn('[Sandbox] No sandbox tool found. Running without sandbox.');
  }
  return detectedSandbox;
}

async function createIsolateBox(boxId) {
  await new Promise((resolve, reject) => {
    execFile('isolate', ['--init', `--box-id=${boxId}`], (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  return `/var/local/lib/isolate/${boxId}/box`;
}

async function cleanupIsolateBox(boxId) {
  try {
    await new Promise((resolve, reject) => {
      execFile('isolate', ['--cleanup', `--box-id=${boxId}`], (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  } catch (err) {
    console.warn(`[Sandbox] Failed to cleanup isolate box ${boxId}:`, err.message);
  }
}

async function runWithIsolate({ cmd, args, cwd, cpuTimeLimit, memoryLimitKB, wallTimeLimit, outputLimitKB, stdin }) {
  const boxId = generateBoxId();
  try {
    const sandboxRoot = await createIsolateBox(boxId);
    const innerDir = path.join(sandboxRoot, 'work');
    await fs.mkdir(innerDir, { recursive: true });
    const files = await fs.readdir(cwd);
    for (const file of files) {
      const src = path.join(cwd, file);
      const dest = path.join(innerDir, file);
      await fs.copyFile(src, dest);
    }
    const isolateArgs = [
      `--box-id=${boxId}`,
      '--processes',
      `--time=${cpuTimeLimit.toFixed(2)}`,
      `--wall-time=${wallTimeLimit}`,
      `--mem=${Math.ceil(memoryLimitKB / 1024)}`,
      '--stderr-to-stdout',
      '--run',
      '--', cmd, ...args,
      `--chdir=/box/work`,
    ];
    const result = await new Promise((resolve, reject) => {
      const proc = spawn('isolate', isolateArgs, { cwd: '/', stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '', stderr = '', killed = false;
      const timeout = setTimeout(() => { proc.kill('SIGKILL'); killed = true; }, wallTimeLimit * 1000 + 2000);
      proc.stdin.end(stdin);
      proc.stdout.on('data', d => stdout += d.toString());
      proc.stderr.on('data', d => stderr += d.toString());
      proc.on('close', code => { clearTimeout(timeout); resolve({ code, stdout, stderr, killed }); });
      proc.on('error', reject);
    });
    let outputExceeded = false;
    if (result.stdout.length > outputLimitKB * 1024) { outputExceeded = true; result.stdout = result.stdout.slice(0, outputLimitKB * 1024) + '\n... (output truncated)'; }
    if (result.stderr.length > outputLimitKB * 1024) { outputExceeded = true; result.stderr = result.stderr.slice(0, outputLimitKB * 1024) + '\n... (output truncated)'; }
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.code,
      timedOut: result.killed || result.code === 124,
      memExceeded: result.code === 9,
      outputExceeded,
    };
  } finally {
    await cleanupIsolateBox(boxId);
  }
}

async function runWithoutSandbox({ cmd, args, cwd, wallTimeLimit, stdin, outputLimitKB }) {
  const result = await new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', killed = false;
    const timeout = setTimeout(() => { proc.kill('SIGKILL'); killed = true; }, wallTimeLimit * 1000);
    proc.stdin.end(stdin);
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', code => { clearTimeout(timeout); resolve({ code, stdout, stderr, killed }); });
    proc.on('error', reject);
  });
  let outputExceeded = false;
  if (result.stdout.length > outputLimitKB * 1024) { outputExceeded = true; result.stdout = result.stdout.slice(0, outputLimitKB * 1024) + '\n... (output truncated)'; }
  if (result.stderr.length > outputLimitKB * 1024) { outputExceeded = true; result.stderr = result.stderr.slice(0, outputLimitKB * 1024) + '\n... (output truncated)'; }
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.code,
    timedOut: result.killed,
    memExceeded: false,
    outputExceeded,
  };
}

async function runInSandbox(options) {
  const sandbox = await detectSandbox();
  if (sandbox === 'none') return runWithoutSandbox(options);
  if (sandbox === 'isolate') return runWithIsolate(options);
  throw new Error(`Unsupported sandbox: ${sandbox}`);
}

module.exports = { runInSandbox, detectSandbox };