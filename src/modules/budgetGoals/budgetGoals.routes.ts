import { FastifyInstance } from 'fastify';
import { bearerAuth } from '../../utils/openapi';
import * as budgetGoalsController from './budgetGoals.controller';

export default async function budgetGoalsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', { schema: { tags: ['Budgets'], security: bearerAuth }, handler: budgetGoalsController.list });
  fastify.post('/', { schema: { tags: ['Budgets'], security: bearerAuth }, handler: budgetGoalsController.create });
  fastify.put('/:id', { schema: { tags: ['Budgets'], security: bearerAuth }, handler: budgetGoalsController.update });
  fastify.delete('/:id', { schema: { tags: ['Budgets'], security: bearerAuth }, handler: budgetGoalsController.remove });
}
