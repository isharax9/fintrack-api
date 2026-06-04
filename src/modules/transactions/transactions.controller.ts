import { FastifyReply, FastifyRequest } from 'fastify';
import { getAuthContext, getRequestMetadata } from '../../utils/requestContext';
import {
  createTransactionSchema,
  transactionParamsSchema,
  transactionQuerySchema,
  updateTransactionSchema,
} from './transactions.schema';
import * as transactionsService from './transactions.service';

export const list = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const query = transactionQuerySchema.parse(request.query);
  const result = await transactionsService.listTransactions(userId, query);
  return reply.send(result);
};

export const create = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const data = createTransactionSchema.parse(request.body);
  const result = await transactionsService.createTransaction(userId, data, getRequestMetadata(request));
  return reply.code(201).send(result);
};

export const getOne = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = transactionParamsSchema.parse(request.params);
  const result = await transactionsService.getTransaction(userId, id);
  return reply.send(result);
};

export const update = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = transactionParamsSchema.parse(request.params);
  const data = updateTransactionSchema.parse(request.body);
  const result = await transactionsService.updateTransaction(userId, id, data, getRequestMetadata(request));
  return reply.send(result);
};

export const remove = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = transactionParamsSchema.parse(request.params);
  await transactionsService.deleteTransaction(userId, id, getRequestMetadata(request));
  return reply.send({ message: 'Transaction deleted' });
};
