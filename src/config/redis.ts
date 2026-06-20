import { Redis } from 'ioredis';
import { env } from './env';

const createRedisClient = () => {
  if (!env.REDIS_URL || env.NODE_ENV === 'test') {
    return null;
  }

  const url = new URL(env.REDIS_URL);
  const client = new Redis(env.REDIS_URL, {
    connectTimeout: 5000,
    maxRetriesPerRequest: 1,
    tls: url.protocol === 'rediss:' ? { rejectUnauthorized: false } : undefined,
  });

  client.on('error', (error) => {
    console.error('Redis connection error:', error.message);
  });

  return client;
};

export const redis = createRedisClient();

if (!redis) {
  console.warn("REDIS_URL is not provided, redis connection skipped.");
}
