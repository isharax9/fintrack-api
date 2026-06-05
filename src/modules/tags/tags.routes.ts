import { FastifyInstance } from 'fastify';
import { bearerAuth, errorResponse, idParam, messageResponse, tagBody, tagResponse, updateTagBody } from '../../utils/openapi';
import * as tagsController from './tags.controller';

export default async function tagsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', {
    schema: {
      tags: ['Tags'],
      summary: 'List tags',
      security: bearerAuth,
      response: { 200: { type: 'array', items: tagResponse }, 401: errorResponse },
    },
    handler: tagsController.list,
  });

  fastify.post('/', {
    schema: {
      tags: ['Tags'],
      summary: 'Create a tag',
      security: bearerAuth,
      body: tagBody,
      response: { 201: tagResponse, 400: errorResponse, 401: errorResponse },
    },
    handler: tagsController.create,
  });

  fastify.put('/:id', {
    schema: {
      tags: ['Tags'],
      summary: 'Update a tag',
      security: bearerAuth,
      params: idParam,
      body: updateTagBody,
      response: { 200: tagResponse, 400: errorResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: tagsController.update,
  });

  fastify.delete('/:id', {
    schema: {
      tags: ['Tags'],
      summary: 'Delete a tag',
      security: bearerAuth,
      params: idParam,
      response: { 200: messageResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: tagsController.remove,
  });
}
