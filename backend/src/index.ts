import app from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { startCollectorJobs, stopCollectorJobs } from './modules/collector/collector.jobs';

console.log('=== BACKEND STARTUP ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('Config port:', config.port);

try {
  const server = app.listen(config.port, () => {
    console.log(`✓ Server running on port ${config.port}`);
    logger.info(
      `Server running in ${config.nodeEnv} mode on port ${config.port}`
    );
  });

  console.log('Starting collector jobs...');
  startCollectorJobs();
  console.log('✓ Collector jobs started');

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
    console.error('Unhandled Rejection:', reason);
    logger.error('Unhandled Rejection:', reason);
  });

  process.on('uncaughtException', (error: Error) => {
    console.error('Uncaught Exception:', error);
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
} catch (error) {
  console.error('FATAL ERROR during startup:', error);
  process.exit(1);
}