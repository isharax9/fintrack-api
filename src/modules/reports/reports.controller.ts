import { FastifyRequest, FastifyReply } from 'fastify';
import * as reportsService from './reports.service';
import { reportQuerySchema } from './reports.schema';

export const summary = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const query = reportQuerySchema.parse(request.query);
    const result = await reportsService.getSummary(userId, query);
    return reply.send(result);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const byCategory = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const query = reportQuerySchema.parse(request.query);
    const result = await reportsService.getByCategory(userId, query);
    return reply.send(result);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const trend = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const result = await reportsService.getTrend(userId);
    return reply.send(result);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};
