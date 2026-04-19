import { FastifyRequest, FastifyReply } from 'fastify';
import * as transfersService from './transfers.service';
import { createTransferSchema } from './transfers.schema';

export const list = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const transfers = await transfersService.listTransfers(userId);
    return reply.send(transfers);
  } catch (error: any) {
    return reply.code(500).send({ message: error.message });
  }
};

export const create = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const data = createTransferSchema.parse(request.body);
    const transfer = await transfersService.createTransfer(userId, data);
    return reply.code(201).send(transfer);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};
