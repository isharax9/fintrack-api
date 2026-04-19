import { FastifyRequest, FastifyReply } from 'fastify';
import * as pdfService from './pdfService';
import { z } from 'zod';

export const exportTransactionsPdf = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const doc = await pdfService.generateTransactionsPdf(userId);
    
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', 'attachment; filename="transactions.pdf"');
    
    // Send the stream before ending
    reply.send(doc);
    doc.end();
  } catch (error: any) {
    return reply.code(500).send({ message: error.message });
  }
};

const querySchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000).max(2100)
});

export const exportSummaryPdf = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const { month, year } = querySchema.parse(request.query);
    
    const doc = await pdfService.generateSummaryPdf(userId, month, year);
    
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="summary-${month}-${year}.pdf"`);
    
    reply.send(doc);
    doc.end();
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};
