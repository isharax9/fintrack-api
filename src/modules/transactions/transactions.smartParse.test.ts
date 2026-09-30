import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    category: {
      findMany: vi.fn(),
    },
    account: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  createAuditLog: vi.fn(),
}));

vi.mock('../../config/db', () => ({ prisma: mocks.prisma }));
vi.mock('../audit/audit.service', () => ({ createAuditLog: mocks.createAuditLog }));

describe('smartParseTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly parses Sri Lankan format "12,500 Food Keells"', async () => {
    const { smartParseTransaction } = await import('./transactions.service');

    mocks.prisma.category.findMany.mockResolvedValue([
      { id: 'cat_food', name: 'Food', color: '#f59e0b', icon: 'utensils' },
    ]);
    mocks.prisma.account.findMany.mockResolvedValue([
      { id: 'acc_bank', name: 'Commercial Bank', type: 'BANK' },
    ]);
    mocks.prisma.user.findUnique.mockResolvedValue({ currency: 'LKR' });

    const result = await smartParseTransaction('user_1', '12,500 Food Keells');

    expect(result.amount).toBe(12500);
    expect(result.categoryId).toBe('cat_food');
    expect(result.type).toBe('EXPENSE');
    expect(result.title.toLowerCase()).toContain('keells');
    expect(result.currency).toBe('LKR');
  });

  it('parses natural phrase "Spent 6500 at Cargills today"', async () => {
    const { smartParseTransaction } = await import('./transactions.service');

    mocks.prisma.category.findMany.mockResolvedValue([
      { id: 'cat_groceries', name: 'Groceries', color: '#10b981', icon: 'shopping-cart' },
    ]);
    mocks.prisma.account.findMany.mockResolvedValue([
      { id: 'acc_cash', name: 'Cash', type: 'CASH' },
    ]);
    mocks.prisma.user.findUnique.mockResolvedValue({ currency: 'LKR' });

    const result = await smartParseTransaction('user_1', 'Spent 6500 at Cargills today');

    expect(result.amount).toBe(6500);
    expect(result.categoryId).toBe('cat_groceries'); // matched via Cargills keyword!
    expect(result.title).toBe('Cargills');
    expect(result.type).toBe('EXPENSE');
  });

  it('parses "400k Laptop" notation with thousands multiplier', async () => {
    const { smartParseTransaction } = await import('./transactions.service');

    mocks.prisma.category.findMany.mockResolvedValue([
      { id: 'cat_shop', name: 'Shopping', color: '#ec4899', icon: 'bag' },
    ]);
    mocks.prisma.account.findMany.mockResolvedValue([]);
    mocks.prisma.user.findUnique.mockResolvedValue({ currency: 'LKR' });

    const result = await smartParseTransaction('user_1', '400k Laptop');

    expect(result.amount).toBe(400000);
    expect(result.title).toBe('Laptop');
    expect(result.categoryId).toBe('cat_shop');
  });

  it('parses "got money from mom 3000 for fuel" as INCOME with person extracted and Allowance category', async () => {
    const { smartParseTransaction } = await import('./transactions.service');

    mocks.prisma.category.findMany.mockResolvedValue([
      { id: 'cat_income', name: 'Income', color: '#10b981', icon: 'wallet' },
      { id: 'cat_allowance', name: 'Allowance', color: '#3b82f6', icon: 'gift' },
      { id: 'cat_fuel', name: 'Fuel', color: '#ef4444', icon: 'fuel' },
    ]);
    mocks.prisma.account.findMany.mockResolvedValue([
      { id: 'acc_cash', name: 'Cash', type: 'CASH' },
    ]);
    mocks.prisma.user.findUnique.mockResolvedValue({ currency: 'LKR' });

    const result = await smartParseTransaction('user_1', 'got money from mom 3000 for fuel');

    expect(result.amount).toBe(3000);
    expect(result.type).toBe('INCOME');
    expect(result.categoryId).toBe('cat_allowance'); // correctly picks Allowance over Fuel!
    expect(result.title.toLowerCase()).toContain('mom');
  });

  it('parses "100 for ice-cream from keels" with typo handling as EXPENSE and Food category', async () => {
    const { smartParseTransaction } = await import('./transactions.service');

    mocks.prisma.category.findMany.mockResolvedValue([
      { id: 'cat_food', name: 'Food', color: '#f59e0b', icon: 'utensils' },
      { id: 'cat_income', name: 'Income', color: '#10b981', icon: 'wallet' },
    ]);
    mocks.prisma.account.findMany.mockResolvedValue([]);
    mocks.prisma.user.findUnique.mockResolvedValue({ currency: 'LKR' });

    const result = await smartParseTransaction('user_1', '100 for ice-cream from keels');

    expect(result.amount).toBe(100);
    expect(result.type).toBe('EXPENSE');
    expect(result.categoryId).toBe('cat_food');
    expect(result.title.toLowerCase()).toContain('keells');
  });
});
