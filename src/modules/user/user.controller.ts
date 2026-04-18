import { FastifyRequest, FastifyReply } from 'fastify';
import * as userService from './user.service';
import { updateUserSchema } from './user.schema';

export const getMe = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const user = await userService.getProfile(userId);
    return reply.send(user);
  } catch (error: any) {
    return reply.code(404).send({ message: error.message });
  }
};

export const updateMe = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const data = updateUserSchema.parse(request.body);
    const user = await userService.updateProfile(userId, data);
    return reply.send(user);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const deleteMe = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    await userService.deleteAccount(userId);
    return reply.send({ message: 'Account deleted successfully' });
  } catch (error: any) {
    return reply.code(500).send({ message: 'Error deleting account' });
  }
};
