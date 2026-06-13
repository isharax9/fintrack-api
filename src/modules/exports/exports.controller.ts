import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getAuthContext, getRequestMetadata } from '../../utils/requestContext';
import { createAuditLog } from '../audit/audit.service';
import { transactionQuerySchema } from '../transactions/transactions.schema';
import * as pdfService from './pdfService';

const querySchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000).max(2100),
});

export const exportTransactionsPdf = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const query = transactionQuerySchema.parse(request.query);
  const doc = await pdfService.generateTransactionsPdf(userId, query);
  await createAuditLog({
    userId,
    action: 'EXPORT_TRANSACTIONS_PDF',
    entityType: 'Export',
    ...getRequestMetadata(request),
    metadata: { format: 'pdf', report: 'transactions', filters: query },
  });

  reply.header('Content-Type', 'application/pdf');
  reply.header('Content-Disposition', 'attachment; filename="transactions.pdf"');
  reply.send(doc);
  doc.end();
};

export const exportSummaryPdf = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { month, year } = querySchema.parse(request.query);
  const doc = await pdfService.generateSummaryPdf(userId, month, year);
  await createAuditLog({
    userId,
    action: 'EXPORT_SUMMARY_PDF',
    entityType: 'Export',
    ...getRequestMetadata(request),
    metadata: { format: 'pdf', report: 'summary', month, year },
  });

  reply.header('Content-Type', 'application/pdf');
  reply.header('Content-Disposition', `attachment; filename="summary-${month}-${year}.pdf"`);
  reply.send(doc);
  doc.end();
};
