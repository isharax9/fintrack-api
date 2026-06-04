import { FastifyReply, FastifyRequest } from 'fastify';
import { getAuthContext, getRequestMetadata } from '../../utils/requestContext';
import {
  budgetGoalParamsSchema,
  budgetGoalQuerySchema,
  createBudgetGoalSchema,
  updateBudgetGoalSchema,
} from './budgetGoals.schema';
import * as budgetGoalsService from './budgetGoals.service';

export const list = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const query = budgetGoalQuerySchema.parse(request.query);
  const result = await budgetGoalsService.listBudgetGoals(userId, query);
  return reply.send(result);
};

export const create = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const data = createBudgetGoalSchema.parse(request.body);
  const result = await budgetGoalsService.createBudgetGoal(userId, data, getRequestMetadata(request));
  return reply.code(201).send(result);
};

export const update = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = budgetGoalParamsSchema.parse(request.params);
  const data = updateBudgetGoalSchema.parse(request.body);
  const result = await budgetGoalsService.updateBudgetGoal(userId, id, data, getRequestMetadata(request));
  return reply.send(result);
};

export const remove = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = budgetGoalParamsSchema.parse(request.params);
  await budgetGoalsService.deleteBudgetGoal(userId, id, getRequestMetadata(request));
  return reply.send({ message: 'Budget goal deleted' });
};
