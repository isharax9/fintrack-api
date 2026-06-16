import { FastifyReply, FastifyRequest } from 'fastify';
import { getAuthContext, getRequestMetadata } from '../../utils/requestContext';
import { badRequest } from '../../utils/errors';
import { importQuerySchema } from './imports.schema';
import * as importsService from './imports.service';

export const importTransactions = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { dryRun } = importQuerySchema.parse(request.query);
  const file = await request.file();

  if (!file) throw badRequest('CSV file is required');
  if (!['text/csv', 'application/vnd.ms-excel', 'text/plain'].includes(file.mimetype)) {
    throw badRequest('Only CSV files are supported');
  }

  const buffer = await file.toBuffer();
  if (buffer.length === 0) throw badRequest('CSV file is empty');

  const result = await importsService.importTransactionsCsv(
    userId,
    buffer.toString('utf8'),
    dryRun,
    getRequestMetadata(request),
  );

  return reply.code(dryRun ? 200 : 201).send(result);
};

