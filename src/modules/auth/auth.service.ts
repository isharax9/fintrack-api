import { prisma } from '../../config/db';
import { redis } from '../../config/redis';
import { hashPassword, comparePassword } from '../../utils/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { sendOTP } from '../../utils/email';
import { RegisterInput, LoginInput, ResetPasswordInput } from './auth.schema';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import crypto from 'crypto';
import { createAuditLog } from '../audit/audit.service';
import { hashOptional } from '../../utils/security';
import { badRequest, conflict, unauthorized } from '../../utils/errors';
import { defaultCategories } from '../categories/defaultCategories';

type SessionMetadata = {
  userAgent?: string | string[];
  ip?: string;
  requestId?: string;
};

const hashValue = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

const durationToMs = (value: string) => {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;

  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === 's') return amount * 1000;
  if (unit === 'm') return amount * 60 * 1000;
  if (unit === 'h') return amount * 60 * 60 * 1000;
  return amount * 24 * 60 * 60 * 1000;
};

const getRefreshExpiry = () =>
  new Date(Date.now() + durationToMs(env.REFRESH_TOKEN_EXPIRES_IN));

const createSessionTokens = async (userId: string, metadata: SessionMetadata = {}) => {
  const expiresAt = getRefreshExpiry();
  const session = await prisma.refreshSession.create({
    data: {
      userId,
      tokenHash: `pending:${crypto.randomUUID()}`,
      familyId: crypto.randomUUID(),
      userAgentHash: hashOptional(metadata.userAgent),
      ipHash: hashOptional(metadata.ip),
      expiresAt,
    },
  });

  const accessToken = signAccessToken({ userId, sessionId: session.id });
  const refreshToken = signRefreshToken({ userId, sessionId: session.id });

  await prisma.refreshSession.update({
    where: { id: session.id },
    data: {
      tokenHash: hashValue(refreshToken),
      expiresAt,
      lastUsedAt: new Date(),
    },
  });

  return { accessToken, refreshToken };
};

const serializeUser = <T extends { password: string }>(user: T) => {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

export const register = async (input: RegisterInput, metadata: SessionMetadata = {}) => {
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) {
    throw conflict('Email already in use');
  }

  const hashedPassword = await hashPassword(input.password);
  
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: hashedPassword,
      }
    });

    await tx.category.createMany({
      data: defaultCategories.map(c => ({
        ...c,
        userId: created.id,
        isDefault: true
      }))
    });

    return created;
  });

  const tokens = await createSessionTokens(user.id, metadata);
  await createAuditLog({
    userId: user.id,
    action: 'AUTH_REGISTER',
    entityType: 'User',
    entityId: user.id,
    ip: metadata.ip,
    userAgent: metadata.userAgent,
    requestId: metadata.requestId,
  });

  return { ...tokens, user: serializeUser(user) };
};

export const login = async (input: LoginInput, metadata: SessionMetadata = {}) => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw unauthorized('Invalid credentials');

  const isValid = await comparePassword(input.password, user.password);
  if (!isValid) throw unauthorized('Invalid credentials');

  const tokens = await createSessionTokens(user.id, metadata);
  await createAuditLog({
    userId: user.id,
    action: 'AUTH_LOGIN',
    entityType: 'RefreshSession',
    ip: metadata.ip,
    userAgent: metadata.userAgent,
    requestId: metadata.requestId,
  });

  return { ...tokens, user: serializeUser(user) };
};

export const refresh = async (refreshToken: string, metadata: SessionMetadata = {}) => {
  const payload = verifyRefreshToken(refreshToken);
  if (!payload.sessionId) {
    throw unauthorized('Invalid refresh token');
  }

  const session = await prisma.refreshSession.findFirst({
    where: { id: payload.sessionId, userId: payload.userId },
  });

  if (!session) {
    throw unauthorized('Invalid refresh token');
  }

  if (session.revokedAt || session.expiresAt <= new Date()) {
    throw unauthorized('Invalid refresh token');
  }

  if (session.tokenHash !== hashValue(refreshToken)) {
    await prisma.refreshSession.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
        revokeReason: 'TOKEN_REUSE_DETECTED',
      },
    });
    throw unauthorized('Invalid refresh token');
  }

  const accessToken = signAccessToken({ userId: payload.userId, sessionId: session.id });
  const nextRefreshToken = signRefreshToken({ userId: payload.userId, sessionId: session.id });

  await prisma.refreshSession.update({
    where: { id: session.id },
    data: {
      tokenHash: hashValue(nextRefreshToken),
      expiresAt: getRefreshExpiry(),
      lastUsedAt: new Date(),
    },
  });
  await createAuditLog({
    userId: payload.userId,
    action: 'AUTH_REFRESH',
    entityType: 'RefreshSession',
    entityId: session.id,
    ip: metadata.ip,
    userAgent: metadata.userAgent,
    requestId: metadata.requestId,
  });

  return { accessToken, refreshToken: nextRefreshToken };
};

export const logout = async (userId: string, sessionId?: string, metadata: SessionMetadata = {}) => {
  if (!sessionId) return logoutAll(userId);

  await prisma.refreshSession.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: {
      revokedAt: new Date(),
      revokeReason: 'LOGOUT',
    },
  });
  await createAuditLog({
    userId,
    action: 'AUTH_LOGOUT',
    entityType: 'RefreshSession',
    entityId: sessionId,
    ip: metadata.ip,
    userAgent: metadata.userAgent,
    requestId: metadata.requestId,
  });
};

export const logoutAll = async (userId: string, metadata: SessionMetadata = {}) => {
  await prisma.refreshSession.updateMany({
    where: { userId, revokedAt: null },
    data: {
      revokedAt: new Date(),
      revokeReason: 'LOGOUT_ALL',
    },
  });
  await createAuditLog({
    userId,
    action: 'AUTH_LOGOUT_ALL',
    entityType: 'RefreshSession',
    ip: metadata.ip,
    userAgent: metadata.userAgent,
    requestId: metadata.requestId,
  });
};

export const logoutOther = async (userId: string, currentSessionId: string, metadata: SessionMetadata = {}) => {
  await prisma.refreshSession.updateMany({
    where: {
      userId,
      id: { not: currentSessionId },
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      revokeReason: 'LOGOUT_OTHER',
    },
  });
  await createAuditLog({
    userId,
    action: 'AUTH_LOGOUT_OTHER',
    entityType: 'RefreshSession',
    ip: metadata.ip,
    userAgent: metadata.userAgent,
    requestId: metadata.requestId,
  });
};


export const listSessions = async (userId: string, currentSessionId?: string) => {
  const sessions = await prisma.refreshSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastUsedAt: 'desc' },
    select: {
      id: true,
      userAgentHash: true,
      ipHash: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  return sessions.map((session) => ({
    ...session,
    current: session.id === currentSessionId,
  }));
};

export const generateOtp = async (email: string, metadata: SessionMetadata = {}) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Return silently to prevent email enumeration
    return;
  }

  const otp = crypto.randomInt(100000, 1000000).toString();

  if (redis) {
    await redis.set(`otp:${email}`, otp, 'EX', 10 * 60); // 10 minutes
  }

  await sendOTP(email, otp);
  await createAuditLog({
    userId: user.id,
    action: 'PASSWORD_RESET_REQUESTED',
    entityType: 'User',
    entityId: user.id,
    ip: metadata.ip,
    userAgent: metadata.userAgent,
    requestId: metadata.requestId,
  });
};

export const verifyOtp = async (email: string, otp: string) => {
  if (!redis) throw badRequest('OTP verification requires Redis');
  
  const storedOtp = await redis.get(`otp:${email}`);
  if (storedOtp !== otp) {
    throw badRequest('Invalid or expired OTP');
  }

  // OTP verified, issue a short lived reset token
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw badRequest('User not found');

  const resetToken = jwt.sign({ userId: user.id }, env.ACCESS_TOKEN_SECRET, { expiresIn: '10m' });
  
  await redis.del(`otp:${email}`);
  return { resetToken };
};

export const resetPassword = async (input: ResetPasswordInput, metadata: SessionMetadata = {}) => {
  const payload = jwt.verify(input.resetToken, env.ACCESS_TOKEN_SECRET) as { userId: string };
  const hashedPassword = await hashPassword(input.newPassword);

  await prisma.user.update({
    where: { id: payload.userId },
    data: { password: hashedPassword },
  });

  await prisma.refreshSession.updateMany({
    where: { userId: payload.userId, revokedAt: null },
    data: {
      revokedAt: new Date(),
      revokeReason: 'PASSWORD_RESET',
    },
  });
  await createAuditLog({
    userId: payload.userId,
    action: 'PASSWORD_RESET_COMPLETED',
    entityType: 'User',
    entityId: payload.userId,
    ip: metadata.ip,
    userAgent: metadata.userAgent,
    requestId: metadata.requestId,
  });
};
