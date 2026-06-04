import { prisma } from '../../config/db';
import { CreateAccountInput, UpdateAccountInput } from './accounts.schema';
import { createAuditLog } from '../audit/audit.service';
import { RequestMetadata } from '../../utils/requestContext';
import { badRequest, notFound } from '../../utils/errors';

export const listAccounts = async (userId: string) => {
  return prisma.account.findMany({
    where: { userId },
    orderBy: { name: 'asc' },
  });
};

export const createAccount = async (userId: string, data: CreateAccountInput, metadata: RequestMetadata) => {
  return prisma.$transaction(async (tx) => {
    const account = await tx.account.create({
      data: {
        userId,
        ...data,
      },
    });

    await createAuditLog({
      userId,
      action: 'ACCOUNT_CREATED',
      entityType: 'Account',
      entityId: account.id,
      ...metadata,
      metadata: { name: account.name, type: account.type },
    }, tx);

    return account;
  });
};

export const updateAccount = async (userId: string, id: string, data: UpdateAccountInput, metadata: RequestMetadata) => {
  const account = await prisma.account.findFirst({
    where: { id, userId },
  });

  if (!account) {
    throw notFound('Account not found');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.account.update({
      where: { id },
      data,
    });

    await createAuditLog({
      userId,
      action: 'ACCOUNT_UPDATED',
      entityType: 'Account',
      entityId: updated.id,
      ...metadata,
      metadata: { previousName: account.name, name: updated.name, previousType: account.type, type: updated.type },
    }, tx);

    return updated;
  });
};

export const deleteAccount = async (userId: string, id: string, metadata: RequestMetadata) => {
  const account = await prisma.account.findFirst({
    where: { id, userId },
  });

  if (!account) {
    throw notFound('Account not found');
  }

  const linkedUsage = await prisma.account.findFirst({
    where: {
      id,
      userId,
      OR: [
        { transactions: { some: {} } },
        { transfersFrom: { some: {} } },
        { transfersTo: { some: {} } },
        { recurringTransactions: { some: {} } },
      ],
    },
    select: { id: true },
  });

  if (linkedUsage) {
    throw badRequest('Cannot delete an account with transactions, transfers, or recurring transactions');
  }

  return prisma.$transaction(async (tx) => {
    const deleted = await tx.account.delete({
      where: { id },
    });

    await createAuditLog({
      userId,
      action: 'ACCOUNT_DELETED',
      entityType: 'Account',
      entityId: id,
      ...metadata,
      metadata: { name: deleted.name, type: deleted.type },
    }, tx);

    return deleted;
  });
};
