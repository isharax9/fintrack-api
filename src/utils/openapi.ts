export const bearerAuth = [{ bearerAuth: [] }];

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
