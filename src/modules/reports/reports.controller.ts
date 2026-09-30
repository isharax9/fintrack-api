import { FastifyReply, FastifyRequest } from 'fastify';
import { getAuthContext } from '../../utils/requestContext';
import { reportQuerySchema, simulateSpendSchema } from './reports.schema';
import * as reportsService from './reports.service';

export const safeToSpend = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const result = await reportsService.getSafeToSpend(userId);
  return reply.send(result);
};

export const simulateSpend = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const input = simulateSpendSchema.parse(request.body);
  const result = await reportsService.simulateSpend(userId, input);
  return reply.send(result);
};

export const emailSummary = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const result = await reportsService.emailSafeToSpendSummary(userId);
  return reply.send(result);
};


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
