import { FastifyInstance } from 'fastify';
import { bearerAuth } from '../../utils/openapi';
import * as tagsController from './tags.controller';

export default async function tagsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', { schema: { tags: ['Tags'], security: bearerAuth }, handler: tagsController.list });
  fastify.post('/', { schema: { tags: ['Tags'], security: bearerAuth }, handler: tagsController.create });
  fastify.put('/:id', { schema: { tags: ['Tags'], security: bearerAuth }, handler: tagsController.update });
  fastify.delete('/:id', { schema: { tags: ['Tags'], security: bearerAuth }, handler: tagsController.remove });
}
