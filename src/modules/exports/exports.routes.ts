import { FastifyInstance } from 'fastify';
import { bearerAuth, errorResponse, monthYearQuery } from '../../utils/openapi';
import * as exportsController from './exports.controller';

export default async function exportsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/transactions/pdf', {
    schema: {
      tags: ['Exports'],
      summary: 'Export transactions as PDF',
      security: bearerAuth,
      response: {
        200: {
          description: 'PDF document',
          content: {
            'application/pdf': {
              schema: { type: 'string', format: 'binary' },
            },
          },
        },
        401: errorResponse,
      },
    },
    handler: exportsController.exportTransactionsPdf,
  });

  fastify.get('/reports/pdf', {
    schema: {
      tags: ['Exports'],
      summary: 'Export monthly summary as PDF',
      security: bearerAuth,
      querystring: monthYearQuery,
      response: {
        200: {
          description: 'PDF document',
          content: {
            'application/pdf': {
              schema: { type: 'string', format: 'binary' },
            },
          },
        },
        400: errorResponse,
        401: errorResponse,
      },
    },
    handler: exportsController.exportSummaryPdf,
  });
}
