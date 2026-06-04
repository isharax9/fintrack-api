import { prisma } from '../../config/db';
import { redis } from '../../config/redis';
import { hashPassword, comparePassword } from '../../utils/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { sendOTP } from '../../utils/email';
import { RegisterInput, LoginInput, ResetPasswordInput } from './auth.schema';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import crypto from 'crypto';

type SessionMetadata = {
  userAgent?: string | string[];
  ip?: string;
};

const defaultCategories = [
  { name: "Food & Dining",   color: "#FF6B6B", icon: "utensils" },
  { name: "Transport",       color: "#4ECDC4", icon: "car" },
  { name: "Housing",         color: "#45B7D1", icon: "home" },
  { name: "Entertainment",   color: "#96CEB4", icon: "film" },
  { name: "Shopping",        color: "#FFEAA7", icon: "shopping-bag" },
  { name: "Health",          color: "#DDA0DD", icon: "heart" },
  { name: "Education",       color: "#98D8C8", icon: "book" },
  { name: "Savings",         color: "#7EC8E3", icon: "piggy-bank" },
  { name: "Income",          color: "#90EE90", icon: "trending-up" },
  { name: "Other",           color: "#D3D3D3", icon: "more-horizontal" }
];

const hashValue = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

const hashOptional = (value?: string | string[]) => {
  if (!value) return undefined;
  return hashValue(Array.isArray(value) ? value.join(',') : value);
};

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
    throw new Error('Email already in use');
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

  return { ...tokens, user: serializeUser(user) };
};

export const login = async (input: LoginInput, metadata: SessionMetadata = {}) => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new Error('Invalid credentials');

  const isValid = await comparePassword(input.password, user.password);
  if (!isValid) throw new Error('Invalid credentials');

  const tokens = await createSessionTokens(user.id, metadata);

  return { ...tokens, user: serializeUser(user) };
};

export const refresh = async (refreshToken: string) => {
  const payload = verifyRefreshToken(refreshToken);
  if (!payload.sessionId) {
    throw new Error('Invalid refresh token');
  }

  const session = await prisma.refreshSession.findFirst({
    where: { id: payload.sessionId, userId: payload.userId },
  });

  if (!session) {
    throw new Error('Invalid refresh token');
  }

  if (session.revokedAt || session.expiresAt <= new Date()) {
    throw new Error('Invalid refresh token');
  }

  if (session.tokenHash !== hashValue(refreshToken)) {
    await prisma.refreshSession.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
        revokeReason: 'TOKEN_REUSE_DETECTED',
      },
    });
    throw new Error('Invalid refresh token');
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

  return { accessToken, refreshToken: nextRefreshToken };
};

export const logout = async (userId: string, sessionId?: string) => {
  if (!sessionId) return logoutAll(userId);

  await prisma.refreshSession.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: {
      revokedAt: new Date(),
      revokeReason: 'LOGOUT',
    },
  });
};

export const logoutAll = async (userId: string) => {
  await prisma.refreshSession.updateMany({
    where: { userId, revokedAt: null },
    data: {
      revokedAt: new Date(),
      revokeReason: 'LOGOUT_ALL',
    },
  });
};

export const generateOtp = async (email: string) => {
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
};

export const verifyOtp = async (email: string, otp: string) => {
  if (!redis) throw new Error("OTP verification requires Redis");
  
  const storedOtp = await redis.get(`otp:${email}`);
  if (storedOtp !== otp) {
    throw new Error('Invalid or expired OTP');
  }

  // OTP verified, issue a short lived reset token
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('User not found');

  const resetToken = jwt.sign({ userId: user.id }, env.ACCESS_TOKEN_SECRET, { expiresIn: '10m' });
  
  await redis.del(`otp:${email}`);
  return { resetToken };
};

export const resetPassword = async (input: ResetPasswordInput) => {
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
};
