import { FastifyInstance } from 'fastify';
import * as reportsController from './reports.controller';

export default async function reportsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/summary', { handler: reportsController.summary });
  fastify.get('/by-category', { handler: reportsController.byCategory });
  fastify.get('/trend', { handler: reportsController.trend });
}
