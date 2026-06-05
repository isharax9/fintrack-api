import { FastifyInstance } from 'fastify';
import {
  bearerAuth,
  categoryReportResponse,
  errorResponse,
  monthYearQuery,
  reportSummaryResponse,
  trendResponse,
} from '../../utils/openapi';
import * as reportsController from './reports.controller';

export default async function reportsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

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
