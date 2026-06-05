import { FastifyReply, FastifyRequest } from 'fastify';
import { getAuthContext, getRequestMetadata } from '../../utils/requestContext';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from './auth.schema';
import * as authService from './auth.service';

export const register = async (request: FastifyRequest, reply: FastifyReply) => {
  const data = registerSchema.parse(request.body);
  const result = await authService.register(data, getRequestMetadata(request));
  return reply.code(201).send(result);
};

export const login = async (request: FastifyRequest, reply: FastifyReply) => {
  const data = loginSchema.parse(request.body);
  const result = await authService.login(data, getRequestMetadata(request));
  return reply.send(result);
};

export const refresh = async (request: FastifyRequest, reply: FastifyReply) => {
  const data = refreshSchema.parse(request.body);
  const result = await authService.refresh(data.refreshToken, getRequestMetadata(request));
  return reply.send(result);
};

export const logout = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId, sessionId } = getAuthContext(request);
  await authService.logout(userId, sessionId, getRequestMetadata(request));
  return reply.send({ message: 'Logged out' });
};

export const logoutAll = async (request: FastifyRequest, reply: FastifyReply) => {
  const { userId } = getAuthContext(request);
  await authService.logoutAll(userId, getRequestMetadata(request));
  return reply.send({ message: 'All sessions logged out' });
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
