import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

const runIntegration = process.env.RUN_DB_INTEGRATION === '1';
const describeIf = runIntegration ? describe : describe.skip;

const prisma = new PrismaClient();

const resetDatabase = async () => {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "_TransactionToTag",
      "AuditLog",
      "RefreshSession",
      "RecurringTransaction",
      "Transfer",
      "Transaction",
      "BudgetGoal",
      "SavingsGoal",
      "SavingsBucket",
      "Tag",
      "Category",
      "Account",
      "User"
    RESTART IDENTITY CASCADE
  `);
};

describeIf('backend database integrations', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    if (runIntegration) {
      await resetDatabase();
    }
    await prisma.$disconnect();
  });

  it('creates a transaction, updates the account balance, and persists an audit log', async () => {
    const transactionsService = await import('../modules/transactions/transactions.service');
    const user = await prisma.user.create({
      data: {
        name: 'Integration User',
        email: 'integration-transactions@fintrack.dev',
        password: 'hashed-password',
      },
    });
    const category = await prisma.category.create({
      data: {
        userId: user.id,
        name: 'Income',
        color: '#00AA88',
        icon: 'wallet',
      },
    });
    const account = await prisma.account.create({
      data: {
        userId: user.id,
        name: 'Main Account',
        type: 'BANK',
        balance: 1000,
      },
    });

    const created = await transactionsService.createTransaction(
      user.id,
      {
        title: 'Salary',
        amount: 250,
        type: 'INCOME',
        categoryId: category.id,
        accountId: account.id,
        date: '2026-06-05T00:00:00.000Z',
      },
      { requestId: 'req_txn_integration' },
    );

    const updatedAccount = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        userId: user.id,
        action: 'TRANSACTION_CREATED',
        entityId: created.id,
      },
    });

    expect(Number(updatedAccount.balance)).toBe(1250);
    expect(auditLog.requestId).toBe('req_txn_integration');
    expect(auditLog.metadata).toMatchObject({
      accountId: account.id,
      categoryId: category.id,
      type: 'INCOME',
      amount: '250',
    });
  });

  it('creates a transfer, updates both account balances, and persists an audit log', async () => {
    const transfersService = await import('../modules/transfers/transfers.service');
    const user = await prisma.user.create({
      data: {
        name: 'Transfer User',
        email: 'integration-transfers@fintrack.dev',
        password: 'hashed-password',
      },
    });
    const fromAccount = await prisma.account.create({
      data: {
        userId: user.id,
        name: 'Checking',
        type: 'BANK',
        balance: 800,
      },
    });
    const toAccount = await prisma.account.create({
      data: {
        userId: user.id,
        name: 'Savings',
        type: 'BANK',
        balance: 200,
      },
    });

    const transfer = await transfersService.createTransfer(
      user.id,
      {
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        amount: 150,
        date: '2026-06-05T00:00:00.000Z',
      },
      { requestId: 'req_transfer_integration' },
    );

    const refreshedFrom = await prisma.account.findUniqueOrThrow({ where: { id: fromAccount.id } });
    const refreshedTo = await prisma.account.findUniqueOrThrow({ where: { id: toAccount.id } });
    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        userId: user.id,
        action: 'TRANSFER_CREATED',
        entityId: transfer.id,
      },
    });

    expect(Number(refreshedFrom.balance)).toBe(650);
    expect(Number(refreshedTo.balance)).toBe(350);
    expect(auditLog.requestId).toBe('req_transfer_integration');
    expect(auditLog.metadata).toMatchObject({
      fromAccountId: fromAccount.id,
      toAccountId: toAccount.id,
      amount: '150',
    });
  });

  it('allocates savings bucket funds, updates the goal, and persists an audit log', async () => {
    const savingsService = await import('../modules/savings/savings.service');
    const user = await prisma.user.create({
      data: {
        name: 'Savings User',
        email: 'integration-savings@fintrack.dev',
        password: 'hashed-password',
      },
    });
    await prisma.savingsBucket.create({
      data: {
        userId: user.id,
        balance: 500,
      },
    });
    const goal = await prisma.savingsGoal.create({
      data: {
        userId: user.id,
        name: 'Emergency Fund',
        currentAmount: 100,
      },
    });

    await savingsService.allocateGoalFunds(
      user.id,
      goal.id,
      { amount: 125 },
      { requestId: 'req_savings_integration' },
    );

    const bucket = await prisma.savingsBucket.findUniqueOrThrow({ where: { userId: user.id } });
    const refreshedGoal = await prisma.savingsGoal.findUniqueOrThrow({ where: { id: goal.id } });
    const auditLog = await prisma.auditLog.findFirstOrThrow({
      where: {
        userId: user.id,
        action: 'SAVINGS_GOAL_ALLOCATED',
        entityId: goal.id,
      },
    });

    expect(Number(bucket.balance)).toBe(375);
    expect(Number(refreshedGoal.currentAmount)).toBe(225);
    expect(auditLog.requestId).toBe('req_savings_integration');
  });

  it('rejects duplicate budget goals at both the service and database constraint layers', async () => {
    const budgetGoalsService = await import('../modules/budgetGoals/budgetGoals.service');
    const user = await prisma.user.create({
      data: {
        name: 'Budget User',
        email: 'integration-budget@fintrack.dev',
        password: 'hashed-password',
      },
    });
    const category = await prisma.category.create({
      data: {
        userId: user.id,
        name: 'Groceries',
        color: '#22AA55',
        icon: 'cart',
      },
    });

    await budgetGoalsService.createBudgetGoal(
      user.id,
      {
        categoryId: category.id,
        limitAmount: 400,
        month: 6,
        year: 2026,
      },
      { requestId: 'req_budget_integration' },
    );

    await expect(
      budgetGoalsService.createBudgetGoal(
        user.id,
        {
          categoryId: category.id,
          limitAmount: 450,
          month: 6,
          year: 2026,
        },
        { requestId: 'req_budget_duplicate' },
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });

    await expect(
      prisma.budgetGoal.create({
        data: {
          userId: user.id,
          categoryId: category.id,
          limitAmount: 500,
          month: 6,
          year: 2026,
        },
      }),
    ).rejects.toMatchObject({
      code: 'P2002',
    });
  });
});
