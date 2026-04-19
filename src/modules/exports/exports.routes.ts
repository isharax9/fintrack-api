import { FastifyInstance } from 'fastify';
import * as exportsController from './exports.controller';

export default async function exportsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/transactions/pdf', { handler: exportsController.exportTransactionsPdf });
  fastify.get('/reports/pdf', { handler: exportsController.exportSummaryPdf });
}
