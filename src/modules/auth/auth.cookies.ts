import { FastifyReply } from 'fastify';
import { env } from '../../config/env';

export const REFRESH_COOKIE_NAME = 'fintrack_refresh';

const durationToSeconds = (value: string) => {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return 7 * 24 * 60 * 60;

  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === 's') return amount;
  if (unit === 'm') return amount * 60;
  if (unit === 'h') return amount * 60 * 60;
  return amount * 24 * 60 * 60;
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export const setRefreshCookie = (reply: FastifyReply, refreshToken: string) => {
  reply.setCookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...refreshCookieOptions,
    maxAge: durationToSeconds(env.REFRESH_TOKEN_EXPIRES_IN),
  });
};

export const clearRefreshCookie = (reply: FastifyReply) => {
  reply.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions);
};
