import { FastifyInstance } from 'fastify';
import * as accountsController from './accounts.controller';

export default async function accountsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', { handler: accountsController.list });
  fastify.post('/', { handler: accountsController.create });
  fastify.put('/:id', { handler: accountsController.update });
  fastify.delete('/:id', { handler: accountsController.remove });
}
