import { prisma } from '../../config/db';
import { redis } from '../../config/redis';
import { hashPassword, comparePassword } from '../../utils/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { sendOTP } from '../../utils/email';
import { RegisterInput, LoginInput, ResetPasswordInput } from './auth.schema';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export const register = async (input: RegisterInput) => {
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) {
    throw new Error('Email already in use');
  }

  const hashedPassword = await hashPassword(input.password);
  
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      password: hashedPassword,
    }
  });

  // Seed default categories
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

  await prisma.category.createMany({
    data: defaultCategories.map(c => ({
      ...c,
      userId: user.id,
      isDefault: true
    }))
  });

  const accessToken = signAccessToken({ userId: user.id });
  const refreshToken = signRefreshToken({ userId: user.id });

  if (redis) {
    await redis.set(`refresh:${user.id}`, refreshToken, 'EX', 7 * 24 * 60 * 60); // 7 days
  }

  const { password, ...userWithoutPassword } = user;
  return { accessToken, refreshToken, user: userWithoutPassword };
};

export const login = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new Error('Invalid credentials');

  const isValid = await comparePassword(input.password, user.password);
  if (!isValid) throw new Error('Invalid credentials');

  const accessToken = signAccessToken({ userId: user.id });
  const refreshToken = signRefreshToken({ userId: user.id });

  if (redis) {
    await redis.set(`refresh:${user.id}`, refreshToken, 'EX', 7 * 24 * 60 * 60);
  }

  const { password, ...userWithoutPassword } = user;
  return { accessToken, refreshToken, user: userWithoutPassword };
};

export const refresh = async (refreshToken: string) => {
  const payload = verifyRefreshToken(refreshToken);
  
  if (redis) {
    const storedToken = await redis.get(`refresh:${payload.userId}`);
    if (storedToken !== refreshToken) {
      throw new Error('Invalid refresh token');
    }
  }

  const accessToken = signAccessToken({ userId: payload.userId });
  return { accessToken };
};

export const logout = async (userId: string) => {
  if (redis) {
    await redis.del(`refresh:${userId}`);
  }
};

export const generateOtp = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Return silently to prevent email enumeration
    return;
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits

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

  if (redis) {
    await redis.del(`refresh:${payload.userId}`); // Invalidate active sessions
  }
};
