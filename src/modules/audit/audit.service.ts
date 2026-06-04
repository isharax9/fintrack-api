import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';
import { hashOptional } from '../../utils/security';
import { AuditQuery } from './audit.schema';

type AuditClient = Prisma.TransactionClient | typeof prisma;

export type AuditInput = {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  requestId?: string;
  ip?: string;
  userAgent?: string | string[];
  metadata?: Prisma.InputJsonValue;
};

export const createAuditLog = async (input: AuditInput, client: AuditClient = prisma) => {
  return client.auditLog.create({
    data: {
      userId: input.userId ?? undefined,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? undefined,
      requestId: input.requestId,
      ipHash: hashOptional(input.ip),
      userAgentHash: hashOptional(input.userAgent),
      metadata: input.metadata,
    },
  });
};

export const listAuditLogs = async (userId: string, query: AuditQuery) => {
  const where: Prisma.AuditLogWhereInput = { userId };
  if (query.action) where.action = query.action;
  if (query.entityType) where.entityType = query.entityType;

  const skip = (query.page - 1) * query.limit;

  const [data, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.auditLog.count({ where }),
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
