#!/usr/bin/env tsx

import { prisma } from '../prisma-client';
import { logger } from '@/infrastructure/logging/logger';
import { seedUsers } from './users';
import { seedWorkspaces } from './workspaces';
import { seedProjects } from './projects';
import { seedTasks } from './tasks';

async function main(): Promise<void> {
  try {
    logger.info('🌱 Starting database seeding...');

    // Check if database is already seeded
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      logger.info('Database already contains data. Skipping seeding.');
      return;
    }

    // Seed in order of dependencies
    logger.info('👥 Seeding users...');
    const users = await seedUsers();

    logger.info('🏢 Seeding workspaces...');
    const workspaces = await seedWorkspaces(users);

    logger.info('📁 Seeding projects...');
    const projects = await seedProjects(workspaces, users);

    logger.info('✅ Seeding tasks...');
    await seedTasks(projects, users);

    logger.info('🎉 Database seeding completed successfully!');
  } catch (error) {
    logger.error('❌ Database seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
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
