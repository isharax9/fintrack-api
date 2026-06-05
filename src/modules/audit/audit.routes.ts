import { FastifyInstance } from 'fastify';
import { bearerAuth } from '../../utils/openapi';
import * as auditController from './audit.controller';

export default async function auditRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', { schema: { tags: ['Audit'], security: bearerAuth }, handler: auditController.list });
}
