import { prisma } from '../../config/db';
import { CreateCategoryInput, UpdateCategoryInput } from './categories.schema';

export const listCategories = async (userId: string) => {
  return prisma.category.findMany({
    where: { userId },
    orderBy: [
      { isDefault: 'desc' },
      { name: 'asc' }
    ]
  });
};

export const createCategory = async (userId: string, data: CreateCategoryInput) => {
  return prisma.category.create({
    data: {
      ...data,
      userId,
      isDefault: false
    }
  });
};

export const updateCategory = async (userId: string, id: string, data: UpdateCategoryInput) => {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category || category.userId !== userId) throw new Error('Category not found');
  
  return prisma.category.update({
    where: { id },
    data
  });
};

export const deleteCategory = async (userId: string, id: string) => {
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category || category.userId !== userId) throw new Error('Category not found');
  if (category.isDefault) throw new Error('Cannot delete default categories');

  await prisma.category.delete({ where: { id } });
};
