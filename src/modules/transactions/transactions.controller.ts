import { FastifyRequest, FastifyReply } from 'fastify';
import * as transactionsService from './transactions.service';
import { 
  createTransactionSchema, 
  updateTransactionSchema, 
  transactionQuerySchema,
  transactionParamsSchema
} from './transactions.schema';

export const list = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const query = transactionQuerySchema.parse(request.query);
    const result = await transactionsService.listTransactions(userId, query);
    return reply.send(result);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const create = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const data = createTransactionSchema.parse(request.body);
    const result = await transactionsService.createTransaction(userId, data);
    return reply.code(201).send(result);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const getOne = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const { id } = transactionParamsSchema.parse(request.params);
    const result = await transactionsService.getTransaction(userId, id);
    return reply.send(result);
  } catch (error: any) {
    return reply.code(404).send({ message: error.message });
  }
};

export const update = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const { id } = transactionParamsSchema.parse(request.params);
    const data = updateTransactionSchema.parse(request.body);
    const result = await transactionsService.updateTransaction(userId, id, data);
    return reply.send(result);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const remove = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const { id } = transactionParamsSchema.parse(request.params);
    await transactionsService.deleteTransaction(userId, id);
    return reply.send({ message: 'Transaction deleted' });
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};
