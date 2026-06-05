import { FastifyInstance } from 'fastify';
import {
  bearerAuth,
  createTransactionBody,
  errorResponse,
  idParam,
  messageResponse,
  paginated,
  transactionQuery,
  transactionResponse,
  updateTransactionBody,
} from '../../utils/openapi';
import * as transactionsController from './transactions.controller';

export default async function transactionsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', {
    schema: {
      tags: ['Transactions'],
      summary: 'List transactions',
      security: bearerAuth,
      querystring: transactionQuery,
      response: { 200: paginated(transactionResponse), 400: errorResponse, 401: errorResponse },
    },
    handler: transactionsController.list,
  });

  fastify.post('/', {
    schema: {
      tags: ['Transactions'],
      summary: 'Create a transaction',
      security: bearerAuth,
      body: createTransactionBody,
      response: { 201: transactionResponse, 400: errorResponse, 401: errorResponse },
    },
    handler: transactionsController.create,
  });

  fastify.get('/:id', {
    schema: {
      tags: ['Transactions'],
      summary: 'Get a transaction',
      security: bearerAuth,
      params: idParam,
      response: { 200: transactionResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: transactionsController.getOne,
  });

  fastify.put('/:id', {
    schema: {
      tags: ['Transactions'],
      summary: 'Update a transaction',
      security: bearerAuth,
      params: idParam,
      body: updateTransactionBody,
      response: { 200: transactionResponse, 400: errorResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: transactionsController.update,
  });

  fastify.delete('/:id', {
    schema: {
      tags: ['Transactions'],
      summary: 'Delete a transaction',
      security: bearerAuth,
      params: idParam,
      response: { 200: messageResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: transactionsController.remove,
  });
}
