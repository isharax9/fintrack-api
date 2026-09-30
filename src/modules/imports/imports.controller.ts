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

export const importStatement = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  const { dryRun } = importQuerySchema.parse(request.query);
  const body = request.body as { rawText?: string; defaultAccountId?: string };
  if (!body?.rawText || body.rawText.trim().length === 0) {
    throw badRequest('rawText is required for statement import');
  }

  const result = await importsService.importStatementText(
    userId,
    body.rawText,
    dryRun,
    getRequestMetadata(request),
    body.defaultAccountId,
  );

  return reply.code(dryRun ? 200 : 201).send(result);
};


