import { FastifyInstance } from 'fastify';
import { bearerAuth } from '../../utils/openapi';
import * as recurringController from './recurring.controller';

export default async function recurringRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', { schema: { tags: ['Recurring'], security: bearerAuth }, handler: recurringController.list });
  fastify.post('/', { schema: { tags: ['Recurring'], security: bearerAuth }, handler: recurringController.create });
  fastify.get('/:id', { schema: { tags: ['Recurring'], security: bearerAuth }, handler: recurringController.getOne });
  fastify.put('/:id', { schema: { tags: ['Recurring'], security: bearerAuth }, handler: recurringController.update });
  fastify.delete('/:id', { schema: { tags: ['Recurring'], security: bearerAuth }, handler: recurringController.remove });
}
