import { FastifyInstance } from 'fastify';
import { bearerAuth } from '../../utils/openapi';
import * as accountsController from './accounts.controller';

export default async function accountsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', { schema: { tags: ['Accounts'], security: bearerAuth }, handler: accountsController.list });
  fastify.post('/', { schema: { tags: ['Accounts'], security: bearerAuth }, handler: accountsController.create });
  fastify.put('/:id', { schema: { tags: ['Accounts'], security: bearerAuth }, handler: accountsController.update });
  fastify.delete('/:id', { schema: { tags: ['Accounts'], security: bearerAuth }, handler: accountsController.remove });
}
