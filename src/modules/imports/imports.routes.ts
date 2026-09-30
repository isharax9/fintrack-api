import { FastifyInstance } from 'fastify';
import { bearerAuth, errorResponse, importTransactionsResponse } from '../../utils/openapi';
import * as importsController from './imports.controller';

export default async function importsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post('/transactions', {
    schema: {
      tags: ['Imports'],
      summary: 'Preview or import transactions from CSV',
      security: bearerAuth,
      consumes: ['multipart/form-data'],
      querystring: {
        type: 'object',
        properties: {
          dryRun: { type: 'boolean', default: true },
        },
      },
      response: {
        200: importTransactionsResponse,
        201: importTransactionsResponse,
        400: errorResponse,
        401: errorResponse,
      },
    },
    handler: importsController.importTransactions,
  });

  fastify.post('/statement-text', {
    schema: {
      tags: ['Imports'],
      summary: 'Preview or import transactions from raw statement or SMS text',
      security: bearerAuth,
      querystring: {
        type: 'object',
        properties: {
          dryRun: { type: 'boolean', default: true },
        },
      },
      body: {
        type: 'object',
        properties: {
          rawText: { type: 'string', minLength: 3 },
          defaultAccountId: { type: 'string' },
        },
        required: ['rawText'],
      },
      response: {
        200: importTransactionsResponse,
        201: importTransactionsResponse,
        400: errorResponse,
        401: errorResponse,
      },
    },
    handler: importsController.importStatement,
  });
}
