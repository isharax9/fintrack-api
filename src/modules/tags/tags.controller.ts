import { FastifyReply, FastifyRequest } from 'fastify';
import { getAuthContext } from '../../utils/requestContext';
import { createTagSchema, tagParamsSchema, updateTagSchema } from './tags.schema';
import * as tagsService from './tags.service';

export const list = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const tags = await tagsService.listTags(userId);
  return reply.send(tags);
};

export const create = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const data = createTagSchema.parse(request.body);
  const tag = await tagsService.createTag(userId, data);
  return reply.code(201).send(tag);
};

export const update = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = tagParamsSchema.parse(request.params);
  const data = updateTagSchema.parse(request.body);
  const tag = await tagsService.updateTag(userId, id, data);
  return reply.send(tag);
};

export const remove = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { id } = tagParamsSchema.parse(request.params);
  await tagsService.deleteTag(userId, id);
  return reply.send({ message: 'Tag deleted' });
};
