/**
 * Main application entry point
 * Initializes and starts the task management system with full dependency injection
 */

import 'reflect-metadata'; // Required for dependency injection
import { Application } from './app';

async function main() {
  try {
    console.log('🔧 Initializing Task Management System...');

    const app = new Application();
    await app.initialize();
    await app.start();

    console.log('✅ Task Management System is running');
  } catch (error) {
    console.error('❌ Failed to start Task Management System:', error);
    process.exit(1);
  }
}

main();

