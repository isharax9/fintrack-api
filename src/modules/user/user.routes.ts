import { FastifyInstance } from 'fastify';
import { bearerAuth, errorResponse, messageResponse, updateUserBody, userResponse } from '../../utils/openapi';
import * as userController from './user.controller';

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/me', {
    schema: {
      tags: ['User'],
      summary: 'Get current user profile',
      security: bearerAuth,
      response: { 200: userResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: userController.getMe,
  });

  fastify.put('/me', {
    schema: {
      tags: ['User'],
      summary: 'Update current user profile',
      security: bearerAuth,
      body: updateUserBody,
      response: { 200: userResponse, 400: errorResponse, 401: errorResponse },
    },
    handler: userController.updateMe,
  });

  fastify.delete('/me', {
    schema: {
      tags: ['User'],
      summary: 'Delete current user account',
      security: bearerAuth,
      response: { 200: messageResponse, 401: errorResponse },
    },
    handler: userController.deleteMe,
  });

  fastify.post('/me/change-password', {
    schema: {
      tags: ['User'],
      summary: 'Change current user password',
      security: bearerAuth,
      body: {
        type: 'object',
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 },
        },
        required: ['currentPassword', 'newPassword'],
      },
      response: { 200: messageResponse, 400: errorResponse, 401: errorResponse },
    },
    handler: userController.changePassword,
  });
}

