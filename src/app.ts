import Fastify, { FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { authenticate } from './middleware/authenticate';

// Plugins
import corsPlugin from './plugins/cors';
import helmetPlugin from './plugins/helmet';
import rateLimitPlugin from './plugins/rateLimit';
import swaggerPlugin from './plugins/swagger';

// Routes
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import categoriesRoutes from './modules/categories/categories.routes';
import transactionsRoutes from './modules/transactions/transactions.routes';
import budgetGoalsRoutes from './modules/budgetGoals/budgetGoals.routes';
import reportsRoutes from './modules/reports/reports.routes';

import accountsRoutes from './modules/accounts/accounts.routes';
import transfersRoutes from './modules/transfers/transfers.routes';
import tagsRoutes from './modules/tags/tags.routes';
import savingsRoutes from './modules/savings/savings.routes';
import exportsRoutes from './modules/exports/exports.routes';
import recurringRoutes from './modules/recurring/recurring.routes';
import auditRoutes from './modules/audit/audit.routes';
import { errorHandler, notFound } from './utils/errors';
import { healthResponse, readinessResponse } from './utils/openapi';
import { prisma } from './config/db';
import { redis } from './config/redis';

import { initCronJobs } from './modules/cron/scheduler';

declare module 'fastify' {
  export interface FastifyInstance {
    authenticate: typeof authenticate;
  }
}

async function healthRoutes(fastify: FastifyInstance) {
  // Liveness: process is up and able to serve requests.
  fastify.get('/health', {
    schema: {
      tags: ['Health'],
      summary: 'Liveness check',
      response: {
        200: healthResponse,
      },
    },
  }, async (request) => {
    return {
      status: 'ok',
      timestamp: new Date(),
      uptime: process.uptime(),
      requestId: String(request.id),
    };
  });

  // Readiness: dependencies are reachable enough to receive production traffic.
  fastify.get('/ready', {
    schema: {
      tags: ['Health'],
      summary: 'Readiness check',
      response: {
        200: readinessResponse,
        503: readinessResponse,
      },
    },
  }, async (request, reply) => {
    const check = async (probe: () => Promise<unknown>) => {
      const startedAt = Date.now();
      try {
        await probe();
        return { status: 'ok', latencyMs: Date.now() - startedAt };
      } catch (error) {
        request.log.warn({ err: error }, 'Readiness probe failed');
        return {
          status: 'error',
          latencyMs: Date.now() - startedAt,
          message: error instanceof Error ? error.message : 'Dependency check failed',
        };
      }
    };

    const redisClient = redis;
    const [database, redisCheck] = await Promise.all([
      check(() => prisma.$queryRaw`SELECT 1`),
      redisClient ? check(() => redisClient.ping()) : Promise.resolve({ status: 'skipped', message: 'Redis is not configured' }),
    ]);

    const ready = database.status === 'ok' && redisCheck.status !== 'error';
    const body = {
      status: ready ? 'ready' : 'not_ready',
      timestamp: new Date(),
      uptime: process.uptime(),
      requestId: String(request.id),
      checks: {
        database,
        redis: redisCheck,
      },
    };

    return reply.code(ready ? 200 : 503).send(body);
  });
}

export function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie', 'password', '*.password', 'refreshToken', '*.refreshToken'],
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  }).withTypeProvider<TypeBoxTypeProvider>();

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((request) => {
    throw notFound(`Route ${request.method} ${request.url} not found`);
  });

  // Register Custom Decorators
  app.decorate('authenticate', authenticate);

  // Register Global Plugins
  app.register(corsPlugin);
  app.register(helmetPlugin);
  app.register(rateLimitPlugin);
  app.register(swaggerPlugin);
  app.register(healthRoutes);

  // Register API Routes
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(userRoutes, { prefix: '/api/user' });
  app.register(categoriesRoutes, { prefix: '/api/categories' });
  app.register(transactionsRoutes, { prefix: '/api/transactions' });
  app.register(budgetGoalsRoutes, { prefix: '/api/budget-goals' });
  app.register(reportsRoutes, { prefix: '/api/reports' });
  
  app.register(accountsRoutes, { prefix: '/api/accounts' });
  app.register(transfersRoutes, { prefix: '/api/transfers' });
  app.register(tagsRoutes, { prefix: '/api/tags' });
  app.register(savingsRoutes, { prefix: '/api/savings' });
  app.register(exportsRoutes, { prefix: '/api/exports' });
  app.register(recurringRoutes, { prefix: '/api/recurring' });
  app.register(auditRoutes, { prefix: '/api/audit' });

  // Initialize background tasks
  initCronJobs();

  return app;
}
