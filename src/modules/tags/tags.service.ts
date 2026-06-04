import { prisma } from '../../config/db';
import { CreateTagInput, UpdateTagInput } from './tags.schema';
import { notFound } from '../../utils/errors';

export const listTags = async (userId: string) => {
  return prisma.tag.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  });
};

export const createTag = async (userId: string, data: CreateTagInput) => {
  return prisma.tag.create({
    data: {
      userId,
      ...data,
    },
  });
};

export const updateTag = async (userId: string, id: string, data: UpdateTagInput) => {
  const tag = await prisma.tag.findFirst({
    where: { id, userId },
  });

  if (!tag) {
    throw notFound('Tag not found');
  }

  return prisma.tag.update({
    where: { id },
    data,
  });
};

export const deleteTag = async (userId: string, id: string) => {
  const tag = await prisma.tag.findFirst({
    where: { id, userId },
  });

  if (!tag) {
    throw notFound('Tag not found');
  }

  return prisma.tag.delete({
    where: { id },
  });
};
