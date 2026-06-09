/**
 * src/config/index.js
 *
 * Central configuration loader.
 */

const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  isProduction: process.env.NODE_ENV === 'production',
  apiBaseUrl: process.env.API_BASE_URL || '/api/v1',
  frontendUrl: process.env.FRONTEND_URL || 'https://www.devrhythm.space',
  backendUrl: process.env.BACKEND_URL || 'https://api.devrhythm.space',
  
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/devrhythm',
    maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE) || 500,
    minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE) || 2,
    connectionTimeoutMs: parseInt(process.env.MONGODB_CONNECTION_TIMEOUT_MS) || 50000
  },
  
  redis: {
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB) || 0
  },
  
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET
  },
  
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl: process.env.GOOGLE_CALLBACK_URL || `${process.env.BACKEND_URL}/api/v1/auth/google/callback`,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackUrl: process.env.GITHUB_CALLBACK_URL || `${process.env.BACKEND_URL}/api/v1/auth/github/callback`,
    }
  },
  
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },
  
  session: {
    secret: process.env.SESSION_SECRET,
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 604800000
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
    trustProxy: parseInt(process.env.RATE_LIMIT_TRUST_PROXY) || 1
  },

  email: {
    provider: process.env.EMAIL_PROVIDER || 'mailjet',
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'noreply@devrhythm.space',
    fromName: process.env.EMAIL_FROM_NAME || 'DevRhythm',
    mailjet: {
      apiKey: process.env.MAILJET_API_KEY,
      secretKey: process.env.MAILJET_SECRET_KEY,
    },
  },

  codeExecution: {
    provider: process.env.CODE_EXECUTION_PROVIDER || 'judge0',
    normalizationEnabled: process.env.CODE_NORMALIZATION_ENABLED !== 'false',
    maxConcurrentJobs: Math.min(20, Math.max(1, parseInt(process.env.CODE_EXECUTION_CONCURRENCY) || 10)),
    lockTtlSeconds: Math.min(120, Math.max(5, parseInt(process.env.CODE_EXECUTION_LOCK_TTL) || 30)),
    interactiveTimeout: parseInt(process.env.CODE_EXECUTION_INTERACTIVE_TIMEOUT) || 30000,
    tempDir: process.env.CODE_EXECUTION_TEMP_DIR || null,
    judge0: {
      apiUrl: process.env.JUDGE0_API_URL || 'http://localhost:2358',
      cpuTimeLimit: parseFloat(process.env.JUDGE0_CPU_TIME_LIMIT) || 2,
      memoryLimit: parseInt(process.env.JUDGE0_MEMORY_LIMIT) || 128000,
    },
    onlineCompiler: {
      apiUrl: process.env.ONLINECOMPILER_API_URL,
      apiKey: process.env.ONLINECOMPILER_API_KEY,
      timeout: parseInt(process.env.ONLINECOMPILER_TIMEOUT) || 30000,
    },
  },

  localExecution: {
    enabled: process.env.LOCAL_EXECUTION_ENABLED === 'true',
    sandbox: process.env.LOCAL_EXECUTION_SANDBOX || 'isolate',
    cpuTimeLimit: Math.min(30, Math.max(0.1, parseFloat(process.env.LOCAL_EXECUTION_CPU_LIMIT) || 2)),
    memoryLimitKB: Math.min(2097152, Math.max(65536, parseInt(process.env.LOCAL_EXECUTION_MEMORY_LIMIT) || 256000)),
    wallTimeLimit: Math.min(60, Math.max(1, parseInt(process.env.LOCAL_EXECUTION_TIMEOUT) || 5)),
    outputLimitKB: Math.min(10240, Math.max(1, parseInt(process.env.LOCAL_EXECUTION_OUTPUT_LIMIT) || 1024)),
    cxxCompiler: process.env.LOCAL_EXECUTION_CXX_COMPILER || 'g++',
    pythonExecutable: process.env.LOCAL_EXECUTION_PYTHON_EXECUTABLE || 'python3',
  },

  fastCodeExecutionQueue: {
    concurrency: Math.min(20, Math.max(1, parseInt(process.env.FAST_CODE_EXECUTION_QUEUE_CONCURRENCY) || 15)),
    lockDuration: Math.min(120000, Math.max(10000, parseInt(process.env.FAST_CODE_EXECUTION_LOCK_DURATION) || 60000)),
    stalledInterval: Math.min(120000, Math.max(5000, parseInt(process.env.FAST_CODE_EXECUTION_STALLED_INTERVAL) || 30000)),
    maxStalledCount: Math.min(10, Math.max(1, parseInt(process.env.FAST_CODE_EXECUTION_MAX_STALLED_COUNT) || 3)),
  },

  slowCodeExecutionQueue: {
    concurrency: Math.min(20, Math.max(1, parseInt(process.env.SLOW_CODE_EXECUTION_QUEUE_CONCURRENCY) || 5)),
    lockDuration: Math.min(120000, Math.max(10000, parseInt(process.env.SLOW_CODE_EXECUTION_LOCK_DURATION) || 60000)),
    stalledInterval: Math.min(120000, Math.max(5000, parseInt(process.env.SLOW_CODE_EXECUTION_STALLED_INTERVAL) || 30000)),
    maxStalledCount: Math.min(10, Math.max(1, parseInt(process.env.SLOW_CODE_EXECUTION_MAX_STALLED_COUNT) || 3)),
  },

  // Updated cache TTLs for user list (aligned with free tier optimization)
  userList: {
    maxPage: parseInt(process.env.USER_LIST_MAX_PAGE) || 100,
    maxLimit: parseInt(process.env.USER_LIST_MAX_LIMIT) || 100,
    defaultLimit: 20,
    cacheTtlPublic: parseInt(process.env.USER_LIST_CACHE_TTL_PUBLIC) || 30,
    cacheTtlAuth: parseInt(process.env.USER_LIST_CACHE_TTL_AUTH) || 15,
  },
  cache: {
    defaultTtl: Math.max(5, parseInt(process.env.CACHE_TTL_DEFAULT) || 30)
  }
};