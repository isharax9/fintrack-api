import { FastifyInstance } from 'fastify';
import { bearerAuth } from '../../utils/openapi';
import * as savingsController from './savings.controller';

export default async function savingsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/bucket', { schema: { tags: ['Savings'], security: bearerAuth }, handler: savingsController.getBucket });
  fastify.get('/goals', { schema: { tags: ['Savings'], security: bearerAuth }, handler: savingsController.listGoals });
  fastify.post('/goals', { schema: { tags: ['Savings'], security: bearerAuth }, handler: savingsController.createGoal });
  fastify.put('/goals/:id', { schema: { tags: ['Savings'], security: bearerAuth }, handler: savingsController.updateGoal });
  fastify.post('/goals/:id/allocate', { schema: { tags: ['Savings'], security: bearerAuth }, handler: savingsController.allocateFunds });
  fastify.delete('/goals/:id', { schema: { tags: ['Savings'], security: bearerAuth }, handler: savingsController.removeGoal });
}
