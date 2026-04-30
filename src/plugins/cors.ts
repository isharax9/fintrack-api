import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { env } from '../config/env';

export default fp(async (fastify) => {
  const allowedOrigins = new Set([
    env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
  ]);

  const isLocalOrigin = (origin: string) =>
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow server-to-server calls and local browser origins.
      if (!origin || allowedOrigins.has(origin) || isLocalOrigin(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });
});
