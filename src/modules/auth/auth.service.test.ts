import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    category: {
      createMany: vi.fn(),
    },
    refreshSession: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  hashPassword: vi.fn(),
  comparePassword: vi.fn(),
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
  createAuditLog: vi.fn(),
}));

vi.mock('../../config/env', () => ({
  env: {
    ACCESS_TOKEN_SECRET: 'test-access-secret',
    REFRESH_TOKEN_SECRET: 'test-refresh-secret',
    ACCESS_TOKEN_EXPIRES_IN: '15m',
    REFRESH_TOKEN_EXPIRES_IN: '7d',
  },
}));

vi.mock('../../config/db', () => ({ prisma: mocks.prisma }));
vi.mock('../../config/redis', () => ({ redis: null }));
vi.mock('../../utils/hash', () => ({
  hashPassword: mocks.hashPassword,
  comparePassword: mocks.comparePassword,
}));
vi.mock('../../utils/jwt', () => ({
  signAccessToken: mocks.signAccessToken,
  signRefreshToken: mocks.signRefreshToken,
  verifyRefreshToken: mocks.verifyRefreshToken,
}));
vi.mock('../../utils/email', () => ({ sendOTP: vi.fn() }));
vi.mock('../audit/audit.service', () => ({ createAuditLog: mocks.createAuditLog }));

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

describe('auth service sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
  });

  it('creates a refresh session on login and stores only the refresh-token hash', async () => {
    const authService = await import('./auth.service');
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      name: 'Ishara',
      email: 'ishara@example.com',
      password: 'hashed-password',
      currency: 'USD',
    });
    mocks.comparePassword.mockResolvedValue(true);
    mocks.prisma.refreshSession.create.mockResolvedValue({ id: 'session_1' });
    mocks.signAccessToken.mockReturnValue('access-token');
    mocks.signRefreshToken.mockReturnValue('refresh-token');

    const result = await authService.login(
      { email: 'ishara@example.com', password: 'password123' },
      { ip: '127.0.0.1', userAgent: 'vitest', requestId: 'req_1' },
    );

    expect(result).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'user_1', email: 'ishara@example.com' },
    });
    expect(result.user).not.toHaveProperty('password');
    expect(mocks.prisma.refreshSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user_1',
        tokenHash: expect.stringMatching(/^pending:/),
        familyId: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
    expect(mocks.prisma.refreshSession.update).toHaveBeenCalledWith({
      where: { id: 'session_1' },
      data: expect.objectContaining({
        tokenHash: sha256('refresh-token'),
        lastUsedAt: expect.any(Date),
      }),
    });
  });

  it('rotates refresh tokens for a valid session', async () => {
    const authService = await import('./auth.service');
    mocks.verifyRefreshToken.mockReturnValue({ userId: 'user_1', sessionId: 'session_1' });
    mocks.prisma.refreshSession.findFirst.mockResolvedValue({
      id: 'session_1',
      userId: 'user_1',
      tokenHash: sha256('old-refresh-token'),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    mocks.signAccessToken.mockReturnValue('new-access-token');
    mocks.signRefreshToken.mockReturnValue('new-refresh-token');

    const result = await authService.refresh('old-refresh-token', { requestId: 'req_2' });

    expect(result).toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
    expect(mocks.prisma.refreshSession.update).toHaveBeenCalledWith({
      where: { id: 'session_1' },
      data: expect.objectContaining({
        tokenHash: sha256('new-refresh-token'),
        expiresAt: expect.any(Date),
        lastUsedAt: expect.any(Date),
      }),
    });
  });

  it('revokes the session when an old refresh token is reused', async () => {
    const authService = await import('./auth.service');
    mocks.verifyRefreshToken.mockReturnValue({ userId: 'user_1', sessionId: 'session_1' });
    mocks.prisma.refreshSession.findFirst.mockResolvedValue({
      id: 'session_1',
      userId: 'user_1',
      tokenHash: sha256('rotated-refresh-token'),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(authService.refresh('old-refresh-token')).rejects.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
    expect(mocks.prisma.refreshSession.update).toHaveBeenCalledWith({
      where: { id: 'session_1' },
      data: expect.objectContaining({
        revokedAt: expect.any(Date),
        revokeReason: 'TOKEN_REUSE_DETECTED',
      }),
    });
  });

  it('revokes all sessions after password reset', async () => {
    const authService = await import('./auth.service');
    mocks.hashPassword.mockResolvedValue('new-hash');

    const jwt = await import('jsonwebtoken');
    const resetToken = jwt.sign(
      { userId: 'user_1', purpose: 'password_reset', jti: 'test-jti' },
      'test-access-secret',
      { expiresIn: '10m' },
    );

    await authService.resetPassword({ resetToken, newPassword: 'new-password' }, { requestId: 'req_3' });

    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { password: 'new-hash' },
    });
    expect(mocks.prisma.refreshSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user_1', revokedAt: null },
      data: expect.objectContaining({
        revokedAt: expect.any(Date),
        revokeReason: 'PASSWORD_RESET',
      }),
    });
  });

  it('rejects an access token without password_reset purpose for password reset', async () => {
    const authService = await import('./auth.service');
    const jwt = await import('jsonwebtoken');
    const regularAccessToken = jwt.sign({ userId: 'user_1' }, 'test-access-secret', { expiresIn: '15m' });

    await expect(
      authService.resetPassword({ resetToken: regularAccessToken, newPassword: 'new-password' })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
    });
  });

  it('lists only active sessions and marks the current session', async () => {
    const authService = await import('./auth.service');
    const sessions = [
      {
        id: 'session_1',
        userAgentHash: 'ua_hash_1',
        ipHash: 'ip_hash_1',
        expiresAt: new Date(Date.now() + 60_000),
        lastUsedAt: new Date(),
        createdAt: new Date(),
      },
      {
        id: 'session_2',
        userAgentHash: 'ua_hash_2',
        ipHash: 'ip_hash_2',
        expiresAt: new Date(Date.now() + 120_000),
        lastUsedAt: new Date(),
        createdAt: new Date(),
      },
    ];
    mocks.prisma.refreshSession.findMany.mockResolvedValue(sessions);

    const result = await authService.listSessions('user_1', 'session_2');

    expect(mocks.prisma.refreshSession.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
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
    expect(result).toEqual([
      { ...sessions[0], current: false },
      { ...sessions[1], current: true },
    ]);
  });

  describe('loginWithGoogle', () => {
    it('authenticates an existing user successfully', async () => {
      const authService = await import('./auth.service');
      const mockUser = {
        id: 'user_existing',
        name: 'Existing User',
        email: 'user@example.com',
        password: 'hashed-password',
        currency: 'USD',
      };
      mocks.prisma.user.findUnique.mockResolvedValue(mockUser);
      mocks.prisma.refreshSession.create.mockResolvedValue({ id: 'session_g1' });
      mocks.signAccessToken.mockReturnValue('access_g1');
      mocks.signRefreshToken.mockReturnValue('refresh_g1');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          iss: 'https://accounts.google.com',
          sub: 'google_123',
          email: 'user@example.com',
          email_verified: 'true',
          name: 'Existing User',
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      } as any);

      const result = await authService.loginWithGoogle('valid-token', { ip: '127.0.0.1' });

      expect(result.isNewUser).toBe(false);
      expect(result.accessToken).toBe('access_g1');
      expect(result.refreshToken).toBe('refresh_g1');
      expect(result.user.email).toBe('user@example.com');
      expect((result.user as any).password).toBeUndefined();
    });

    it('creates a new user with default categories if user does not exist', async () => {
      const authService = await import('./auth.service');
      const newUser = {
        id: 'user_new',
        name: 'New Google User',
        email: 'newuser@example.com',
        password: 'generated-hash',
        currency: 'USD',
      };
      mocks.prisma.user.findUnique.mockResolvedValue(null);
      mocks.prisma.user.create.mockResolvedValue(newUser);
      mocks.prisma.refreshSession.create.mockResolvedValue({ id: 'session_g2' });
      mocks.signAccessToken.mockReturnValue('access_g2');
      mocks.signRefreshToken.mockReturnValue('refresh_g2');
      mocks.hashPassword.mockResolvedValue('generated-hash');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          iss: 'https://accounts.google.com',
          sub: 'google_456',
          email: 'newuser@example.com',
          email_verified: true,
          name: 'New Google User',
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      } as any);

      const result = await authService.loginWithGoogle('new-user-token');

      expect(result.isNewUser).toBe(true);
      expect(result.user.id).toBe('user_new');
      expect(mocks.prisma.category.createMany).toHaveBeenCalled();
      expect(mocks.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AUTH_GOOGLE_REGISTER',
        }),
      );
    });

    it('throws unauthorized if Google token verification fails', async () => {
      const authService = await import('./auth.service');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error_description: 'Token expired' }),
      } as any);

      await expect(authService.loginWithGoogle('bad-token')).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('throws unauthorized if email is unverified', async () => {
      const authService = await import('./auth.service');

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          iss: 'https://accounts.google.com',
          sub: 'google_789',
          email: 'unverified@example.com',
          email_verified: 'false',
        }),
      } as any);

      await expect(authService.loginWithGoogle('unverified-token')).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });
});
