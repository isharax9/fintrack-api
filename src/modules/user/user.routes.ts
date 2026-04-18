import { FastifyInstance } from 'fastify';
import * as userController from './user.controller';

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/me', { handler: userController.getMe });
  fastify.put('/me', { handler: userController.updateMe });
  fastify.delete('/me', { handler: userController.deleteMe });
}
