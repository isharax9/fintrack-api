import { FastifyRequest, FastifyReply } from 'fastify';
import * as categoriesService from './categories.service';
import { createCategorySchema, updateCategorySchema, categoryParamsSchema } from './categories.schema';

export const list = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const categories = await categoriesService.listCategories(userId);
    return reply.send(categories);
  } catch (error: any) {
    return reply.code(500).send({ message: error.message });
  }
};

export const create = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const data = createCategorySchema.parse(request.body);
    const category = await categoriesService.createCategory(userId, data);
    return reply.code(201).send(category);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const update = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const { id } = categoryParamsSchema.parse(request.params);
    const data = updateCategorySchema.parse(request.body);
    const category = await categoriesService.updateCategory(userId, id, data);
    return reply.send(category);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const remove = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const { id } = categoryParamsSchema.parse(request.params);
    await categoriesService.deleteCategory(userId, id);
    return reply.send({ message: 'Category deleted' });
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};
