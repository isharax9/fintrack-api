import { FastifyReply, FastifyRequest } from 'fastify';
import { getAuthContext, getRequestMetadata } from '../../utils/requestContext';
import { accountParamsSchema, createAccountSchema, updateAccountSchema } from './accounts.schema';
import * as accountsService from './accounts.service';

export const list = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const accounts = await accountsService.listAccounts(userId);
  return reply.send(accounts);
};

export const create = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const data = createAccountSchema.parse(request.body);
  const account = await accountsService.createAccount(userId, data, getRequestMetadata(request));
  return reply.code(201).send(account);
};

export const update = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = accountParamsSchema.parse(request.params);
  const data = updateAccountSchema.parse(request.body);
  const account = await accountsService.updateAccount(userId, id, data, getRequestMetadata(request));
  return reply.send(account);
};

export const remove = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = accountParamsSchema.parse(request.params);
  await accountsService.deleteAccount(userId, id, getRequestMetadata(request));
  return reply.send({ message: 'Account deleted' });
};
