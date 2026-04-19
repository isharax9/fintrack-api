import { prisma } from '../../config/db';
import { CreateAccountInput, UpdateAccountInput } from './accounts.schema';

export const listAccounts = async (userId: string) => {
  return prisma.account.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  });
};

export const createAccount = async (userId: string, data: CreateAccountInput) => {
  return prisma.account.create({
    data: {
      userId,
      ...data,
    },
  });
};

export const updateAccount = async (userId: string, id: string, data: UpdateAccountInput) => {
  const account = await prisma.account.findFirst({
    where: { id, userId },
  });

  if (!account) {
    throw new Error('Account not found');
  }

  return prisma.account.update({
    where: { id },
    data,
  });
};

export const deleteAccount = async (userId: string, id: string) => {
  const account = await prisma.account.findFirst({
    where: { id, userId },
  });

  if (!account) {
    throw new Error('Account not found');
  }

  return prisma.account.delete({
    where: { id },
  });
};
