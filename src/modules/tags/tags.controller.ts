import { FastifyRequest, FastifyReply } from 'fastify';
import * as tagsService from './tags.service';
import { createTagSchema, updateTagSchema, tagParamsSchema } from './tags.schema';

export const list = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const tags = await tagsService.listTags(userId);
    return reply.send(tags);
  } catch (error: any) {
    return reply.code(500).send({ message: error.message });
  }
};

export const create = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const data = createTagSchema.parse(request.body);
    const tag = await tagsService.createTag(userId, data);
    return reply.code(201).send(tag);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const update = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const { id } = tagParamsSchema.parse(request.params);
    const data = updateTagSchema.parse(request.body);
    const tag = await tagsService.updateTag(userId, id, data);
    return reply.send(tag);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const remove = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const { id } = tagParamsSchema.parse(request.params);
    await tagsService.deleteTag(userId, id);
    return reply.send({ message: 'Tag deleted' });
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};
