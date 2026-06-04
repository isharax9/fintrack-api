import { Prisma } from '@prisma/client';
import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);

export const unauthorized = (message = 'Unauthorized') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const notFound = (message = 'Not found') =>
  new AppError(404, 'NOT_FOUND', message);

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, 'CONFLICT', message, details);

export const formatErrorResponse = (error: unknown, requestId?: string) => {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        requestId,
      },
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors,
        },
        requestId,
      },
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return {
      statusCode: 409,
      body: {
        error: {
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          message: 'A record with these values already exists',
          details: error.meta,
        },
        requestId,
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Unexpected server error',
      },
      requestId,
    },
  };
};

export const errorHandler = async (
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const requestId = String(request.id);
  const response = formatErrorResponse(error, requestId);

  if (response.statusCode >= 500) {
    request.log.error({ err: error, requestId }, 'Unhandled request error');
  } else {
    request.log.warn({ err: error, requestId }, 'Request error');
  }

  return reply.code(response.statusCode).send(response.body);
};
