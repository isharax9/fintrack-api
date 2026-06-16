export const bearerAuth = [{ bearerAuth: [] }];

const id = { type: 'string', minLength: 1 };
const dateTime = { type: 'string', format: 'date-time' };
const money = { type: 'number' };
const nullableString = { type: 'string', nullable: true };

export const idParam = {
  type: 'object',
  properties: { id },
  required: ['id'],
};

export const monthYearQuery = {
  type: 'object',
  properties: {
    month: { type: 'integer', minimum: 1, maximum: 12 },
    year: { type: 'integer', minimum: 2000, maximum: 2100 },
  },
  required: ['month', 'year'],
};

export const messageResponse = {
  type: 'object',
  properties: {
    message: { type: 'string' },
  },
  required: ['message'],
};

export const errorResponse = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: {},
      },
      required: ['code', 'message'],
    },
    requestId: { type: 'string' },
  },
  required: ['error', 'requestId'],
};

export const paginationMeta = {
  type: 'object',
  properties: {
    total: { type: 'number' },
    page: { type: 'number' },
    limit: { type: 'number' },
    totalPages: { type: 'number' },
  },
  required: ['total', 'page', 'limit', 'totalPages'],
};

export const paginated = (item: object) => ({
  type: 'object',
  properties: {
    data: { type: 'array', items: item },
    meta: paginationMeta,
  },
  required: ['data', 'meta'],
});

export const paginationQuery = {
  page: { type: 'integer', minimum: 1, default: 1 },
  limit: { type: 'integer', minimum: 1, maximum: 100 },
};

export const userResponse = {
  type: 'object',
  properties: {
    id,
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
    currency: { type: 'string', minLength: 3, maxLength: 3 },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
  required: ['id', 'name', 'email', 'currency', 'createdAt', 'updatedAt'],
};

export const refreshSessionResponse = {
  type: 'object',
  properties: {
    id,
    userAgentHash: nullableString,
    ipHash: nullableString,
    expiresAt: dateTime,
    lastUsedAt: dateTime,
    createdAt: dateTime,
    current: { type: 'boolean' },
  },
  required: ['id', 'expiresAt', 'lastUsedAt', 'createdAt', 'current'],
};

export const accountResponse = {
  type: 'object',
  properties: {
    id,
    userId: id,
    name: { type: 'string' },
    type: { type: 'string', enum: ['BANK', 'CASH', 'CREDIT', 'WALLET'] },
    balance: money,
    createdAt: dateTime,
    updatedAt: dateTime,
  },
  required: ['id', 'userId', 'name', 'type', 'balance', 'createdAt', 'updatedAt'],
};

export const categoryResponse = {
  type: 'object',
  properties: {
    id,
    userId: id,
    name: { type: 'string' },
    color: { type: 'string' },
    icon: { type: 'string' },
    isDefault: { type: 'boolean' },
  },
  required: ['id', 'userId', 'name', 'color', 'icon', 'isDefault'],
};

export const tagResponse = {
  type: 'object',
  properties: {
    id,
    userId: id,
    name: { type: 'string' },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
  required: ['id', 'userId', 'name', 'createdAt', 'updatedAt'],
};

export const transactionResponse = {
  type: 'object',
  properties: {
    id,
    userId: id,
    categoryId: id,
    accountId: { ...id, nullable: true },
    title: { type: 'string' },
    amount: money,
    type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
    date: dateTime,
    notes: nullableString,
    createdAt: dateTime,
    updatedAt: dateTime,
    account: { ...accountResponse, nullable: true },
    category: categoryResponse,
    tags: { type: 'array', items: tagResponse },
  },
  required: ['id', 'userId', 'categoryId', 'title', 'amount', 'type', 'date', 'createdAt', 'updatedAt'],
};

export const transferResponse = {
  type: 'object',
  properties: {
    id,
    userId: id,
    fromAccountId: id,
    toAccountId: id,
    amount: money,
    date: dateTime,
    notes: nullableString,
    createdAt: dateTime,
    updatedAt: dateTime,
    fromAccount: accountResponse,
    toAccount: accountResponse,
  },
  required: ['id', 'userId', 'fromAccountId', 'toAccountId', 'amount', 'date', 'createdAt', 'updatedAt'],
};

export const budgetGoalResponse = {
  type: 'object',
  properties: {
    id,
    userId: id,
    categoryId: id,
    limitAmount: money,
    month: { type: 'integer' },
    year: { type: 'integer' },
    createdAt: dateTime,
    category: categoryResponse,
  },
  required: ['id', 'userId', 'categoryId', 'limitAmount', 'month', 'year', 'createdAt'],
};

export const savingsBucketResponse = {
  type: 'object',
  properties: {
    id,
    userId: id,
    balance: money,
    createdAt: dateTime,
    updatedAt: dateTime,
  },
  required: ['id', 'userId', 'balance', 'createdAt', 'updatedAt'],
};

export const savingsGoalResponse = {
  type: 'object',
  properties: {
    id,
    userId: id,
    name: { type: 'string' },
    targetAmount: { type: 'number', nullable: true },
    currentAmount: money,
    deadline: { type: 'string', format: 'date-time', nullable: true },
    createdAt: dateTime,
    updatedAt: dateTime,
  },
  required: ['id', 'userId', 'name', 'currentAmount', 'createdAt', 'updatedAt'],
};

export const recurringResponse = {
  type: 'object',
  properties: {
    id,
    userId: id,
    accountId: id,
    categoryId: id,
    title: { type: 'string' },
    amount: money,
    type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
    frequency: { type: 'string', enum: ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY'] },
    nextDate: dateTime,
    notes: nullableString,
    isActive: { type: 'boolean' },
    createdAt: dateTime,
    updatedAt: dateTime,
    account: accountResponse,
    category: categoryResponse,
  },
  required: [
    'id',
    'userId',
    'accountId',
    'categoryId',
    'title',
    'amount',
    'type',
    'frequency',
    'nextDate',
    'isActive',
    'createdAt',
    'updatedAt',
  ],
};

export const auditLogResponse = {
  type: 'object',
  properties: {
    id,
    userId: { ...id, nullable: true },
    action: { type: 'string' },
    entityType: { type: 'string' },
    entityId: nullableString,
    requestId: nullableString,
    ipHash: nullableString,
    userAgentHash: nullableString,
    metadata: { nullable: true },
    createdAt: dateTime,
  },
  required: ['id', 'action', 'entityType', 'createdAt'],
};

export const healthResponse = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok'] },
    timestamp: dateTime,
    uptime: { type: 'number' },
    requestId: { type: 'string' },
  },
  required: ['status', 'timestamp', 'uptime', 'requestId'],
};

const readinessCheck = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok', 'error', 'skipped'] },
    latencyMs: { type: 'number' },
    message: { type: 'string' },
  },
  required: ['status'],
};

export const readinessResponse = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ready', 'not_ready'] },
    timestamp: dateTime,
    uptime: { type: 'number' },
    requestId: { type: 'string' },
    checks: {
      type: 'object',
      properties: {
        database: readinessCheck,
        redis: readinessCheck,
      },
      required: ['database', 'redis'],
    },
  },
  required: ['status', 'timestamp', 'uptime', 'requestId', 'checks'],
};

export const createAccountBody = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    type: { type: 'string', enum: ['BANK', 'CASH', 'CREDIT', 'WALLET'] },
    balance: { type: 'number', default: 0 },
  },
  required: ['name', 'type'],
};

export const updateAccountBody = { ...createAccountBody, required: [] };

export const categoryBody = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    color: { type: 'string', minLength: 4 },
    icon: { type: 'string', minLength: 1 },
  },
  required: ['name', 'color', 'icon'],
};

export const updateCategoryBody = { ...categoryBody, required: [] };

export const tagBody = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
  },
  required: ['name'],
};

export const updateTagBody = { ...tagBody, required: [] };

export const createTransactionBody = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1 },
    amount: { type: 'number', exclusiveMinimum: 0 },
    type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
    categoryId: id,
    date: dateTime,
    notes: { type: 'string' },
    accountId: id,
    tagIds: { type: 'array', items: id },
  },
  required: ['title', 'amount', 'type', 'categoryId', 'date'],
};

export const updateTransactionBody = {
  ...createTransactionBody,
  properties: {
    ...createTransactionBody.properties,
    accountId: { ...id, nullable: true },
  },
  required: [],
};

export const transactionQuery = {
  type: 'object',
  properties: {
    search: { type: 'string', minLength: 1, maxLength: 120 },
    type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
    categoryId: id,
    accountId: id,
    tagId: id,
    from: dateTime,
    to: dateTime,
    ...paginationQuery,
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
  },
};

export const transactionExportQuery = {
  type: 'object',
  properties: {
    search: { type: 'string', minLength: 1, maxLength: 120 },
    type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
    categoryId: id,
    accountId: id,
    tagId: id,
    from: dateTime,
    to: dateTime,
  },
};

const importRowResponse = {
  type: 'object',
  properties: {
    rowNumber: { type: 'integer' },
    status: { type: 'string', enum: ['valid', 'error', 'duplicate', 'imported', 'skipped'] },
    errors: { type: 'array', items: { type: 'string' } },
    data: {
      type: 'object',
      nullable: true,
      properties: {
        title: { type: 'string' },
        amount: money,
        type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
        date: dateTime,
        categoryId: id,
        accountId: id,
        notes: { type: 'string' },
        tagIds: { type: 'array', items: id },
      },
    },
  },
  required: ['rowNumber', 'status', 'errors'],
};

export const importTransactionsResponse = {
  type: 'object',
  properties: {
    dryRun: { type: 'boolean' },
    totalRows: { type: 'integer' },
    validRows: { type: 'integer' },
    errorRows: { type: 'integer' },
    duplicateRows: { type: 'integer' },
    importedRows: { type: 'integer' },
    skippedRows: { type: 'integer' },
    rows: { type: 'array', items: importRowResponse },
  },
  required: ['dryRun', 'totalRows', 'validRows', 'errorRows', 'duplicateRows', 'importedRows', 'skippedRows', 'rows'],
};

export const createTransferBody = {
  type: 'object',
  properties: {
    fromAccountId: id,
    toAccountId: id,
    amount: { type: 'number', exclusiveMinimum: 0 },
    date: dateTime,
    notes: { type: 'string' },
  },
  required: ['fromAccountId', 'toAccountId', 'amount'],
};

export const createBudgetGoalBody = {
  type: 'object',
  properties: {
    categoryId: id,
    limitAmount: { type: 'number', exclusiveMinimum: 0 },
    month: { type: 'integer', minimum: 1, maximum: 12 },
    year: { type: 'integer', minimum: 2000, maximum: 2100 },
  },
  required: ['categoryId', 'limitAmount', 'month', 'year'],
};

export const updateBudgetGoalBody = {
  type: 'object',
  properties: {
    limitAmount: { type: 'number', exclusiveMinimum: 0 },
  },
  required: ['limitAmount'],
};

export const createSavingsGoalBody = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    targetAmount: { type: 'number', exclusiveMinimum: 0 },
    deadline: dateTime,
  },
  required: ['name'],
};

export const updateSavingsGoalBody = { ...createSavingsGoalBody, required: [] };

export const allocateFundsBody = {
  type: 'object',
  properties: {
    amount: { type: 'number', exclusiveMinimum: 0 },
  },
  required: ['amount'],
};

export const createRecurringBody = {
  type: 'object',
  properties: {
    accountId: id,
    title: { type: 'string', minLength: 1 },
    amount: { type: 'number', exclusiveMinimum: 0 },
    type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
    categoryId: id,
    frequency: { type: 'string', enum: ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'YEARLY'] },
    nextDate: dateTime,
    notes: { type: 'string' },
    isActive: { type: 'boolean', default: true },
  },
  required: ['accountId', 'title', 'amount', 'type', 'categoryId', 'frequency', 'nextDate'],
};

export const updateRecurringBody = { ...createRecurringBody, required: [] };

export const recurringQuery = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['INCOME', 'EXPENSE'] },
    accountId: id,
    categoryId: id,
    isActive: { type: 'boolean' },
    ...paginationQuery,
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  },
};

export const auditQuery = {
  type: 'object',
  properties: {
    action: { type: 'string' },
    entityType: { type: 'string' },
    ...paginationQuery,
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  },
};

export const updateUserBody = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 2 },
    currency: { type: 'string', minLength: 3, maxLength: 3 },
  },
};

export const reportSummaryResponse = {
  type: 'object',
  properties: {
    totalIncome: money,
    totalExpense: money,
    netSavings: money,
    savingsRate: { type: 'number' },
  },
  required: ['totalIncome', 'totalExpense', 'netSavings', 'savingsRate'],
};

export const categoryReportResponse = {
  type: 'object',
  properties: {
    categoryId: id,
    categoryName: { type: 'string' },
    color: { type: 'string' },
    icon: { type: 'string' },
    amount: money,
  },
  required: ['categoryId', 'categoryName', 'color', 'icon', 'amount'],
};

export const trendResponse = {
  type: 'object',
  properties: {
    month: { type: 'string' },
    income: money,
    expense: money,
  },
  required: ['month', 'income', 'expense'],
};
