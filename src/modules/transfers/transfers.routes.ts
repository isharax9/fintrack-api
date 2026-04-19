import { FastifyInstance } from 'fastify';
import * as transfersController from './transfers.controller';

export default async function transfersRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', { handler: transfersController.list });
  fastify.post('/', { handler: transfersController.create });
}
