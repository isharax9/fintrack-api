import { FastifyReply, FastifyRequest } from 'fastify';
import { getAuthContext, getRequestMetadata } from '../../utils/requestContext';
import { createTransferSchema, reverseTransferSchema, transferParamsSchema, transferQuerySchema } from './transfers.schema';
import * as transfersService from './transfers.service';

export const list = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const query = transferQuerySchema.parse(request.query);
  const transfers = await transfersService.listTransfers(userId, query);
  return reply.send(transfers);
};

export const getOne = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = transferParamsSchema.parse(request.params);
  const transfer = await transfersService.getTransfer(userId, id);
  return reply.send(transfer);
};

export const create = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const data = createTransferSchema.parse(request.body);
  const transfer = await transfersService.createTransfer(userId, data, getRequestMetadata(request));
  return reply.code(201).send(transfer);
};

export const reverse = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = transferParamsSchema.parse(request.params);
  const data = reverseTransferSchema.parse(request.body ?? {});
  const transfer = await transfersService.reverseTransfer(userId, id, data, getRequestMetadata(request));
  return reply.code(201).send(transfer);
};
