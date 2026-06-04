import { FastifyReply, FastifyRequest } from 'fastify';
import {
  createRecurringSchema,
  recurringParamsSchema,
  recurringQuerySchema,
  updateRecurringSchema,
} from './recurring.schema';
import * as recurringService from './recurring.service';

const getUserId = (request: FastifyRequest) => (request as any).user.userId as string;

export const list = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const result = await recurringService.listRecurring(
      getUserId(request),
      recurringQuerySchema.parse(request.query),
    );
    return reply.send(result);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const create = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const result = await recurringService.createRecurring(
      getUserId(request),
      createRecurringSchema.parse(request.body),
    );
    return reply.code(201).send(result);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const getOne = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = recurringParamsSchema.parse(request.params);
    const result = await recurringService.getRecurring(getUserId(request), id);
    return reply.send(result);
  } catch (error: any) {
    return reply.code(404).send({ message: error.message });
  }
};

export const update = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = recurringParamsSchema.parse(request.params);
    const result = await recurringService.updateRecurring(
      getUserId(request),
      id,
      updateRecurringSchema.parse(request.body),
    );
    return reply.send(result);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const remove = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { id } = recurringParamsSchema.parse(request.params);
    await recurringService.deleteRecurring(getUserId(request), id);
    return reply.send({ message: 'Recurring transaction deleted' });
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};
