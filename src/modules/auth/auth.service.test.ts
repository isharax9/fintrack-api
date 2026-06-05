import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
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
    const resetToken = jwt.sign({ userId: 'user_1' }, 'test-access-secret', { expiresIn: '10m' });

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
});
