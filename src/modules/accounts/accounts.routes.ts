import { FastifyInstance } from 'fastify';
import {
  accountResponse,
  bearerAuth,
  createAccountBody,
  errorResponse,
  idParam,
  messageResponse,
  updateAccountBody,
} from '../../utils/openapi';
import * as accountsController from './accounts.controller';

export default async function accountsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', {
    schema: {
      tags: ['Accounts'],
      summary: 'List accounts',
      security: bearerAuth,
      response: { 200: { type: 'array', items: accountResponse }, 401: errorResponse },
    },
    handler: accountsController.list,
  });

  fastify.post('/', {
    schema: {
      tags: ['Accounts'],
      summary: 'Create an account',
      security: bearerAuth,
      body: createAccountBody,
      response: { 201: accountResponse, 400: errorResponse, 401: errorResponse },
    },
    handler: accountsController.create,
  });

  fastify.put('/:id', {
    schema: {
      tags: ['Accounts'],
      summary: 'Update an account',
      security: bearerAuth,
      params: idParam,
      body: updateAccountBody,
      response: { 200: accountResponse, 400: errorResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: accountsController.update,
  });

  fastify.delete('/:id', {
    schema: {
      tags: ['Accounts'],
      summary: 'Delete an account',
      security: bearerAuth,
      params: idParam,
      response: { 200: messageResponse, 400: errorResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: accountsController.remove,
  });
}
