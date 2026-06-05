import { FastifyInstance } from 'fastify';
import { errorResponse, messageResponse, refreshSessionResponse } from '../../utils/openapi';
import * as authController from './auth.controller';

export default async function authRoutes(fastify: FastifyInstance) {
  // specific auth rate limit: 5 req / 15min
  const authRateLimit = { max: 5, timeWindow: '15 minutes' };

  const userResponse = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      email: { type: 'string' },
      currency: { type: 'string' },
      createdAt: { type: 'string' },
      updatedAt: { type: 'string' },
    },
    required: ['id', 'name', 'email', 'currency', 'createdAt', 'updatedAt'],
  };

  const authResponse = {
    type: 'object',
    properties: {
      accessToken: { type: 'string' },
      refreshToken: { type: 'string' },
      user: userResponse,
    },
    required: ['accessToken', 'refreshToken', 'user'],
  };

  fastify.post('/register', {
    schema: {
      tags: ['Auth'],
      summary: 'Register a user',
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
        },
        required: ['name', 'email', 'password'],
      },
      response: { 201: authResponse, 400: errorResponse, 409: errorResponse },
    },
    handler: authController.register,
  });

  fastify.post('/login', {
    config: { rateLimit: authRateLimit },
    schema: {
      tags: ['Auth'],
      summary: 'Login and create a refresh session',
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
        required: ['email', 'password'],
      },
      response: { 200: authResponse, 401: errorResponse },
    },
    handler: authController.login,
  });

  fastify.post('/refresh', {
    schema: {
      tags: ['Auth'],
      summary: 'Rotate refresh token and issue a new access token',
      body: {
        type: 'object',
        properties: { refreshToken: { type: 'string' } },
        required: ['refreshToken'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
          },
          required: ['accessToken', 'refreshToken'],
        },
        401: errorResponse,
      },
    },
    handler: authController.refresh,
  });

  fastify.post('/logout', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Logout current session',
      security: [{ bearerAuth: [] }],
      response: { 200: messageResponse, 401: errorResponse },
    },
    handler: authController.logout,
  });

  fastify.post('/logout-all', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Logout all sessions',
      security: [{ bearerAuth: [] }],
      response: { 200: messageResponse, 401: errorResponse },
    },
    handler: authController.logoutAll,
  });

  fastify.get('/sessions', {
    preHandler: [fastify.authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'List active refresh sessions',
      security: [{ bearerAuth: [] }],
      response: {
        200: { type: 'array', items: refreshSessionResponse },
        401: errorResponse,
      },
    },
    handler: authController.listSessions,
  });

  fastify.post('/forgot-password', {
    config: { rateLimit: authRateLimit },
    schema: {
      tags: ['Auth'],
      summary: 'Send password reset OTP',
      body: {
        type: 'object',
        properties: { email: { type: 'string', format: 'email' } },
        required: ['email'],
      },
      response: { 200: messageResponse, 400: errorResponse },
    },
    handler: authController.forgotPassword,
  });

  fastify.post('/verify-otp', {
    schema: {
      tags: ['Auth'],
      summary: 'Verify password reset OTP',
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          otp: { type: 'string', minLength: 6, maxLength: 6 },
        },
        required: ['email', 'otp'],
      },
      response: {
        200: {
          type: 'object',
          properties: { resetToken: { type: 'string' } },
          required: ['resetToken'],
        },
        400: errorResponse,
      },
    },
    handler: authController.verifyOtp,
  });

  fastify.post('/reset-password', {
    schema: {
      tags: ['Auth'],
      summary: 'Reset password using reset token',
      body: {
        type: 'object',
        properties: {
          resetToken: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 },
        },
        required: ['resetToken', 'newPassword'],
      },
      response: { 200: messageResponse, 400: errorResponse },
    },
    handler: authController.resetPassword,
  });
}
