import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import { redis } from '../config/redis';

export default fp(async (fastify) => {
  fastify.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    redis: redis ? redis : undefined,
    skipOnError: true,
  });
});
