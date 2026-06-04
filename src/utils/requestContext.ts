import { FastifyRequest } from 'fastify';
import { unauthorized } from './errors';

export type AuthContext = {
  userId: string;
  sessionId?: string;
};

export type RequestMetadata = {
  requestId: string;
  ip?: string;
  userAgent?: string | string[];
};

export const getAuthContext = (request: FastifyRequest): AuthContext => {
  const user = (request as any).user as AuthContext | undefined;
  if (!user?.userId) {
    throw unauthorized('Authenticated user context missing');
  }
  return user;
};

export const getRequestMetadata = (request: FastifyRequest): RequestMetadata => ({
  requestId: String(request.id),
  ip: request.ip,
  userAgent: request.headers['user-agent'],
});
