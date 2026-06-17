import { FastifyReply, FastifyRequest } from 'fastify';
import { getAuthContext } from '../../utils/requestContext';
import { reportQuerySchema } from './reports.schema';
import * as reportsService from './reports.service';

export const summary = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const query = reportQuerySchema.parse(request.query);
  const result = await reportsService.getSummary(userId, query);
  return reply.send(result);
};

export const byCategory = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const query = reportQuerySchema.parse(request.query);
  const result = await reportsService.getByCategory(userId, query);
  return reply.send(result);
};

export const categoryFlow = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const query = reportQuerySchema.parse(request.query);
  const result = await reportsService.getCategoryFlow(userId, query);
  return reply.send(result);
};

export const trend = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const result = await reportsService.getTrend(userId);
  return reply.send(result);
};
