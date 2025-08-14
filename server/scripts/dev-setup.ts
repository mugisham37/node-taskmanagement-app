#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { existsSync, copyFileSync } from 'fs';
import { logger } from '@/infrastructure/logging/logger';

async function setupDevelopmentEnvironment(): Promise<void> {
  try {
    logger.info('🚀 Setting up development environment...');

    // 1. Check if .env exists, if not copy from .env.example
    if (!existsSync('.env')) {
      logger.info('📄 Creating .env file from .env.example...');
      copyFileSync('.env.example', '.env');
      logger.info(
        '✅ .env file created. Please update with your configuration.'
      );
    }

    // 2. Install dependencies
    logger.info('📦 Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });

    // 3. Setup Husky hooks
    logger.info('🪝 Setting up Git hooks...');
    execSync('npm run prepare', { stdio: 'inherit' });

    // 4. Generate Prisma client
    logger.info('🗄️ Generating Prisma client...');
    execSync('npm run db:generate', { stdio: 'inherit' });

    // 5. Run type check
    logger.info('🔍 Running type check...');
    execSync('npm run type-check', { stdio: 'inherit' });

    // 6. Run linting
    logger.info('🧹 Running linter...');
    execSync('npm run lint', { stdio: 'inherit' });

    // 7. Run tests
    logger.info('🧪 Running tests...');
    execSync('npm run test', { stdio: 'inherit' });

    logger.info('✅ Development environment setup complete!');
    logger.info('');
    logger.info('Next steps:');
    logger.info('1. Update .env file with your configuration');
    logger.info(
      '2. Start PostgreSQL and Redis (docker-compose up -d postgres redis)'
    );
    logger.info('3. Run database migrations (npm run db:migrate)');
    logger.info('4. Start development server (npm run dev)');
  } catch (error) {
    logger.error('❌ Development setup failed:', error);
    process.exit(1);
  }
}

setupDevelopmentEnvironment().catch(error => {
  logger.error('Setup script failed:', error);
  process.exit(1);
});
