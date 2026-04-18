import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { env } from '../config/env';

export default fp(async (fastify) => {
  const allowedOrigins = Array.from(new Set([
    env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3002',
  ]));

  fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow server-to-server calls and local browser origins.
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
  });
});
