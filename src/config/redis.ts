import { Redis } from 'ioredis';
import { env } from './env';

export const redis = env.REDIS_URL ? new Redis(env.REDIS_URL) : null;

if (!redis) {
  console.warn("REDIS_URL is not provided, redis connection skipped.");
}
