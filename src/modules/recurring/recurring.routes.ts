import { FastifyInstance } from 'fastify';
import {
  bearerAuth,
  createRecurringBody,
  errorResponse,
  idParam,
  messageResponse,
  paginated,
  recurringQuery,
  recurringResponse,
  updateRecurringBody,
} from '../../utils/openapi';
import * as recurringController from './recurring.controller';

export default async function recurringRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', {
    schema: {
      tags: ['Recurring'],
      summary: 'List recurring transactions',
      security: bearerAuth,
      querystring: recurringQuery,
      response: { 200: paginated(recurringResponse), 400: errorResponse, 401: errorResponse },
    },
    handler: recurringController.list,
  });

  fastify.post('/', {
    schema: {
      tags: ['Recurring'],
      summary: 'Create a recurring transaction',
      security: bearerAuth,
      body: createRecurringBody,
      response: { 201: recurringResponse, 400: errorResponse, 401: errorResponse },
    },
    handler: recurringController.create,
  });

  fastify.get('/:id', {
    schema: {
      tags: ['Recurring'],
      summary: 'Get a recurring transaction',
      security: bearerAuth,
      params: idParam,
      response: { 200: recurringResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: recurringController.getOne,
  });

  fastify.put('/:id', {
    schema: {
      tags: ['Recurring'],
      summary: 'Update a recurring transaction',
      security: bearerAuth,
      params: idParam,
      body: updateRecurringBody,
      response: { 200: recurringResponse, 400: errorResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: recurringController.update,
  });

  fastify.delete('/:id', {
    schema: {
      tags: ['Recurring'],
      summary: 'Delete a recurring transaction',
      security: bearerAuth,
      params: idParam,
      response: { 200: messageResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: recurringController.remove,
  });
}
