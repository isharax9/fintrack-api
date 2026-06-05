import { FastifyInstance } from 'fastify';
import { bearerAuth } from '../../utils/openapi';
import * as transactionsController from './transactions.controller';

export default async function transactionsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', { schema: { tags: ['Transactions'], security: bearerAuth }, handler: transactionsController.list });
  fastify.post('/', { schema: { tags: ['Transactions'], security: bearerAuth }, handler: transactionsController.create });
  fastify.get('/:id', { schema: { tags: ['Transactions'], security: bearerAuth }, handler: transactionsController.getOne });
  fastify.put('/:id', { schema: { tags: ['Transactions'], security: bearerAuth }, handler: transactionsController.update });
  fastify.delete('/:id', { schema: { tags: ['Transactions'], security: bearerAuth }, handler: transactionsController.remove });
}
