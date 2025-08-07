#!/usr/bin/env tsx

import { logger } from '@/infrastructure/logging/logger';
import { existsSync } from 'fs';

async function checkProjectSetup(): Promise<void> {
  logger.info('🔍 Checking project setup...');

  const checks = [
    {
      name: 'Environment file',
      check: () => existsSync('.env'),
      message: '.env file exists',
      failMessage: '.env file missing - copy from .env.example',
    },
    {
      name: 'Node modules',
      check: () => existsSync('node_modules'),
      message: 'Dependencies installed',
      failMessage: 'Dependencies not installed - run npm install',
    },
    {
      name: 'TypeScript config',
      check: () => existsSync('tsconfig.json'),
      message: 'TypeScript configuration found',
      failMessage: 'TypeScript configuration missing',
    },
    {
      name: 'Prisma schema',
      check: () => existsSync('prisma/schema.prisma'),
      message: 'Prisma schema found',
      failMessage: 'Prisma schema missing - will be created in task 1.2',
    },
    {
      name: 'Git hooks',
      check: () => existsSync('.husky/pre-commit'),
      message: 'Git hooks configured',
      failMessage: 'Git hooks not configured - run npm run prepare',
    },
  ];

  let allPassed = true;

  for (const check of checks) {
    try {
      if (check.check()) {
        logger.info(`✅ ${check.message}`);
      } else {
        logger.warn(`⚠️  ${check.failMessage}`);
        allPassed = false;
      }
    } catch (error) {
      logger.error(`❌ Error checking ${check.name}:`, error);
      allPassed = false;
    }
  }

  if (allPassed) {
    logger.info('🎉 Project setup looks good!');
  } else {
    logger.warn(
      '⚠️  Some setup issues found. Please address them before continuing.'
    );
  }

  // Check environment variables
  logger.info('🔧 Checking environment configuration...');

  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'SESSION_SECRET',
    'CSRF_SECRET',
    'WEBHOOK_SECRET',
  ];

  let envIssues = 0;
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      logger.warn(`⚠️  Missing environment variable: ${envVar}`);
      envIssues++;
    }
  }

  if (envIssues === 0) {
    logger.info('✅ All required environment variables are set');
  } else {
    logger.warn(`⚠️  ${envIssues} environment variables need to be configured`);
  }

  logger.info('');
  logger.info('📋 Next steps:');
  logger.info('1. Ensure all checks pass');
  logger.info('2. Configure environment variables in .env');
  logger.info(
    '3. Start database services: docker-compose up -d postgres redis'
  );
  logger.info('4. Run database migrations: npm run db:migrate');
  logger.info('5. Start development server: npm run dev');
}

checkProjectSetup().catch(error => {
  logger.error('Setup check failed:', error);
  process.exit(1);
});
