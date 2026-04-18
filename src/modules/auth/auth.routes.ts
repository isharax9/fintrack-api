import { FastifyInstance } from 'fastify';
import * as authController from './auth.controller';

export default async function authRoutes(fastify: FastifyInstance) {
  // specific auth rate limit: 5 req / 15min
  const authRateLimit = { max: 5, timeWindow: '15 minutes' };

  fastify.post('/register', { handler: authController.register });
  fastify.post('/login', { config: { rateLimit: authRateLimit }, handler: authController.login });
  fastify.post('/refresh', { handler: authController.refresh });
  fastify.post('/logout', { preHandler: [fastify.authenticate], handler: authController.logout });
  fastify.post('/forgot-password', { config: { rateLimit: authRateLimit }, handler: authController.forgotPassword });
  fastify.post('/verify-otp', { handler: authController.verifyOtp });
  fastify.post('/reset-password', { handler: authController.resetPassword });
}
