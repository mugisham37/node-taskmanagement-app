#!/usr/bin/env tsx

import { logger } from '@/infrastructure/logging/logger';

// Note: Domain-specific seed files have been moved to their respective domains
// Infrastructure layer now only contains base seeding functionality
// Domain seeds can be imported and executed from their domain directories:
//
// Authentication: src/domains/authentication/seeds/
// Task Management: src/domains/task-management/seeds/
// Other domains: src/domains/[domain]/seeds/

async function main(): Promise<void> {
  try {
    logger.info('🌱 Starting database seeding...');

    // Infrastructure-level seeding is now minimal
    // Domain-specific seeding should be handled by each domain
    logger.info(
      'ℹ️  Domain-specific seeding should be executed from individual domains'
    );
    logger.info('🎉 Infrastructure seeding completed successfully!');
  } catch (error) {
    logger.error('❌ Database seeding failed:', error);
    throw error;
  }
}

// Handle script execution
if (require.main === module) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      logger.error('Seeding script failed:', error);
      process.exit(1);
    });
}

export { main as seedDatabase };
