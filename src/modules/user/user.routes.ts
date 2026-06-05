import { FastifyInstance } from 'fastify';
import { bearerAuth } from '../../utils/openapi';
import * as userController from './user.controller';

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/me', { schema: { tags: ['User'], security: bearerAuth }, handler: userController.getMe });
  fastify.put('/me', { schema: { tags: ['User'], security: bearerAuth }, handler: userController.updateMe });
  fastify.delete('/me', { schema: { tags: ['User'], security: bearerAuth }, handler: userController.deleteMe });
}
