import { FastifyInstance } from 'fastify';
import {
  bearerAuth,
  categoryBody,
  categoryResponse,
  errorResponse,
  idParam,
  messageResponse,
  updateCategoryBody,
} from '../../utils/openapi';
import * as categoriesController from './categories.controller';

export default async function categoriesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', {
    schema: {
      tags: ['Categories'],
      summary: 'List categories',
      security: bearerAuth,
      response: { 200: { type: 'array', items: categoryResponse }, 401: errorResponse },
    },
    handler: categoriesController.list,
  });

  fastify.post('/', {
    schema: {
      tags: ['Categories'],
      summary: 'Create a category',
      security: bearerAuth,
      body: categoryBody,
      response: { 201: categoryResponse, 400: errorResponse, 401: errorResponse },
    },
    handler: categoriesController.create,
  });

  fastify.put('/:id', {
    schema: {
      tags: ['Categories'],
      summary: 'Update a category',
      security: bearerAuth,
      params: idParam,
      body: updateCategoryBody,
      response: { 200: categoryResponse, 400: errorResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: categoriesController.update,
  });

  fastify.delete('/:id', {
    schema: {
      tags: ['Categories'],
      summary: 'Delete a category',
      security: bearerAuth,
      params: idParam,
      response: { 200: messageResponse, 400: errorResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: categoriesController.remove,
  });
}
