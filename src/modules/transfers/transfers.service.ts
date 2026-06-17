import { prisma } from '../../config/db';
import { CreateTransferInput, ReverseTransferInput, TransferQuery } from './transfers.schema';
import { createAuditLog } from '../audit/audit.service';
import { RequestMetadata } from '../../utils/requestContext';
import { badRequest, notFound } from '../../utils/errors';
import { Prisma, TransferStatus } from '@prisma/client';

const transferInclude = {
  fromAccount: true,
  toAccount: true,
  reversal: {
    select: {
      id: true,
      date: true,
      amount: true,
      status: true,
      notes: true,
    },
  },
  reversalOf: {
    select: {
      id: true,
      date: true,
      amount: true,
      status: true,
      notes: true,
    },
  },
} satisfies Prisma.TransferInclude;

export const buildTransferWhere = (userId: string, query: TransferQuery) => {
  const where: Prisma.TransferWhereInput = { userId };

  if (query.accountId) {
    where.OR = [
      { fromAccountId: query.accountId },
      { toAccountId: query.accountId },
    ];
  }
  if (query.fromAccountId) where.fromAccountId = query.fromAccountId;
  if (query.toAccountId) where.toAccountId = query.toAccountId;
  if (query.status) where.status = query.status;
  if (query.from || query.to) {
    where.date = {};
    if (query.from) where.date.gte = new Date(query.from);
    if (query.to) where.date.lte = new Date(query.to);
  }

  return where;
};

export const listTransfers = async (userId: string, query: TransferQuery) => {
  const where = buildTransferWhere(userId, query);
  const skip = (query.page - 1) * query.limit;

  const [data, total] = await Promise.all([
    prisma.transfer.findMany({
      where,
      include: transferInclude,
      orderBy: { date: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.transfer.count({ where }),
  ]);

  return {
    data,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const getTransfer = async (userId: string, id: string) => {
  const transfer = await prisma.transfer.findFirst({
    where: { id, userId },
    include: transferInclude,
  });

  if (!transfer) throw notFound('Transfer not found');
  return transfer;
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
        status: TransferStatus.POSTED,
      },
      include: transferInclude,
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

export const reverseTransfer = async (
  userId: string,
  id: string,
  data: ReverseTransferInput,
  metadata: RequestMetadata,
) => {
  const transfer = await getTransfer(userId, id);

  if (transfer.status !== TransferStatus.POSTED) {
    throw badRequest('Only posted transfers can be reversed');
  }

  if (transfer.reversal) {
    throw badRequest('Transfer has already been reversed');
  }

  return prisma.$transaction(async (tx) => {
    await tx.account.update({
      where: { id: transfer.fromAccountId },
      data: { balance: { increment: transfer.amount } },
    });

    await tx.account.update({
      where: { id: transfer.toAccountId },
      data: { balance: { decrement: transfer.amount } },
    });

    const reversal = await tx.transfer.create({
      data: {
        userId,
        fromAccountId: transfer.toAccountId,
        toAccountId: transfer.fromAccountId,
        amount: transfer.amount,
        date: new Date(),
        notes: data.notes || `Reversal of transfer ${transfer.id}`,
        status: TransferStatus.REVERSAL,
        reversalOfId: transfer.id,
      },
      include: transferInclude,
    });

    await tx.transfer.update({
      where: { id: transfer.id },
      data: {
        status: TransferStatus.REVERSED,
        reversedAt: reversal.date,
      },
    });

    await createAuditLog({
      userId,
      action: 'TRANSFER_REVERSED',
      entityType: 'Transfer',
      entityId: transfer.id,
      ...metadata,
      metadata: {
        reversalTransferId: reversal.id,
        fromAccountId: transfer.fromAccountId,
        toAccountId: transfer.toAccountId,
        amount: transfer.amount.toString(),
      },
    }, tx);

    return reversal;
  });
};
