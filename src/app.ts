import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { authenticate } from './middleware/authenticate';

// Plugins
import corsPlugin from './plugins/cors';
import helmetPlugin from './plugins/helmet';
import rateLimitPlugin from './plugins/rateLimit';

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

import { initCronJobs } from './modules/cron/scheduler';

declare module 'fastify' {
  export interface FastifyInstance {
    authenticate: typeof authenticate;
  }
}

export function buildApp() {
  const app = Fastify({
    logger: true,
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Register Custom Decorators
  app.decorate('authenticate', authenticate);

  // Register Global Plugins
  app.register(corsPlugin);
  app.register(helmetPlugin);
  app.register(rateLimitPlugin);

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

  // Initialize background tasks
  initCronJobs();

  // Healthcheck
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date() };
  });

  return app;
}

