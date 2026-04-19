import { FastifyRequest, FastifyReply } from 'fastify';
import * as accountsService from './accounts.service';
import { createAccountSchema, updateAccountSchema, accountParamsSchema } from './accounts.schema';

export const list = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const accounts = await accountsService.listAccounts(userId);
    return reply.send(accounts);
  } catch (error: any) {
    return reply.code(500).send({ message: error.message });
  }
};

export const create = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const data = createAccountSchema.parse(request.body);
    const account = await accountsService.createAccount(userId, data);
    return reply.code(201).send(account);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const update = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const { id } = accountParamsSchema.parse(request.params);
    const data = updateAccountSchema.parse(request.body);
    const account = await accountsService.updateAccount(userId, id, data);
    return reply.send(account);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const remove = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const { id } = accountParamsSchema.parse(request.params);
    await accountsService.deleteAccount(userId, id);
    return reply.send({ message: 'Account deleted' });
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};
