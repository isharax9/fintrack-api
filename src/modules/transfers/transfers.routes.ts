import { FastifyInstance } from 'fastify';
import { bearerAuth, createTransferBody, errorResponse, transferResponse } from '../../utils/openapi';
import * as transfersController from './transfers.controller';

export default async function transfersRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', {
    schema: {
      tags: ['Transfers'],
      summary: 'List transfers',
      security: bearerAuth,
      response: { 200: { type: 'array', items: transferResponse }, 401: errorResponse },
    },
    handler: transfersController.list,
  });

  fastify.post('/', {
    schema: {
      tags: ['Transfers'],
      summary: 'Create a transfer',
      security: bearerAuth,
      body: createTransferBody,
      response: { 201: transferResponse, 400: errorResponse, 401: errorResponse },
    },
    handler: transfersController.create,
  });
}
