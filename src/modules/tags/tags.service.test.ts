import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    tag: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  createAuditLog: vi.fn(),
}));

vi.mock('../../config/db', () => ({ prisma: mocks.prisma }));
vi.mock('../audit/audit.service', () => ({ createAuditLog: mocks.createAuditLog }));

describe('tags service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
  });

  it('rejects duplicate tag names before creating a tag', async () => {
    const tagsService = await import('./tags.service');
    mocks.prisma.tag.findFirst.mockResolvedValue({ id: 'tag_1' });

    await expect(
      tagsService.createTag('user_1', { name: 'Subscriptions' }, { requestId: 'req_1' }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Tag already exists',
    });

    expect(mocks.prisma.tag.create).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects renaming a tag to another existing tag name', async () => {
    const tagsService = await import('./tags.service');
    mocks.prisma.tag.findFirst
      .mockResolvedValueOnce({ id: 'tag_1', userId: 'user_1', name: 'Bills' })
      .mockResolvedValueOnce({ id: 'tag_2' });

    await expect(
      tagsService.updateTag('user_1', 'tag_1', { name: 'Subscriptions' }, { requestId: 'req_1' }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Tag already exists',
    });

    expect(mocks.prisma.tag.update).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
});
