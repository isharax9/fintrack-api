import { prisma } from '../../config/db';
import { CreateTagInput, UpdateTagInput } from './tags.schema';

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
    throw new Error('Tag not found');
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
    throw new Error('Tag not found');
  }

  return prisma.tag.delete({
    where: { id },
  });
};
