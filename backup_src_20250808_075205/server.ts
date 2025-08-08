import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import config from './infrastructure/config/environment';
import logger from './infrastructure/config/logger';
import { setupWebSocketServer } from './services/websocket.service';
import { initializeJobs, stopJobs } from './jobs';
import { initI18n } from './infrastructure/config/i18n';
import {
  connectToDatabase,
  createDatabaseIfNotExists,
  runMigrations,
} from './config/database';

// Create HTTP server
const server = http.createServer(app);

// Create Socket.IO server
const io = new SocketIOServer(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Initialize WebSocket server
setupWebSocketServer(io);

// Start server
const startServer = async () => {
  try {
    // Create database if it doesn't exist
    await createDatabaseIfNotExists();
    logger.info('Database existence verified');

    // Connect to PostgreSQL
    await connectToDatabase();
    logger.info('Connected to PostgreSQL');

    // Run database migrations
    await runMigrations();
    logger.info('Database migrations completed');

    // Initialize i18n
    await initI18n();
    logger.info('Internationalization initialized');

    // Start HTTP server
    server.listen(config.port, () => {
      logger.info(
        `🚀 Server running on port ${config.port} in ${config.nodeEnv} mode`
      );
      logger.info(`📊 API URL: ${config.apiUrl}`);
      logger.info(`📚 API Documentation: ${config.apiUrl}/api-docs`);
      logger.info(`🔌 Socket.IO server running`);

      // Initialize scheduled jobs if enabled
      if (config.enableJobs) {
        initializeJobs();
        logger.info('✅ Scheduled jobs initialized');
      }
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (error: Error) => {
  logger.error('Unhandled Promise Rejection:', error);
  // In production, you might want to gracefully shutdown
  if (config.nodeEnv === 'production') {
    gracefulShutdown('unhandledRejection');
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown function
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Stop background jobs first
      logger.info('Stopping background jobs...');
      stopJobs();
      logger.info('Background jobs stopped');

      // Close Socket.IO connections
      io.close(() => {
        logger.info('Socket.IO server closed');
      });

      // Close database connections - handled by database.ts process handlers
      logger.info('Database connections will be closed by database module');

      logger.info('✅ Graceful shutdown completed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during graceful shutdown:', error);
      process.exit(1);
    }
  });

  // Force close after 30 seconds
  setTimeout(() => {
    logger.error(
      'Could not close connections in time, forcefully shutting down'
    );
    process.exit(1);
  }, 30000);
};

// Handle SIGTERM signal (Docker, Kubernetes, etc.)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle SIGINT signal (Ctrl+C)
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Export server and io for testing or external use
export { server, io };
export default server;
