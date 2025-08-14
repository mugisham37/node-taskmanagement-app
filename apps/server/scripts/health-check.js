#!/usr/bin/env node

/**
 * Health Check Script for Task Management System
 * This script performs comprehensive health checks on the application
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// Configuration
const config = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000,
  retries: parseInt(process.env.HEALTH_CHECK_RETRIES) || 3,
  retryDelay: parseInt(process.env.HEALTH_CHECK_RETRY_DELAY) || 1000,
};

// Health check endpoints
const endpoints = [
  { path: '/health', name: 'Application Health' },
  { path: '/health/database', name: 'Database Health' },
  { path: '/health/redis', name: 'Redis Health' },
  { path: '/health/ready', name: 'Readiness Check' },
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Logging functions
const log = {
  info: msg => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: msg => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: msg =>
    console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: msg => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
};

/**
 * Make HTTP request with timeout
 */
function makeRequest(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      timeout: timeout,
      headers: {
        'User-Agent': 'HealthCheck/1.0',
      },
    };

    const req = client.request(options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', error => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeout}ms`));
    });

    req.end();
  });
}

/**
 * Check single endpoint with retries
 */
async function checkEndpoint(endpoint, retries = config.retries) {
  const url = `${config.baseUrl}${endpoint.path}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      log.info(`Checking ${endpoint.name} (attempt ${attempt}/${retries})`);

      const response = await makeRequest(url, config.timeout);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        log.success(`${endpoint.name}: OK (${response.statusCode})`);

        // Try to parse JSON response for additional info
        try {
          const data = JSON.parse(response.body);
          if (data.status) {
            log.info(`  Status: ${data.status}`);
          }
          if (data.timestamp) {
            log.info(`  Timestamp: ${data.timestamp}`);
          }
          if (data.uptime) {
            log.info(`  Uptime: ${data.uptime}s`);
          }
        } catch (e) {
          // Ignore JSON parse errors
        }

        return { success: true, statusCode: response.statusCode };
      } else {
        throw new Error(`HTTP ${response.statusCode}`);
      }
    } catch (error) {
      log.warning(`${endpoint.name}: ${error.message}`);

      if (attempt < retries) {
        log.info(`Retrying in ${config.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, config.retryDelay));
      }
    }
  }

  log.error(`${endpoint.name}: FAILED after ${retries} attempts`);
  return { success: false, error: 'Max retries exceeded' };
}

/**
 * Check all endpoints
 */
async function checkAllEndpoints() {
  log.info('Starting health check...');
  log.info(`Base URL: ${config.baseUrl}`);
  log.info(`Timeout: ${config.timeout}ms`);
  log.info(`Retries: ${config.retries}`);
  console.log('');

  const results = [];

  for (const endpoint of endpoints) {
    const result = await checkEndpoint(endpoint);
    results.push({
      endpoint: endpoint.name,
      ...result,
    });
    console.log(''); // Add spacing between checks
  }

  return results;
}

/**
 * Generate summary report
 */
function generateSummary(results) {
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;

  console.log('='.repeat(50));
  log.info('HEALTH CHECK SUMMARY');
  console.log('='.repeat(50));

  results.forEach(result => {
    const status = result.success
      ? `${colors.green}✓ PASS${colors.reset}`
      : `${colors.red}✗ FAIL${colors.reset}`;
    console.log(`${result.endpoint}: ${status}`);
  });

  console.log('');
  console.log(
    `Total: ${total} | Passed: ${colors.green}${successful}${colors.reset} | Failed: ${colors.red}${failed}${colors.reset}`
  );

  if (failed === 0) {
    log.success('All health checks passed!');
    return 0;
  } else {
    log.error(`${failed} health check(s) failed!`);
    return 1;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    const results = await checkAllEndpoints();
    const exitCode = generateSummary(results);
    process.exit(exitCode);
  } catch (error) {
    log.error(`Health check failed: ${error.message}`);
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Task Management System Health Check');
  console.log('');
  console.log('Usage: node health-check.js [options]');
  console.log('');
  console.log('Environment Variables:');
  console.log(
    '  BASE_URL                 Base URL for health checks (default: http://localhost:3000)'
  );
  console.log(
    '  HEALTH_CHECK_TIMEOUT     Request timeout in ms (default: 5000)'
  );
  console.log('  HEALTH_CHECK_RETRIES     Number of retries (default: 3)');
  console.log(
    '  HEALTH_CHECK_RETRY_DELAY Delay between retries in ms (default: 1000)'
  );
  console.log('');
  console.log('Examples:');
  console.log('  node health-check.js');
  console.log('  BASE_URL=https://api.example.com node health-check.js');
  console.log('  HEALTH_CHECK_TIMEOUT=10000 node health-check.js');
  process.exit(0);
}

// Run the health check
main();
