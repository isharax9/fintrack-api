import { FastifyRequest, FastifyReply } from 'fastify';
import * as authService from './auth.service';
import { 
  registerSchema, loginSchema, refreshSchema, 
  forgotPasswordSchema, verifyOtpSchema, resetPasswordSchema 
} from './auth.schema';

const getSessionMetadata = (request: FastifyRequest) => ({
  userAgent: request.headers['user-agent'],
  ip: request.ip,
});

export const register = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const data = registerSchema.parse(request.body);
    const result = await authService.register(data, getSessionMetadata(request));
    return reply.code(201).send(result);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const login = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const data = loginSchema.parse(request.body);
    const result = await authService.login(data, getSessionMetadata(request));
    return reply.send(result);
  } catch (error: any) {
    return reply.code(401).send({ message: error.message });
  }
};

export const refresh = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const data = refreshSchema.parse(request.body);
    const result = await authService.refresh(data.refreshToken);
    return reply.send(result);
  } catch (error: any) {
    return reply.code(401).send({ message: 'Invalid token' });
  }
};

export const logout = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    const sessionId = (request as any).user.sessionId;
    await authService.logout(userId, sessionId);
    return reply.send({ message: 'Logged out' });
  } catch (error: any) {
    return reply.code(500).send({ message: 'Error logging out' });
  }
};

export const logoutAll = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const userId = (request as any).user.userId;
    await authService.logoutAll(userId);
    return reply.send({ message: 'All sessions logged out' });
  } catch (error: any) {
    return reply.code(500).send({ message: 'Error logging out sessions' });
  }
};

export const forgotPassword = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const data = forgotPasswordSchema.parse(request.body);
    await authService.generateOtp(data.email);
    return reply.send({ message: 'OTP sent' });
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const verifyOtp = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const data = verifyOtpSchema.parse(request.body);
    const result = await authService.verifyOtp(data.email, data.otp);
    return reply.send(result);
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};

export const resetPassword = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const data = resetPasswordSchema.parse(request.body);
    await authService.resetPassword(data);
    return reply.send({ message: 'Password reset successful' });
  } catch (error: any) {
    return reply.code(400).send({ message: error.message });
  }
};
