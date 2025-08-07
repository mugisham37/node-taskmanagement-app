#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ComprehensiveDatabaseSeeder } from '../prisma/seeds/comprehensive-seed';

const prisma = new PrismaClient();

async function setupDatabase() {
  console.log('🚀 Starting comprehensive database setup...');

  try {
    // Step 1: Run Prisma migrations
    console.log('📦 Running Prisma migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });

    // Step 2: Apply custom indexes and constraints
    console.log('🔧 Applying custom indexes and constraints...');
    const indexesSql = readFileSync(
      join(__dirname, '../prisma/migrations/add_comprehensive_indexes.sql'),
      'utf-8'
    );

    // Split by semicolon and execute each statement
    const statements = indexesSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      try {
        await prisma.$executeRawUnsafe(statement + ';');
        console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
      } catch (error) {
        console.warn(`⚠️ Warning executing statement: ${error.message}`);
      }
    }

    // Step 3: Generate Prisma client
    console.log('🔄 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    // Step 4: Run comprehensive seeding
    console.log('🌱 Running comprehensive database seeding...');
    const seeder = new ComprehensiveDatabaseSeeder();
    await seeder.seed();

    // Step 5: Verify setup
    console.log('🔍 Verifying database setup...');
    await verifySetup();

    console.log('🎉 Database setup completed successfully!');
    console.log('\n📊 Database Statistics:');
    await printDatabaseStats();
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function verifySetup(): Promise<void> {
  const checks = [
    { name: 'Users', query: () => prisma.user.count() },
    { name: 'Workspaces', query: () => prisma.workspace.count() },
    { name: 'Projects', query: () => prisma.project.count() },
    { name: 'Tasks', query: () => prisma.task.count() },
    { name: 'Teams', query: () => prisma.team.count() },
    { name: 'Comments', query: () => prisma.comment.count() },
    { name: 'Time Entries', query: () => prisma.timeEntry.count() },
  ];

  for (const check of checks) {
    try {
      const count = await check.query();
      console.log(`✅ ${check.name}: ${count} records`);
    } catch (error) {
      console.error(`❌ ${check.name}: Verification failed - ${error.message}`);
      throw error;
    }
  }
}

async function printDatabaseStats(): Promise<void> {
  try {
    const stats = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples
      FROM pg_stat_user_tables 
      WHERE schemaname = 'public'
      ORDER BY n_live_tup DESC
      LIMIT 10;
    `;

    console.table(stats);

    // Index usage statistics
    const indexStats = await prisma.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_scan as scans,
        idx_tup_read as tuples_read,
        idx_tup_fetch as tuples_fetched
      FROM pg_stat_user_indexes 
      WHERE schemaname = 'public' AND idx_scan > 0
      ORDER BY idx_scan DESC
      LIMIT 10;
    `;

    console.log('\n🔍 Top Index Usage:');
    console.table(indexStats);
  } catch (error) {
    console.warn('⚠️ Could not retrieve database statistics:', error.message);
  }
}

// Performance monitoring function
async function checkDatabasePerformance(): Promise<void> {
  console.log('⚡ Running performance checks...');

  const performanceChecks = [
    {
      name: 'Task Query Performance',
      query: async () => {
        const start = Date.now();
        await prisma.task.findMany({
          where: {
            status: 'TODO',
            assigneeId: { not: null },
          },
          include: {
            assignee: true,
            project: true,
          },
          take: 100,
        });
        return Date.now() - start;
      },
    },
    {
      name: 'Workspace Members Query',
      query: async () => {
        const start = Date.now();
        await prisma.workspaceMember.findMany({
          where: { status: 'ACTIVE' },
          include: {
            user: true,
            workspace: true,
            role: true,
          },
          take: 100,
        });
        return Date.now() - start;
      },
    },
    {
      name: 'Project Tasks Aggregation',
      query: async () => {
        const start = Date.now();
        await prisma.task.groupBy({
          by: ['projectId', 'status'],
          _count: { id: true },
          where: {
            projectId: { not: null },
          },
        });
        return Date.now() - start;
      },
    },
  ];

  for (const check of performanceChecks) {
    try {
      const duration = await check.query();
      const status = duration < 100 ? '🟢' : duration < 500 ? '🟡' : '🔴';
      console.log(`${status} ${check.name}: ${duration}ms`);
    } catch (error) {
      console.error(`❌ ${check.name}: ${error.message}`);
    }
  }
}

// Main execution
if (require.main === module) {
  setupDatabase()
    .then(() => checkDatabasePerformance())
    .catch(console.error);
}

export {
  setupDatabase,
  verifySetup,
  printDatabaseStats,
  checkDatabasePerformance,
};
