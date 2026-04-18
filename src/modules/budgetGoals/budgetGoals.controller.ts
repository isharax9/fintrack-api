import { FastifyRequest, FastifyReply } from 'fastify';
import * as budgetGoalsService from './budgetGoals.service';
import { 
  createBudgetGoalSchema, 
  updateBudgetGoalSchema, 
  budgetGoalQuerySchema,
  budgetGoalParamsSchema
} from './budgetGoals.schema';

export const list = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const query = budgetGoalQuerySchema.parse(request.query);
    const result = await budgetGoalsService.listBudgetGoals(userId, query);
    return reply.send(result);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const create = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const data = createBudgetGoalSchema.parse(request.body);
    const result = await budgetGoalsService.createBudgetGoal(userId, data);
    return reply.code(201).send(result);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const update = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const { id } = budgetGoalParamsSchema.parse(request.params);
    const data = updateBudgetGoalSchema.parse(request.body);
    const result = await budgetGoalsService.updateBudgetGoal(userId, id, data);
    return reply.send(result);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const remove = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const { id } = budgetGoalParamsSchema.parse(request.params);
    await budgetGoalsService.deleteBudgetGoal(userId, id);
    return reply.send({ message: 'Budget goal deleted' });
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};
