import { FastifyInstance } from 'fastify';
import { bearerAuth } from '../../utils/openapi';
import * as categoriesController from './categories.controller';

export default async function categoriesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', { schema: { tags: ['Categories'], security: bearerAuth }, handler: categoriesController.list });
  fastify.post('/', { schema: { tags: ['Categories'], security: bearerAuth }, handler: categoriesController.create });
  fastify.put('/:id', { schema: { tags: ['Categories'], security: bearerAuth }, handler: categoriesController.update });
  fastify.delete('/:id', { schema: { tags: ['Categories'], security: bearerAuth }, handler: categoriesController.remove });
}
