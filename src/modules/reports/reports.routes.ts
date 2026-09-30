import { FastifyInstance } from 'fastify';
import {
  bearerAuth,
  categoryFlowResponse,
  categoryReportResponse,
  errorResponse,
  monthYearQuery,
  reportSummaryResponse,
  trendResponse,
} from '../../utils/openapi';
import * as reportsController from './reports.controller';

export default async function reportsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/safe-to-spend', {
    schema: {
      tags: ['Reports'],
      summary: 'Get Safe-to-Spend calculation, days until payday, and financial timeline',
      security: bearerAuth,
      response: { 401: errorResponse },
    },
    handler: reportsController.safeToSpend,
  });

  fastify.post('/simulate-spend', {
    schema: {
      tags: ['Reports'],
      summary: 'Simulate spending an amount and check safe-to-spend impact',
      security: bearerAuth,
      body: {
        type: 'object',
        properties: { amount: { type: 'number', minimum: 0.01 } },
        required: ['amount'],
      },
      response: { 400: errorResponse, 401: errorResponse },
    },
    handler: reportsController.simulateSpend,
  });

  fastify.post('/email-summary', {
    schema: {
      tags: ['Reports'],
      summary: 'Send instant Safe-to-Spend financial snapshot to user email',
      security: bearerAuth,
      response: { 200: { type: 'object', properties: { success: { type: 'boolean' }, message: { type: 'string' } } }, 401: errorResponse },
    },
    handler: reportsController.emailSummary,
  });

  fastify.get('/summary', {
    schema: {
      tags: ['Reports'],
      summary: 'Get monthly summary',
      security: bearerAuth,
      querystring: monthYearQuery,
      response: { 200: reportSummaryResponse, 400: errorResponse, 401: errorResponse },
    },
    handler: reportsController.summary,
  });

  fastify.get('/by-category', {
    schema: {
      tags: ['Reports'],
      summary: 'Get monthly expense totals by category',
      security: bearerAuth,
      querystring: monthYearQuery,
      response: { 200: { type: 'array', items: categoryReportResponse }, 400: errorResponse, 401: errorResponse },
    },
    handler: reportsController.byCategory,
  });

  fastify.get('/category-flow', {
    schema: {
      tags: ['Reports'],
      summary: 'Get monthly income and expense totals by category',
      security: bearerAuth,
      querystring: monthYearQuery,
      response: { 200: { type: 'array', items: categoryFlowResponse }, 400: errorResponse, 401: errorResponse },
    },
    handler: reportsController.categoryFlow,
  });

  fastify.get('/trend', {
    schema: {
      tags: ['Reports'],
      summary: 'Get six-month income and expense trend',
      security: bearerAuth,
      response: { 200: { type: 'array', items: trendResponse }, 401: errorResponse },
    },
    handler: reportsController.trend,
  });
}
