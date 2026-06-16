import { FastifyReply, FastifyRequest } from 'fastify';
import { getAuthContext, getRequestMetadata } from '../../utils/requestContext';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from './auth.schema';
import * as authService from './auth.service';
import { clearRefreshCookie, REFRESH_COOKIE_NAME, setRefreshCookie } from './auth.cookies';
import { unauthorized } from '../../utils/errors';

export const register = async (request: FastifyRequest, reply: FastifyReply) => {
  const data = registerSchema.parse(request.body);
  const result = await authService.register(data, getRequestMetadata(request));
  setRefreshCookie(reply, result.refreshToken);
  const { refreshToken: _refreshToken, ...body } = result;
  return reply.code(201).send(body);
};

export const login = async (request: FastifyRequest, reply: FastifyReply) => {
  const data = loginSchema.parse(request.body);
  const result = await authService.login(data, getRequestMetadata(request));
  setRefreshCookie(reply, result.refreshToken);
  const { refreshToken: _refreshToken, ...body } = result;
  return reply.send(body);
};

export const refresh = async (request: FastifyRequest, reply: FastifyReply) => {
  const body = request.body as { refreshToken?: string } | undefined;
  const refreshToken = request.cookies?.[REFRESH_COOKIE_NAME] || body?.refreshToken;
  if (!refreshToken) throw unauthorized('Invalid refresh token');

  const result = await authService.refresh(refreshToken, getRequestMetadata(request));
  setRefreshCookie(reply, result.refreshToken);
  return reply.send({ accessToken: result.accessToken });
};

export const logout = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId, sessionId } = getAuthContext(request);
  await authService.logout(userId, sessionId, getRequestMetadata(request));
  clearRefreshCookie(reply);
  return reply.send({ message: 'Logged out' });
};

export const logoutAll = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  await authService.logoutAll(userId, getRequestMetadata(request));
  clearRefreshCookie(reply);
  return reply.send({ message: 'All sessions logged out' });
};

export const logoutOther = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId, sessionId } = getAuthContext(request);
  if (!sessionId) {
    return reply.code(401).send({ error: { message: 'No active session found' } });
  }
  await authService.logoutOther(userId, sessionId, getRequestMetadata(request));
  return reply.send({ message: 'Other sessions logged out' });
};


export const listSessions = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId, sessionId } = getAuthContext(request);
  const sessions = await authService.listSessions(userId, sessionId);
  return reply.send(sessions);
};

export const forgotPassword = async (request: FastifyRequest, reply: FastifyReply) => {
  const data = forgotPasswordSchema.parse(request.body);
  await authService.generateOtp(data.email, getRequestMetadata(request));
  return reply.send({ message: 'OTP sent' });
};

export const verifyOtp = async (request: FastifyRequest, reply: FastifyReply) => {
  const data = verifyOtpSchema.parse(request.body);
  const result = await authService.verifyOtp(data.email, data.otp);
  return reply.send(result);
};

export const resetPassword = async (request: FastifyRequest, reply: FastifyReply) => {
  const data = resetPasswordSchema.parse(request.body);
  await authService.resetPassword(data, getRequestMetadata(request));
  return reply.send({ message: 'Password reset successful' });
};
