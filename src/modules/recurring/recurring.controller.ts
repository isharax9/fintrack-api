import { FastifyReply, FastifyRequest } from 'fastify';
import { getAuthContext, getRequestMetadata } from '../../utils/requestContext';
import {
  createRecurringSchema,
  recurringExecutionQuerySchema,
  recurringParamsSchema,
  recurringQuerySchema,
  updateRecurringSchema,
} from './recurring.schema';
import * as recurringService from './recurring.service';

export const list = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const result = await recurringService.listRecurring(userId, recurringQuerySchema.parse(request.query));
  return reply.send(result);
};

export const create = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const result = await recurringService.createRecurring(userId, createRecurringSchema.parse(request.body), getRequestMetadata(request));
  return reply.code(201).send(result);
};

export const getOne = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = recurringParamsSchema.parse(request.params);
  const result = await recurringService.getRecurring(userId, id);
  return reply.send(result);
};

export const update = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = recurringParamsSchema.parse(request.params);
  const result = await recurringService.updateRecurring(userId, id, updateRecurringSchema.parse(request.body), getRequestMetadata(request));
  return reply.send(result);
};

export const remove = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = recurringParamsSchema.parse(request.params);
  await recurringService.deleteRecurring(userId, id, getRequestMetadata(request));
  return reply.send({ message: 'Recurring transaction deleted' });
};

export const runNow = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = recurringParamsSchema.parse(request.params);
  const result = await recurringService.runRecurringNow(userId, id, getRequestMetadata(request));
  return reply.send(result);
};

export const skipNext = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = recurringParamsSchema.parse(request.params);
  const result = await recurringService.skipNextRecurring(userId, id, getRequestMetadata(request));
  return reply.send(result);
};

export const history = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = recurringParamsSchema.parse(request.params);
  const result = await recurringService.listRecurringExecutions(
    userId,
    id,
    recurringExecutionQuerySchema.parse(request.query),
  );
  return reply.send(result);
};
