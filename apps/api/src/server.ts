/**
 * Server entry point
 * Starts the application with dependency injection and full integration
 */

import { Application } from './app';

async function start() {
  try {
    const app = new Application();
    await app.initialize();
    await app.start();

    console.log('🚀 Task Management System started successfully');
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

start();
