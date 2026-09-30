import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    refreshSession: {
      updateMany: vi.fn(),
    },
  },
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
  sendOTP: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock('../../config/env', () => ({
  env: {
    ACCESS_TOKEN_SECRET: 'test-access-secret-32-chars-long-enough!',
    REFRESH_TOKEN_SECRET: 'test-refresh-secret-32-chars-long-enough!',
    ACCESS_TOKEN_EXPIRES_IN: '15m',
    REFRESH_TOKEN_EXPIRES_IN: '7d',
  },
}));

vi.mock('../../config/db', () => ({ prisma: mocks.prisma }));
vi.mock('../../config/redis', () => ({ redis: mocks.redis }));
vi.mock('../../utils/email', () => ({ sendOTP: mocks.sendOTP }));
vi.mock('../audit/audit.service', () => ({ createAuditLog: mocks.createAuditLog }));
vi.mock('../../utils/hash', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-new-password'),
}));

describe('auth OTP & reset token flow with Redis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generateOtp stores OTP and resets any previous attempt counter in Redis', async () => {
    const authService = await import('./auth.service');
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      email: 'test@example.com',
    });

    await authService.generateOtp('test@example.com');

    expect(mocks.redis.set).toHaveBeenCalledWith(
      'otp:test@example.com',
      expect.stringMatching(/^\d{6}$/),
      'EX',
      600,
    );
    expect(mocks.redis.del).toHaveBeenCalledWith('otp_attempts:test@example.com');
    expect(mocks.sendOTP).toHaveBeenCalledWith('test@example.com', expect.any(String));
  });

  it('increments failed attempts on invalid OTP', async () => {
    const authService = await import('./auth.service');
    mocks.redis.get.mockImplementation(async (key: string) => {
      if (key === 'otp_attempts:test@example.com') return null;
      if (key === 'otp:test@example.com') return '123456';
      return null;
    });

    await expect(authService.verifyOtp('test@example.com', '000000')).rejects.toThrow(
      'Invalid or expired OTP',
    );

    expect(mocks.redis.set).toHaveBeenCalledWith(
      'otp_attempts:test@example.com',
      '1',
      'EX',
      600,
    );
  });

  it('locks out after 5 failed attempts and deletes the OTP', async () => {
    const authService = await import('./auth.service');
    mocks.redis.get.mockImplementation(async (key: string) => {
      if (key === 'otp_attempts:test@example.com') return '4';
      if (key === 'otp:test@example.com') return '123456';
      return null;
    });

    await expect(authService.verifyOtp('test@example.com', '999999')).rejects.toThrow(
      'Too many failed OTP attempts. Please request a new code.',
    );

    expect(mocks.redis.del).toHaveBeenCalledWith('otp:test@example.com');
  });

  it('successfully verifies OTP, clears attempts, and stores single-use reset token in Redis', async () => {
    const authService = await import('./auth.service');
    mocks.redis.get.mockImplementation(async (key: string) => {
      if (key === 'otp_attempts:test@example.com') return '2';
      if (key === 'otp:test@example.com') return '123456';
      return null;
    });
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      email: 'test@example.com',
    });

    const result = await authService.verifyOtp('test@example.com', '123456');

    expect(result).toHaveProperty('resetToken');
    expect(mocks.redis.del).toHaveBeenCalledWith('otp:test@example.com');
    expect(mocks.redis.del).toHaveBeenCalledWith('otp_attempts:test@example.com');
    expect(mocks.redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^reset_token:/),
      'user_1',
      'EX',
      600,
    );

    // Verify resetPassword consumes the token and prevents replay
    mocks.redis.get.mockImplementation(async (key: string) => {
      if (key.startsWith('reset_token:')) return 'user_1';
      return null;
    });

    await authService.resetPassword({
      resetToken: result.resetToken,
      newPassword: 'new-password-123',
    });

    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { password: 'hashed-new-password' },
    });
    expect(mocks.redis.del).toHaveBeenCalledWith(expect.stringMatching(/^reset_token:/));

    // Second call with same token must fail because redis no longer has the token
    mocks.redis.get.mockResolvedValue(null);
    await expect(
      authService.resetPassword({
        resetToken: result.resetToken,
        newPassword: 'another-new-password',
      }),
    ).rejects.toThrow('Reset token has expired or already been used');
  });
});
