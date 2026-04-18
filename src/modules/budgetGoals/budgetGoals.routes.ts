import { FastifyInstance } from 'fastify';
import * as budgetGoalsController from './budgetGoals.controller';

export default async function budgetGoalsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', { handler: budgetGoalsController.list });
  fastify.post('/', { handler: budgetGoalsController.create });
  fastify.put('/:id', { handler: budgetGoalsController.update });
  fastify.delete('/:id', { handler: budgetGoalsController.remove });
}
