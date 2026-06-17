import { FastifyInstance } from 'fastify';
import {
  bearerAuth,
  createTransferBody,
  errorResponse,
  idParam,
  paginated,
  reverseTransferBody,
  transferQuery,
  transferResponse,
} from '../../utils/openapi';
import * as transfersController from './transfers.controller';

export default async function transfersRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', {
    schema: {
      tags: ['Transfers'],
      summary: 'List transfers',
      security: bearerAuth,
      querystring: transferQuery,
      response: { 200: paginated(transferResponse), 401: errorResponse },
    },
    handler: transfersController.list,
  });

  fastify.get('/:id', {
    schema: {
      tags: ['Transfers'],
      summary: 'Get transfer detail',
      security: bearerAuth,
      params: idParam,
      response: { 200: transferResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: transfersController.getOne,
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

  fastify.post('/:id/reverse', {
    schema: {
      tags: ['Transfers'],
      summary: 'Reverse a posted transfer',
      security: bearerAuth,
      params: idParam,
      body: reverseTransferBody,
      response: { 201: transferResponse, 400: errorResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: transfersController.reverse,
  });
}
