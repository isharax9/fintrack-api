import { FastifyReply, FastifyRequest } from 'fastify';
import { auditQuerySchema } from './audit.schema';
import * as auditService from './audit.service';

export const list = async (request: FastifyRequest, reply: FastifyReply) => {
  const userId = (request as any).user.userId;
  const query = auditQuerySchema.parse(request.query);
  const result = await auditService.listAuditLogs(userId, query);
  return reply.send(result);
};
