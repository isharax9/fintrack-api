import { buildApp } from './app';
import { env } from './config/env';

export const startServer = async () => {
  const app = buildApp();
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;

    app.log.info({ signal }, 'Shutting down server');
    try {
      await app.close();
      app.log.info('Server shutdown complete');
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'Server shutdown failed');
      process.exit(1);
    }
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    app.log.info({ port: env.PORT, nodeEnv: env.NODE_ENV, cronEnabled: env.ENABLE_CRON }, 'Server listening');
  } catch (error) {
    app.log.error({ err: error }, 'Server startup failed');
    await app.close();
    process.exit(1);
  }
};
