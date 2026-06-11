import { FastifyRequest } from 'fastify';

type EmailBody = {
  email?: unknown;
};

const normalizeEmail = (value: unknown) => {
  if (typeof value !== 'string') return 'anonymous';
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : 'anonymous';
};

const getEmailFromBody = (request: FastifyRequest) => {
  const body = request.body as EmailBody | undefined;
  return normalizeEmail(body?.email);
};

const getIpKey = (request: FastifyRequest) => request.ip || 'unknown';

export const loginRateLimit = {
  max: 10,
  timeWindow: '10 minutes',
  keyGenerator: (request: FastifyRequest) => `login:${getIpKey(request)}:${getEmailFromBody(request)}`,
};

export const forgotPasswordRateLimit = {
  max: 3,
  timeWindow: '15 minutes',
  keyGenerator: (request: FastifyRequest) => `forgot-password:${getIpKey(request)}:${getEmailFromBody(request)}`,
};

export const authRateLimitInternals = {
  normalizeEmail,
};
