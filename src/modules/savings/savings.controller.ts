import { FastifyRequest, FastifyReply } from 'fastify';
import * as savingsService from './savings.service';
import { createSavingsGoalSchema, updateSavingsGoalSchema, allocateFundsSchema, savingsParamsSchema } from './savings.schema';

export const getBucket = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const bucket = await savingsService.getBucket(userId);
    return reply.send(bucket);
  } catch (error: any) {
    return reply.code(500).send({ message: error.message });
  }
};

export const listGoals = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const goals = await savingsService.listGoals(userId);
    return reply.send(goals);
  } catch (error: any) {
    return reply.code(500).send({ message: error.message });
  }
};

export const createGoal = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const data = createSavingsGoalSchema.parse(request.body);
    const goal = await savingsService.createGoal(userId, data);
    return reply.code(201).send(goal);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const updateGoal = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const { id } = savingsParamsSchema.parse(request.params);
    const data = updateSavingsGoalSchema.parse(request.body);
    const goal = await savingsService.updateGoal(userId, id, data);
    return reply.send(goal);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const allocateFunds = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const { id } = savingsParamsSchema.parse(request.params);
    const data = allocateFundsSchema.parse(request.body);
    const goal = await savingsService.allocateGoalFunds(userId, id, data);
    return reply.send(goal);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const removeGoal = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const { id } = savingsParamsSchema.parse(request.params);
    await savingsService.deleteGoal(userId, id);
    return reply.send({ message: 'Goal deleted & funds returned to bucket' });
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};
