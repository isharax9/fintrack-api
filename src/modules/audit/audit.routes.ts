import { FastifyInstance } from 'fastify';
import * as auditController from './audit.controller';

export default async function auditRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', { handler: auditController.list });
}
