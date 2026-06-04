import { FastifyReply, FastifyRequest } from 'fastify';
import { getAuthContext, getRequestMetadata } from '../../utils/requestContext';
import { createTransferSchema } from './transfers.schema';
import * as transfersService from './transfers.service';

export const list = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const transfers = await transfersService.listTransfers(userId);
  return reply.send(transfers);
};

export const create = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const data = createTransferSchema.parse(request.body);
  const transfer = await transfersService.createTransfer(userId, data, getRequestMetadata(request));
  return reply.code(201).send(transfer);
};
