/**
 * Main application entry point
 * Bootstraps the application and starts the server
 */

import { startServer } from './server';

async function main() {
  try {
    await startServer();
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

main();
