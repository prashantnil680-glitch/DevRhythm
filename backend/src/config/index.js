const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 5000,
  isProduction: process.env.NODE_ENV === 'production',
  apiBaseUrl: process.env.API_BASE_URL || '/api/v1',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4000',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:5000',
  
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
      callbackUrl: process.env.GOOGLE_CALLBACK_URL || `${config.backendUrl}/api/v1/auth/google/callback`,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackUrl: process.env.GITHUB_CALLBACK_URL || `${config.backendUrl}/api/v1/auth/github/callback`,
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
    fromAddress: process.env.EMAIL_FROM_ADDRESS || 'noreply@devrhythm.com',
    fromName: process.env.EMAIL_FROM_NAME || 'DevRhythm',
    mailjet: {
      apiKey: process.env.MAILJET_API_KEY,
      secretKey: process.env.MAILJET_SECRET_KEY,
    },
  },

  codeExecution: {
    provider: process.env.CODE_EXECUTION_PROVIDER || 'judge0',
    normalizationEnabled: process.env.CODE_NORMALIZATION_ENABLED !== 'false', 
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

  // ========== USER LIST OPTIMIZATION CONSTANTS ==========
  userList: {
    maxPage: parseInt(process.env.USER_LIST_MAX_PAGE) || 100,
    maxLimit: parseInt(process.env.USER_LIST_MAX_LIMIT) || 100,
    defaultLimit: 20,
    cacheTtlPublic: parseInt(process.env.USER_LIST_CACHE_TTL_PUBLIC) || 60,   // seconds
    cacheTtlAuth: parseInt(process.env.USER_LIST_CACHE_TTL_AUTH) || 30,       // seconds
  },
};