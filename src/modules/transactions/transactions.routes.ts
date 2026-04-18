import { FastifyInstance } from 'fastify';
import * as transactionsController from './transactions.controller';

export default async function transactionsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', { handler: transactionsController.list });
  fastify.post('/', { handler: transactionsController.create });
  fastify.get('/:id', { handler: transactionsController.getOne });
  fastify.put('/:id', { handler: transactionsController.update });
  fastify.delete('/:id', { handler: transactionsController.remove });
}
