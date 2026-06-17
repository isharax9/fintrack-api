import { prisma } from '../../config/db';
import { CreateTagInput, UpdateTagInput } from './tags.schema';
import { conflict, notFound } from '../../utils/errors';
import { createAuditLog } from '../audit/audit.service';
import { RequestMetadata } from '../../utils/requestContext';

export const listTags = async (userId: string) => {
  return prisma.tag.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  });
};

export const createTag = async (userId: string, data: CreateTagInput, metadata: RequestMetadata) => {
  const existing = await prisma.tag.findFirst({
    where: { userId, name: { equals: data.name, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) {
    throw conflict('Tag already exists');
  }

  return prisma.$transaction(async (tx) => {
    const tag = await tx.tag.create({
      data: {
        userId,
        ...data,
      },
    });

    await createAuditLog({
      userId,
      action: 'TAG_CREATED',
      entityType: 'Tag',
      entityId: tag.id,
      ...metadata,
      metadata: { name: tag.name },
    }, tx);

    return tag;
  });
};

export const updateTag = async (userId: string, id: string, data: UpdateTagInput, metadata: RequestMetadata) => {
  const tag = await prisma.tag.findFirst({
    where: { id, userId },
  });

  if (!tag) {
    throw notFound('Tag not found');
  }

  if (data.name && data.name.toLowerCase() !== tag.name.toLowerCase()) {
    const existing = await prisma.tag.findFirst({
      where: { userId, name: { equals: data.name, mode: 'insensitive' }, NOT: { id } },
      select: { id: true },
    });
    if (existing) {
      throw conflict('Tag already exists');
    }
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.tag.update({
      where: { id },
      data,
    });

    await createAuditLog({
      userId,
      action: 'TAG_UPDATED',
      entityType: 'Tag',
      entityId: updated.id,
      ...metadata,
      metadata: { previousName: tag.name, name: updated.name },
    }, tx);

    return updated;
  });
};

export const deleteTag = async (userId: string, id: string, metadata: RequestMetadata) => {
  const tag = await prisma.tag.findFirst({
    where: { id, userId },
  });

  if (!tag) {
    throw notFound('Tag not found');
  }

  return prisma.$transaction(async (tx) => {
    const deleted = await tx.tag.delete({
      where: { id },
    });

    await createAuditLog({
      userId,
      action: 'TAG_DELETED',
      entityType: 'Tag',
      entityId: id,
      ...metadata,
      metadata: { name: tag.name },
    }, tx);

    return deleted;
  });
};
