import app from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { startCollectorJobs, stopCollectorJobs } from './modules/collector/collector.jobs';

const server = app.listen(config.port, () => {
  logger.info(
    `Server running in ${config.nodeEnv} mode on port ${config.port}`
  );
});

startCollectorJobs();

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  stopCollectorJobs();
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});
