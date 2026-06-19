const Redis = require('ioredis');
const config = require('./index');

let redisClient = null;
let redisErrorLogged = false;
let heartbeatInterval = null;

const createRedisClient = () => {
  try {
    const url = config.redis.url;
    if (!url) {
      throw new Error('REDIS_URL is not defined in environment');
    }

    const isTLS = url.startsWith('rediss://');
    const options = {
      password: config.redis.password,
      db: config.redis.db,
      retryStrategy: (times) => {
        if (times > 50) {
          console.error('Redis: Too many reconnect attempts, stopping.');
          return null;
        }
        const delay = Math.min(Math.pow(2, times) * 100, 10000);
        console.log(`Redis reconnect attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
      keepAlive: 5000,
      connectTimeout: 10000,
    };

    if (isTLS) {
      options.tls = { rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== 'false' };
    }

    const client = new Redis(url, options);

    client.on('error', (err) => {
      if (!redisErrorLogged) {
        console.error('Redis Client Error:', err.message);
        redisErrorLogged = true;
        console.warn(
          '⚠️ Redis is unavailable. Rate limiters will fall back to memory store. ' +
          'Retry-After headers will still be sent (handled by the rate limiter logic).'
        );
      }
    });

    client.on('connect', () => console.log('Redis client connected'));
    client.on('ready', () => {
      console.log('Redis client ready');
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = setInterval(async () => {
        try {
          if (client.status === 'ready') {
            await client.ping();
          }
        } catch (err) {
          console.warn('[Redis] Heartbeat ping failed:', err.message);
        }
      }, 30000);
    });
    client.on('reconnecting', () => console.log('Redis client reconnecting'));
    client.on('end', () => {
      console.log('Redis client disconnected');
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    });

    return client;
  } catch (error) {
    console.error('Failed to create Redis client:', error);
    console.warn(
      '⚠️ Redis initialization failed. Rate limiters will fall back to memory store. ' +
      'Retry-After headers will still be sent (handled by the rate limiter logic).'
    );
    return null;
  }
};

const client = createRedisClient();

const waitForRedis = async () => {
  if (!client) throw new Error('Redis client not created');
  // ioredis auto-connects; wait for ready state
  if (client.status === 'ready') {
    console.log('Redis connected successfully');
    if (process.env.NODE_ENV === 'development') {
      await client.flushall();
      console.log('Redis cache cleared for development');
    }
    return;
  }
  // Wait for ready event
  return new Promise((resolve, reject) => {
    client.once('ready', () => {
      console.log('Redis connected successfully');
      if (process.env.NODE_ENV === 'development') {
        client.flushall().then(() => {
          console.log('Redis cache cleared for development');
          resolve();
        }).catch(reject);
      } else {
        resolve();
      }
    });
    client.once('error', (err) => {
      reject(err);
    });
    // If connection already ended, reject
    if (client.status === 'end') {
      reject(new Error('Redis connection ended'));
    }
  });
};

process.on('SIGINT', async () => {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (client) await client.quit();
  process.exit(0);
});

module.exports = { client, waitForRedis };