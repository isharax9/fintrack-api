import { FastifyInstance } from 'fastify';
import * as tagsController from './tags.controller';

export default async function tagsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', { handler: tagsController.list });
  fastify.post('/', { handler: tagsController.create });
  fastify.put('/:id', { handler: tagsController.update });
  fastify.delete('/:id', { handler: tagsController.remove });
}
