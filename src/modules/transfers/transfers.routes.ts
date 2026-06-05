import { FastifyInstance } from 'fastify';
import { bearerAuth } from '../../utils/openapi';
import * as transfersController from './transfers.controller';

export default async function transfersRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', { schema: { tags: ['Transfers'], security: bearerAuth }, handler: transfersController.list });
  fastify.post('/', { schema: { tags: ['Transfers'], security: bearerAuth }, handler: transfersController.create });
}
