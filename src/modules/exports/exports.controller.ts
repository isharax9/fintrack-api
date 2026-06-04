import { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getAuthContext } from '../../utils/requestContext';
import * as pdfService from './pdfService';

const querySchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000).max(2100),
});

export const exportTransactionsPdf = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const doc = await pdfService.generateTransactionsPdf(userId);

  reply.header('Content-Type', 'application/pdf');
  reply.header('Content-Disposition', 'attachment; filename="transactions.pdf"');
  reply.send(doc);
  doc.end();
};

export const exportSummaryPdf = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { month, year } = querySchema.parse(request.query);
  const doc = await pdfService.generateSummaryPdf(userId, month, year);

  reply.header('Content-Type', 'application/pdf');
  reply.header('Content-Disposition', `attachment; filename="summary-${month}-${year}.pdf"`);
  reply.send(doc);
  doc.end();
};
