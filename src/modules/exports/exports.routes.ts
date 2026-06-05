import { FastifyInstance } from 'fastify';
import { bearerAuth } from '../../utils/openapi';
import * as exportsController from './exports.controller';

export default async function exportsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/transactions/pdf', { schema: { tags: ['Exports'], security: bearerAuth }, handler: exportsController.exportTransactionsPdf });
  fastify.get('/reports/pdf', { schema: { tags: ['Exports'], security: bearerAuth }, handler: exportsController.exportSummaryPdf });
}
