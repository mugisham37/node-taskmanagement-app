#!/usr/bin/env tsx

import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { Command } from 'commander';

const program = new Command();

interface TestOptions {
  category?: string;
  coverage?: boolean;
  watch?: boolean;
  parallel?: boolean;
  verbose?: boolean;
  bail?: boolean;
  environment?: string;
  pattern?: string;
  timeout?: number;
  retries?: number;
  reporter?: string;
  output?: string;
}

// Test categories
const TEST_CATEGORIES = {
  unit: {
    pattern: 'tests/unit/**/*.test.ts',
    timeout: 5000,
    description: 'Unit tests for individual components',
  },
  integration: {
    pattern: 'tests/integration/**/*.test.ts',
    timeout: 15000,
    description: 'Integration tests with external dependencies',
  },
  e2e: {
    pattern: 'tests/e2e/**/*.test.ts',
    timeout: 30000,
    description: 'End-to-end tests through the full application',
  },
  performance: {
    pattern: 'tests/e2e/performance/**/*.test.ts',
    timeout: 60000,
    description: 'Performance and load testing',
  },
  security: {
    pattern: 'tests/e2e/security/**/*.test.ts',
    timeout: 30000,
    description: 'Security and vulnerability testing',
  },
  all: {
    pattern: 'tests/**/*.test.ts',
    timeout: 60000,
    description: 'All tests',
  },
};

// Environment configurations
const ENVIRONMENTS = {
  local: {
    containers: true,
    parallel: false,
    coverage: false,
  },
  ci: {
    containers: true,
    parallel: true,
    coverage: true,
  },
  docker: {
    containers: false,
    parallel: true,
    coverage: true,
  },
};

function ensureDirectories() {
  const dirs = ['test-results', 'coverage', 'logs/tests'];

  dirs.forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });
}

function buildVitestCommand(options: TestOptions): string[] {
  const args = ['vitest'];

  // Test pattern
  if (
    options.category &&
    TEST_CATEGORIES[options.category as keyof typeof TEST_CATEGORIES]
  ) {
    const category =
      TEST_CATEGORIES[options.category as keyof typeof TEST_CATEGORIES];
    args.push(category.pattern);
  } else if (options.pattern) {
    args.push(options.pattern);
  }

  // Run mode
  if (options.watch) {
    // Watch mode is default for vitest
  } else {
    args.push('--run');
  }

  // Coverage
  if (options.coverage) {
    args.push('--coverage');
  }

  // Parallel execution
  if (options.parallel) {
    args.push('--pool=threads');
    args.push('--poolOptions.threads.maxThreads=4');
  } else {
    args.push('--pool=threads');
    args.push('--poolOptions.threads.singleThread=true');
  }

  // Verbose output
  if (options.verbose) {
    args.push('--reporter=verbose');
  }

  // Bail on first failure
  if (options.bail) {
    args.push('--bail=1');
  }

  // Timeout
  if (options.timeout) {
    args.push(`--testTimeout=${options.timeout}`);
  }

  // Retries
  if (options.retries) {
    args.push(`--retry=${options.retries}`);
  }

  // Reporter
  if (options.reporter) {
    args.push(`--reporter=${options.reporter}`);
  }

  // Output file
  if (options.output) {
    args.push(`--outputFile=${options.output}`);
  }

  return args;
}

async function setupTestEnvironment(environment: string) {
  console.log(`🔧 Setting up test environment: ${environment}`);

  const env = ENVIRONMENTS[environment as keyof typeof ENVIRONMENTS];
  if (!env) {
    throw new Error(`Unknown environment: ${environment}`);
  }

  if (env.containers) {
    console.log('🐳 Starting test containers...');
    try {
      execSync('docker-compose -f docker-compose.test.yml up -d --wait', {
        stdio: 'inherit',
      });
      console.log('✅ Test containers started successfully');
    } catch (error) {
      console.error('❌ Failed to start test containers');
      throw error;
    }
  }

  // Wait for services to be ready
  console.log('⏳ Waiting for services to be ready...');
  await new Promise(resolve => setTimeout(resolve, 5000));
}

async function teardownTestEnvironment(environment: string) {
  console.log(`🧹 Tearing down test environment: ${environment}`);

  const env = ENVIRONMENTS[environment as keyof typeof ENVIRONMENTS];
  if (!env) {
    return;
  }

  if (env.containers) {
    console.log('🐳 Stopping test containers...');
    try {
      execSync('docker-compose -f docker-compose.test.yml down -v', {
        stdio: 'inherit',
      });
      console.log('✅ Test containers stopped successfully');
    } catch (error) {
      console.warn('⚠️  Failed to stop test containers:', error);
    }
  }
}

async function runTests(options: TestOptions) {
  const startTime = Date.now();

  try {
    // Ensure required directories exist
    ensureDirectories();

    // Setup environment if specified
    if (options.environment) {
      await setupTestEnvironment(options.environment);
    }

    // Build vitest command
    const vitestArgs = buildVitestCommand(options);

    console.log(`🚀 Running tests with command: npx ${vitestArgs.join(' ')}`);
    console.log(`📂 Test category: ${options.category || 'custom pattern'}`);
    console.log(`🌍 Environment: ${options.environment || 'default'}`);
    console.log('');

    // Run tests
    const testProcess = spawn('npx', vitestArgs, {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        FORCE_COLOR: '1',
      },
    });

    // Handle test completion
    const exitCode = await new Promise<number>(resolve => {
      testProcess.on('close', resolve);
    });

    const duration = Date.now() - startTime;
    const durationSeconds = Math.round(duration / 1000);

    if (exitCode === 0) {
      console.log('');
      console.log(`✅ Tests completed successfully in ${durationSeconds}s`);
    } else {
      console.log('');
      console.log(
        `❌ Tests failed with exit code ${exitCode} after ${durationSeconds}s`
      );
    }

    // Generate test report
    if (options.coverage) {
      console.log('📊 Generating coverage report...');
      // Coverage report is automatically generated by vitest
    }

    return exitCode;
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    return 1;
  } finally {
    // Cleanup environment
    if (options.environment) {
      await teardownTestEnvironment(options.environment);
    }
  }
}

function listTestCategories() {
  console.log('📋 Available test categories:');
  console.log('');

  Object.entries(TEST_CATEGORIES).forEach(([name, config]) => {
    console.log(`  ${name.padEnd(12)} - ${config.description}`);
    console.log(`  ${' '.repeat(12)}   Pattern: ${config.pattern}`);
    console.log(`  ${' '.repeat(12)}   Timeout: ${config.timeout}ms`);
    console.log('');
  });
}

function listEnvironments() {
  console.log('🌍 Available environments:');
  console.log('');

  Object.entries(ENVIRONMENTS).forEach(([name, config]) => {
    console.log(
      `  ${name.padEnd(8)} - Containers: ${config.containers ? 'Yes' : 'No'}, Parallel: ${config.parallel ? 'Yes' : 'No'}, Coverage: ${config.coverage ? 'Yes' : 'No'}`
    );
  });
  console.log('');
}

// CLI Configuration
program
  .name('run-tests')
  .description('Comprehensive test runner for the Unified Enterprise Platform')
  .version('1.0.0');

program
  .command('run')
  .description('Run tests')
  .option(
    '-c, --category <category>',
    'Test category to run (unit, integration, e2e, performance, security, all)'
  )
  .option('--coverage', 'Generate coverage report')
  .option('-w, --watch', 'Run tests in watch mode')
  .option('-p, --parallel', 'Run tests in parallel')
  .option('-v, --verbose', 'Verbose output')
  .option('-b, --bail', 'Bail on first failure')
  .option('-e, --environment <env>', 'Test environment (local, ci, docker)')
  .option('--pattern <pattern>', 'Custom test file pattern')
  .option('--timeout <ms>', 'Test timeout in milliseconds', parseInt)
  .option('--retries <count>', 'Number of retries for failed tests', parseInt)
  .option('--reporter <reporter>', 'Test reporter (verbose, json, html)')
  .option('--output <file>', 'Output file for test results')
  .action(async (options: TestOptions) => {
    const exitCode = await runTests(options);
    process.exit(exitCode);
  });

program
  .command('categories')
  .description('List available test categories')
  .action(() => {
    listTestCategories();
  });

program
  .command('environments')
  .description('List available test environments')
  .action(() => {
    listEnvironments();
  });

program
  .command('setup')
  .description('Setup test environment without running tests')
  .option('-e, --environment <env>', 'Test environment to setup', 'local')
  .action(async options => {
    try {
      await setupTestEnvironment(options.environment);
      console.log('✅ Test environment setup completed');
    } catch (error) {
      console.error('❌ Test environment setup failed:', error);
      process.exit(1);
    }
  });

program
  .command('teardown')
  .description('Teardown test environment')
  .option('-e, --environment <env>', 'Test environment to teardown', 'local')
  .action(async options => {
    try {
      await teardownTestEnvironment(options.environment);
      console.log('✅ Test environment teardown completed');
    } catch (error) {
      console.error('❌ Test environment teardown failed:', error);
      process.exit(1);
    }
  });

program
  .command('ci')
  .description('Run tests in CI mode with full coverage and reporting')
  .action(async () => {
    const exitCode = await runTests({
      category: 'all',
      coverage: true,
      parallel: true,
      environment: 'ci',
      reporter: 'json',
      output: 'test-results/ci-results.json',
      bail: false,
      retries: 2,
    });
    process.exit(exitCode);
  });

program
  .command('quick')
  .description('Run quick unit tests for development')
  .action(async () => {
    const exitCode = await runTests({
      category: 'unit',
      coverage: false,
      parallel: false,
      verbose: true,
    });
    process.exit(exitCode);
  });

program
  .command('integration')
  .description('Run integration tests with containers')
  .action(async () => {
    const exitCode = await runTests({
      category: 'integration',
      coverage: true,
      environment: 'local',
      timeout: 15000,
    });
    process.exit(exitCode);
  });

program
  .command('e2e')
  .description('Run end-to-end tests')
  .action(async () => {
    const exitCode = await runTests({
      category: 'e2e',
      coverage: true,
      environment: 'local',
      timeout: 30000,
      retries: 1,
    });
    process.exit(exitCode);
  });

program
  .command('performance')
  .description('Run performance tests')
  .action(async () => {
    const exitCode = await runTests({
      category: 'performance',
      coverage: false,
      environment: 'local',
      timeout: 60000,
      verbose: true,
    });
    process.exit(exitCode);
  });

program
  .command('security')
  .description('Run security tests')
  .action(async () => {
    const exitCode = await runTests({
      category: 'security',
      coverage: false,
      environment: 'local',
      timeout: 30000,
    });
    process.exit(exitCode);
  });

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

// Parse command line arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
