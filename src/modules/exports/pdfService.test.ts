import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  table: vi.fn(),
  text: vi.fn(),
  moveDown: vi.fn(),
  findMany: vi.fn(),
  buildTransactionWhere: vi.fn(),
}));

vi.mock('pdfkit-table', () => ({
  default: vi.fn().mockImplementation(function PDFDocumentMock(this: {
    fontSize: ReturnType<typeof vi.fn>;
    text: ReturnType<typeof vi.fn>;
    moveDown: ReturnType<typeof vi.fn>;
    table: typeof mocks.table;
  }) {
    this.fontSize = vi.fn().mockReturnThis();
    this.text = mocks.text.mockReturnThis();
    this.moveDown = mocks.moveDown.mockReturnThis();
    this.table = mocks.table;
  }),
}));

vi.mock('../../config/db', () => ({
  prisma: {
    transaction: {
      findMany: mocks.findMany,
    },
  },
}));

vi.mock('../transactions/transactions.service', () => ({
  buildTransactionWhere: mocks.buildTransactionWhere,
}));

describe('pdf export service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports transactions using the shared user-scoped filters', async () => {
    const pdfService = await import('./pdfService');
    const where = {
      userId: 'user_1',
      tags: { some: { id: 'c123456789012345678901234', userId: 'user_1' } },
    };
    mocks.buildTransactionWhere.mockResolvedValue(where);
    mocks.findMany.mockResolvedValue([
      {
        date: new Date('2026-06-01T00:00:00.000Z'),
        title: 'Coffee',
        category: { name: 'Food' },
        account: { name: 'Cash' },
        amount: { toString: () => '4.50' },
        type: 'EXPENSE',
      },
    ]);

    await pdfService.generateTransactionsPdf('user_1', {
      search: 'coffee',
      tagId: 'c123456789012345678901234',
      page: 1,
      limit: 10,
    });

    expect(mocks.buildTransactionWhere).toHaveBeenCalledWith('user_1', {
      search: 'coffee',
      tagId: 'c123456789012345678901234',
      page: 1,
      limit: 10,
    });
    expect(mocks.findMany).toHaveBeenCalledWith({
      where,
      include: { account: true, category: true, tags: true },
      orderBy: { date: 'desc' },
    });
    expect(mocks.table).toHaveBeenCalledWith(
      expect.objectContaining({
        datas: [
          expect.objectContaining({
            title: 'Coffee',
            account: 'Cash',
          }),
        ],
      }),
    );
  });
});
