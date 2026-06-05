import { FastifyInstance } from 'fastify';
import {
  allocateFundsBody,
  bearerAuth,
  createSavingsGoalBody,
  errorResponse,
  idParam,
  messageResponse,
  savingsBucketResponse,
  savingsGoalResponse,
  updateSavingsGoalBody,
} from '../../utils/openapi';
import * as savingsController from './savings.controller';

export default async function savingsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/bucket', {
    schema: {
      tags: ['Savings'],
      summary: 'Get savings bucket',
      security: bearerAuth,
      response: { 200: savingsBucketResponse, 401: errorResponse },
    },
    handler: savingsController.getBucket,
  });

  fastify.get('/goals', {
    schema: {
      tags: ['Savings'],
      summary: 'List savings goals',
      security: bearerAuth,
      response: { 200: { type: 'array', items: savingsGoalResponse }, 401: errorResponse },
    },
    handler: savingsController.listGoals,
  });

  fastify.post('/goals', {
    schema: {
      tags: ['Savings'],
      summary: 'Create a savings goal',
      security: bearerAuth,
      body: createSavingsGoalBody,
      response: { 201: savingsGoalResponse, 400: errorResponse, 401: errorResponse },
    },
    handler: savingsController.createGoal,
  });

  fastify.put('/goals/:id', {
    schema: {
      tags: ['Savings'],
      summary: 'Update a savings goal',
      security: bearerAuth,
      params: idParam,
      body: updateSavingsGoalBody,
      response: { 200: savingsGoalResponse, 400: errorResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: savingsController.updateGoal,
  });

  fastify.post('/goals/:id/allocate', {
    schema: {
      tags: ['Savings'],
      summary: 'Allocate bucket funds to a savings goal',
      security: bearerAuth,
      params: idParam,
      body: allocateFundsBody,
      response: { 200: savingsGoalResponse, 400: errorResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: savingsController.allocateFunds,
  });

  fastify.delete('/goals/:id', {
    schema: {
      tags: ['Savings'],
      summary: 'Delete a savings goal',
      security: bearerAuth,
      params: idParam,
      response: { 200: messageResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: savingsController.removeGoal,
  });
}
