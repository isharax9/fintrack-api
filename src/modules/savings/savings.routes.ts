import { FastifyInstance } from 'fastify';
import * as savingsController from './savings.controller';

export default async function savingsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/bucket', { handler: savingsController.getBucket });
  fastify.get('/goals', { handler: savingsController.listGoals });
  fastify.post('/goals', { handler: savingsController.createGoal });
  fastify.put('/goals/:id', { handler: savingsController.updateGoal });
  fastify.post('/goals/:id/allocate', { handler: savingsController.allocateFunds });
  fastify.delete('/goals/:id', { handler: savingsController.removeGoal });
}
