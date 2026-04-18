import { FastifyInstance } from 'fastify';
import * as categoriesController from './categories.controller';

export default async function categoriesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', { handler: categoriesController.list });
  fastify.post('/', { handler: categoriesController.create });
  fastify.put('/:id', { handler: categoriesController.update });
  fastify.delete('/:id', { handler: categoriesController.remove });
}
