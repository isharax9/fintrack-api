import { FastifyInstance } from 'fastify';
import {
  bearerAuth,
  budgetGoalResponse,
  createBudgetGoalBody,
  errorResponse,
  idParam,
  messageResponse,
  monthYearQuery,
  updateBudgetGoalBody,
} from '../../utils/openapi';
import * as budgetGoalsController from './budgetGoals.controller';

export default async function budgetGoalsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', {
    schema: {
      tags: ['Budgets'],
      summary: 'List budget goals for a month',
      security: bearerAuth,
      querystring: monthYearQuery,
      response: { 200: { type: 'array', items: budgetGoalResponse }, 400: errorResponse, 401: errorResponse },
    },
    handler: budgetGoalsController.list,
  });

  fastify.get('/envelopes', {
    schema: {
      tags: ['Budgets'],
      summary: 'Get visual envelope budget breakdown with remaining cash and transfer history',
      security: bearerAuth,
      querystring: monthYearQuery,
      response: { 400: errorResponse, 401: errorResponse },
    },
    handler: budgetGoalsController.envelopes,
  });

  fastify.post('/transfer', {
    schema: {
      tags: ['Budgets'],
      summary: 'Transfer funds between budget envelopes',
      security: bearerAuth,
      response: { 400: errorResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: budgetGoalsController.transfer,
  });

  fastify.post('/fill-envelopes', {
    schema: {
      tags: ['Budgets'],
      summary: 'Batch allocate/fill envelopes on payday',
      security: bearerAuth,
      response: { 400: errorResponse, 401: errorResponse },
    },
    handler: budgetGoalsController.fill,
  });

  fastify.post('/', {
    schema: {
      tags: ['Budgets'],
      summary: 'Create a budget goal',
      security: bearerAuth,
      body: createBudgetGoalBody,
      response: { 201: budgetGoalResponse, 400: errorResponse, 401: errorResponse, 409: errorResponse },
    },
    handler: budgetGoalsController.create,
  });

  fastify.put('/:id', {
    schema: {
      tags: ['Budgets'],
      summary: 'Update a budget goal',
      security: bearerAuth,
      params: idParam,
      body: updateBudgetGoalBody,
      response: { 200: budgetGoalResponse, 400: errorResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: budgetGoalsController.update,
  });

  fastify.delete('/:id', {
    schema: {
      tags: ['Budgets'],
      summary: 'Delete a budget goal',
      security: bearerAuth,
      params: idParam,
      response: { 200: messageResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: budgetGoalsController.remove,
  });
}
