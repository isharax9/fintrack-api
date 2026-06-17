import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    category: {
      create: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    transaction: { count: vi.fn() },
    budgetGoal: { count: vi.fn() },
    recurringTransaction: { count: vi.fn() },
    recurringExecution: { count: vi.fn() },
    $transaction: vi.fn(),
  },
  createAuditLog: vi.fn(),
}));

vi.mock('../../config/db', () => ({ prisma: mocks.prisma }));
vi.mock('../audit/audit.service', () => ({ createAuditLog: mocks.createAuditLog }));

describe('categories service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
  });

  it('updates default categories like regular user categories', async () => {
    const categoriesService = await import('./categories.service');
    mocks.prisma.category.findUnique.mockResolvedValue({
      id: 'cat_1',
      userId: 'user_1',
      name: 'Transport',
      color: '#111111',
      icon: 'car',
      isDefault: true,
    });
    mocks.prisma.category.update.mockResolvedValue({
      id: 'cat_1',
      userId: 'user_1',
      name: 'Transit',
      color: '#222222',
      icon: 'train',
      isDefault: true,
    });

    const result = await categoriesService.updateCategory(
      'user_1',
      'cat_1',
      { name: 'Transit', color: '#222222', icon: 'train' },
      { requestId: 'req_1' },
    );

    expect(result).toMatchObject({ name: 'Transit', isDefault: true });
    expect(mocks.prisma.category.update).toHaveBeenCalledWith({
      where: { id: 'cat_1' },
      data: { name: 'Transit', color: '#222222', icon: 'train' },
    });
  });

  it('deletes an unused default category', async () => {
    const categoriesService = await import('./categories.service');
    mocks.prisma.category.findUnique.mockResolvedValue({
      id: 'cat_1',
      userId: 'user_1',
      name: 'Travel',
      color: '#111111',
      icon: 'plane',
      isDefault: true,
    });
    mocks.prisma.transaction.count.mockResolvedValue(0);
    mocks.prisma.budgetGoal.count.mockResolvedValue(0);
    mocks.prisma.recurringTransaction.count.mockResolvedValue(0);
    mocks.prisma.recurringExecution.count.mockResolvedValue(0);

    await categoriesService.deleteCategory('user_1', 'cat_1', { requestId: 'req_2' });

    expect(mocks.prisma.category.delete).toHaveBeenCalledWith({ where: { id: 'cat_1' } });
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CATEGORY_DELETED',
        entityType: 'Category',
        entityId: 'cat_1',
      }),
      mocks.prisma,
    );
  });

  it('blocks deleting a category used by linked records', async () => {
    const categoriesService = await import('./categories.service');
    mocks.prisma.category.findUnique.mockResolvedValue({
      id: 'cat_1',
      userId: 'user_1',
      name: 'Transport',
      color: '#111111',
      icon: 'car',
      isDefault: false,
    });
    mocks.prisma.transaction.count.mockResolvedValue(1);
    mocks.prisma.budgetGoal.count.mockResolvedValue(1);
    mocks.prisma.recurringTransaction.count.mockResolvedValue(0);
    mocks.prisma.recurringExecution.count.mockResolvedValue(0);

    await expect(
      categoriesService.deleteCategory('user_1', 'cat_1', { requestId: 'req_3' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Category is used by transactions, budget goals and cannot be deleted',
    });
    expect(mocks.prisma.category.delete).not.toHaveBeenCalled();
  });
});
