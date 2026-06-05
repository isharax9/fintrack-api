import { FastifyInstance } from 'fastify';
import { bearerAuth } from '../../utils/openapi';
import * as reportsController from './reports.controller';

export default async function reportsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/summary', { schema: { tags: ['Reports'], security: bearerAuth }, handler: reportsController.summary });
  fastify.get('/by-category', { schema: { tags: ['Reports'], security: bearerAuth }, handler: reportsController.byCategory });
  fastify.get('/trend', { schema: { tags: ['Reports'], security: bearerAuth }, handler: reportsController.trend });
}
