import { prisma } from '../../config/db';
import { UpdateUserInput } from './user.schema';

export const getProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
    }
  });
  if (!user) throw new Error('User not found');
  return user;
};

export const updateProfile = async (userId: string, data: UpdateUserInput) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
    }
  });
  return user;
};

export const deleteAccount = async (userId: string) => {
  await prisma.user.delete({
    where: { id: userId }
  });
};
