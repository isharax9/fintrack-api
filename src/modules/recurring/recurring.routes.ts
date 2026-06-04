import { FastifyInstance } from 'fastify';
import * as recurringController from './recurring.controller';

export default async function recurringRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', { handler: recurringController.list });
  fastify.post('/', { handler: recurringController.create });
  fastify.get('/:id', { handler: recurringController.getOne });
  fastify.put('/:id', { handler: recurringController.update });
  fastify.delete('/:id', { handler: recurringController.remove });
}
