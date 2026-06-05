import { prisma } from '../../config/db';
import { CreateCategoryInput, UpdateCategoryInput } from './categories.schema';
import { badRequest, notFound } from '../../utils/errors';
import { createAuditLog } from '../audit/audit.service';
import { RequestMetadata } from '../../utils/requestContext';

export const listCategories = async (userId: string) => {
  return prisma.category.findMany({
    where: { userId },
    orderBy: [
      { isDefault: 'desc' },
      { name: 'asc' }
    ]
  });
};

export const createCategory = async (userId: string, data: CreateCategoryInput, metadata: RequestMetadata) => {
  return prisma.$transaction(async (tx) => {
    const category = await tx.category.create({
      data: {
        ...data,
        userId,
        isDefault: false
      }
    });

    await createAuditLog({
      userId,
      action: 'CATEGORY_CREATED',
      entityType: 'Category',
      entityId: category.id,
      ...metadata,
      metadata: { name: category.name, color: category.color, icon: category.icon },
    }, tx);

    return category;
  });
};

export const updateCategory = async (userId: string, id: string, data: UpdateCategoryInput, metadata: RequestMetadata) => {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category || category.userId !== userId) throw notFound('Category not found');
  
  return prisma.$transaction(async (tx) => {
    const updated = await tx.category.update({
      where: { id },
      data
    });

    await createAuditLog({
      userId,
      action: 'CATEGORY_UPDATED',
      entityType: 'Category',
      entityId: updated.id,
      ...metadata,
      metadata: {
        previousName: category.name,
        name: updated.name,
        previousColor: category.color,
        color: updated.color,
        previousIcon: category.icon,
        icon: updated.icon,
      },
    }, tx);

    return updated;
  });
};

export const deleteCategory = async (userId: string, id: string, metadata: RequestMetadata) => {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category || category.userId !== userId) throw notFound('Category not found');
  if (category.isDefault) throw badRequest('Cannot delete default categories');

  await prisma.$transaction(async (tx) => {
    await tx.category.delete({ where: { id } });
    await createAuditLog({
      userId,
      action: 'CATEGORY_DELETED',
      entityType: 'Category',
      entityId: id,
      ...metadata,
      metadata: { name: category.name, color: category.color, icon: category.icon },
    }, tx);
  });
};
