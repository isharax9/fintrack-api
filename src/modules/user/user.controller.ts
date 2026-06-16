import { FastifyReply, FastifyRequest } from 'fastify';
import { getAuthContext } from '../../utils/requestContext';
import { updateNotificationPreferencesSchema, updateUserSchema, changePasswordSchema } from './user.schema';
import * as userService from './user.service';
import { clearRefreshCookie } from '../auth/auth.cookies';

export const getMe = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const user = await userService.getProfile(userId);
  return reply.send(user);
};

export const updateMe = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const data = updateUserSchema.parse(request.body);
  const user = await userService.updateProfile(userId, data);
  return reply.send(user);
};

export const getNotificationPreferences = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const preferences = await userService.getNotificationPreferences(userId);
  return reply.send(preferences);
};

export const updateNotificationPreferences = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const data = updateNotificationPreferencesSchema.parse(request.body);
  const preferences = await userService.updateNotificationPreferences(userId, data);
  return reply.send(preferences);
};

export const deleteMe = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  await userService.deleteAccount(userId);
  clearRefreshCookie(reply);
  return reply.send({ message: 'Account deleted successfully' });
};

export const changePassword = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { currentPassword, newPassword } = changePasswordSchema.parse(request.body);
  await userService.changePassword(userId, currentPassword, newPassword);
  return reply.send({ message: 'Password updated successfully' });
};
