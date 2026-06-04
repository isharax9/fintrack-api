import { FastifyReply, FastifyRequest } from 'fastify';
import { getAuthContext } from '../../utils/requestContext';
import { categoryParamsSchema, createCategorySchema, updateCategorySchema } from './categories.schema';
import * as categoriesService from './categories.service';

export const list = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const categories = await categoriesService.listCategories(userId);
  return reply.send(categories);
};

export const create = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const data = createCategorySchema.parse(request.body);
  const category = await categoriesService.createCategory(userId, data);
  return reply.code(201).send(category);
};

export const update = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = categoryParamsSchema.parse(request.params);
  const data = updateCategorySchema.parse(request.body);
  const category = await categoriesService.updateCategory(userId, id, data);
  return reply.send(category);
};

export const remove = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = categoryParamsSchema.parse(request.params);
  await categoriesService.deleteCategory(userId, id);
  return reply.send({ message: 'Category deleted' });
};
