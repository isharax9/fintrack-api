import { FastifyReply, FastifyRequest } from 'fastify';
import { getAuthContext, getRequestMetadata } from '../../utils/requestContext';
import {
  allocateFundsSchema,
  bucketAdjustmentSchema,
  createSavingsGoalSchema,
  savingsParamsSchema,
  updateSavingsGoalSchema,
} from './savings.schema';
import * as savingsService from './savings.service';

export const getBucket = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const bucket = await savingsService.getBucket(userId);
  return reply.send(bucket);
};

export const listGoals = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const goals = await savingsService.listGoals(userId);
  return reply.send(goals);
};

export const depositBucket = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const data = bucketAdjustmentSchema.parse(request.body);
  const bucket = await savingsService.adjustBucket(userId, 'deposit', data, getRequestMetadata(request));
  return reply.send(bucket);
};

export const withdrawBucket = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const data = bucketAdjustmentSchema.parse(request.body);
  const bucket = await savingsService.adjustBucket(userId, 'withdraw', data, getRequestMetadata(request));
  return reply.send(bucket);
};

export const createGoal = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const data = createSavingsGoalSchema.parse(request.body);
  const goal = await savingsService.createGoal(userId, data);
  return reply.code(201).send(goal);
};

export const updateGoal = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = savingsParamsSchema.parse(request.params);
  const data = updateSavingsGoalSchema.parse(request.body);
  const goal = await savingsService.updateGoal(userId, id, data);
  return reply.send(goal);
};

export const allocateFunds = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = savingsParamsSchema.parse(request.params);
  const data = allocateFundsSchema.parse(request.body);
  const goal = await savingsService.allocateGoalFunds(userId, id, data, getRequestMetadata(request));
  return reply.send(goal);
};

export const removeGoal = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = savingsParamsSchema.parse(request.params);
  await savingsService.deleteGoal(userId, id);
  return reply.send({ message: 'Goal deleted & funds returned to bucket' });
};
