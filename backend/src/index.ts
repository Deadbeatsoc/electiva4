import app from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { startCollectorJobs, stopCollectorJobs } from './modules/collector/collector.jobs';

const bootTs = () => new Date().toISOString();
const bootLog = (message: string, meta?: unknown) => {
  if (meta === undefined) {
    console.log(`[${bootTs()}] [backend:${process.pid}] ${message}`);
    return;
  }
  console.log(`[${bootTs()}] [backend:${process.pid}] ${message}`, meta);
};

bootLog('startup begin', {
  nodeEnv: process.env.NODE_ENV,
  portEnv: process.env.PORT,
  configPort: config.port,
  databaseUrlSet: Boolean(process.env.DATABASE_URL),
  trustProxy: config.trustProxy,
});

try {
  const server = app.listen(config.port, () => {
    bootLog(`http server listening on port ${config.port}`);
    logger.info(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
  });

  server.on('error', (error: Error) => {
    console.error(`[${bootTs()}] [backend:${process.pid}] server error`, error);
    logger.error('HTTP server error', error);
  });

  server.on('close', () => {
    bootLog('http server close event emitted');
  });

  bootLog('starting collector jobs');
  startCollectorJobs();
  bootLog('collector jobs started');

  // Graceful shutdown
  const shutdown = (signal: string) => {
    bootLog(`shutdown requested by ${signal}`);
    logger.info(`${signal} received. Shutting down gracefully...`);
    stopCollectorJobs();

    const forceShutdownTimer = setTimeout(() => {
      console.error(
        `[${bootTs()}] [backend:${process.pid}] forced shutdown after timeout`
      );
      process.exit(1);
    }, 10000);
    forceShutdownTimer.unref();

    server.close(() => {
      clearTimeout(forceShutdownTimer);
      bootLog('server closed cleanly');
      logger.info('Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('beforeExit', (code) => {
    bootLog(`beforeExit emitted with code ${code}`);
  });
  process.on('exit', (code) => {
    bootLog(`exit emitted with code ${code}`);
  });
  process.on('warning', (warning) => {
    console.warn(`[${bootTs()}] [backend:${process.pid}] process warning`, warning);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    console.error(
      `[${bootTs()}] [backend:${process.pid}] unhandled rejection`,
      reason
    );
    logger.error('Unhandled Rejection:', reason);
  });

  process.on('uncaughtException', (error: Error) => {
    console.error(
      `[${bootTs()}] [backend:${process.pid}] uncaught exception`,
      error
    );
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
} catch (error) {
  console.error(`[${bootTs()}] [backend:${process.pid}] fatal startup error`, error);
  process.exit(1);
}
