import { FastifyInstance } from 'fastify';
import {
  bearerAuth,
  errorResponse,
  idParam,
  messageResponse,
  notificationCountResponse,
  notificationResponse,
  paginatedNotificationsResponse,
} from '../../utils/openapi';
import * as notificationsController from './notifications.controller';

export default async function notificationsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/', {
    schema: {
      tags: ['Notifications'],
      summary: 'List current user notifications',
      security: bearerAuth,
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
          unreadOnly: { type: 'boolean' },
        },
      },
      response: { 200: paginatedNotificationsResponse, 401: errorResponse },
    },
    handler: notificationsController.listNotifications,
  });

  fastify.get('/unread-count', {
    schema: {
      tags: ['Notifications'],
      summary: 'Get unread notification count',
      security: bearerAuth,
      response: { 200: notificationCountResponse, 401: errorResponse },
    },
    handler: notificationsController.getUnreadCount,
  });

  fastify.post('/:id/read', {
    schema: {
      tags: ['Notifications'],
      summary: 'Mark a notification as read',
      security: bearerAuth,
      params: idParam,
      response: { 200: notificationResponse, 401: errorResponse, 404: errorResponse },
    },
    handler: notificationsController.markNotificationRead,
  });

  fastify.post('/read-all', {
    schema: {
      tags: ['Notifications'],
      summary: 'Mark all notifications as read',
      security: bearerAuth,
      response: { 200: messageResponse, 401: errorResponse },
    },
    handler: notificationsController.markAllNotificationsRead,
  });

  fastify.delete('/read', {
    schema: {
      tags: ['Notifications'],
      summary: 'Clear read notifications',
      security: bearerAuth,
      response: { 200: messageResponse, 401: errorResponse },
    },
    handler: notificationsController.clearReadNotifications,
  });
}
