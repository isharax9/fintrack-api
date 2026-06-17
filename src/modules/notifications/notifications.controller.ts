import { FastifyReply, FastifyRequest } from 'fastify';
import { getAuthContext } from '../../utils/requestContext';
import { notificationQuerySchema } from './notifications.schema';
import * as notificationsService from './notifications.service';

export const listNotifications = async (request: FastifyRequest) => {
  const { userId } = getAuthContext(request);
  const query = notificationQuerySchema.parse(request.query);
  return notificationsService.listNotifications(userId, query);
};

export const getUnreadCount = async (request: FastifyRequest) => {
  const { userId } = getAuthContext(request);
  return notificationsService.getUnreadCount(userId);
};

export const markNotificationRead = async (request: FastifyRequest) => {
  const { userId } = getAuthContext(request);
  const { id } = request.params as { id: string };
  return notificationsService.markNotificationRead(userId, id);
};

export const markAllNotificationsRead = async (request: FastifyRequest) => {
  const { userId } = getAuthContext(request);
  return notificationsService.markAllNotificationsRead(userId);
};

export const clearReadNotifications = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const result = await notificationsService.clearReadNotifications(userId);
  return reply.send(result);
};
