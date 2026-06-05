import { prisma } from '../../config/db';
import { CreateTransferInput } from './transfers.schema';
import { createAuditLog } from '../audit/audit.service';
import { RequestMetadata } from '../../utils/requestContext';
import { badRequest } from '../../utils/errors';

export const listTransfers = async (userId: string) => {
  return prisma.transfer.findMany({
    where: { userId },
    include: {
      fromAccount: true,
      toAccount: true,
    },
    orderBy: { date: 'desc' },
  });
};

export const createTransfer = async (userId: string, data: CreateTransferInput, metadata: RequestMetadata) => {
  if (data.fromAccountId === data.toAccountId) {
    throw badRequest('Transfer accounts must be different');
  }

  const accountFrom = await prisma.account.findFirst({ where: { id: data.fromAccountId, userId }});
  const accountTo = await prisma.account.findFirst({ where: { id: data.toAccountId, userId }});

  if (!accountFrom || !accountTo) {
    throw badRequest('One or both accounts not found or do not belong to user');
  }

  return prisma.$transaction(async (tx) => {
    const transfer = await tx.transfer.create({
      data: {
        userId,
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        amount: data.amount,
        notes: data.notes,
        date: data.date ? new Date(data.date) : new Date(),
      },
    });

    await tx.account.update({
      where: { id: data.fromAccountId },
      data: { balance: { decrement: data.amount } },
    });

    await tx.account.update({
      where: { id: data.toAccountId },
      data: { balance: { increment: data.amount } },
    });

    await createAuditLog({
      userId,
      action: 'TRANSFER_CREATED',
      entityType: 'Transfer',
      entityId: transfer.id,
      ...metadata,
      metadata: {
        fromAccountId: transfer.fromAccountId,
        toAccountId: transfer.toAccountId,
        amount: transfer.amount.toString(),
      },
    }, tx);

    return transfer;
  });
};
