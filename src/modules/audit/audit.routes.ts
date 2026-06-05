import { FastifyInstance } from 'fastify';
import { auditLogResponse, auditQuery, bearerAuth, errorResponse, paginated } from '../../utils/openapi';
import * as auditController from './audit.controller';

export default async function auditRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', {
    schema: {
      tags: ['Audit'],
      summary: 'List audit logs',
      security: bearerAuth,
      querystring: auditQuery,
      response: { 200: paginated(auditLogResponse), 400: errorResponse, 401: errorResponse },
    },
    handler: auditController.list,
  });
}
