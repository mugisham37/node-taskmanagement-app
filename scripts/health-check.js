#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('🏥 Running development environment health check...\n');

const checks = [];

// Check Node.js and npm versions
const checkSystemRequirements = () => {
  console.log('🔍 Checking system requirements...');
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    
    console.log(`✅ Node.js: ${nodeVersion}`);
    console.log(`✅ npm: ${npmVersion}`);
    checks.push({ name: 'System Requirements', status: 'pass' });
  } catch (error) {
    console.error('❌ System requirements check failed');
    checks.push({ name: 'System Requirements', status: 'fail', error: error.message });
  }
};

// Check if all packages are installed
const checkDependencies = () => {
  console.log('\n📦 Checking dependencies...');
  const packages = ['apps/client', 'apps/server', 'packages/shared', 'packages/database', 'packages/ui', 'packages/config'];
  
  let allInstalled = true;
  packages.forEach(pkg => {
    const nodeModulesPath = path.join(pkg, 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      console.log(`✅ ${pkg} dependencies installed`);
    } else {
      console.log(`❌ ${pkg} dependencies missing`);
      allInstalled = false;
    }
  });
  
  checks.push({ name: 'Dependencies', status: allInstalled ? 'pass' : 'fail' });
};

// Check TypeScript compilation
const checkTypeScript = () => {
  console.log('\n🔧 Checking TypeScript compilation...');
  try {
    execSync('npm run type-check', { stdio: 'pipe' });
    console.log('✅ TypeScript compilation successful');
    checks.push({ name: 'TypeScript', status: 'pass' });
  } catch (error) {
    console.log('❌ TypeScript compilation failed');
    checks.push({ name: 'TypeScript', status: 'fail', error: 'Compilation errors found' });
  }
};

// Check if services are running
const checkServices = async () => {
  console.log('\n🌐 Checking running services...');
  
  // Check client (port 3000)
  try {
    await checkPort(3000);
    console.log('✅ Client service running on port 3000');
    checks.push({ name: 'Client Service', status: 'pass' });
  } catch {
    console.log('⚠️  Client service not running on port 3000');
    checks.push({ name: 'Client Service', status: 'warn', message: 'Not running' });
  }
  
  // Check server (port 3001)
  try {
    await checkPort(3001);
    console.log('✅ Server service running on port 3001');
    checks.push({ name: 'Server Service', status: 'pass' });
  } catch {
    console.log('⚠️  Server service not running on port 3001');
    checks.push({ name: 'Server Service', status: 'warn', message: 'Not running' });
  }
  
  // Check database (port 5432)
  try {
    await checkPort(5432);
    console.log('✅ Database service running on port 5432');
    checks.push({ name: 'Database Service', status: 'pass' });
  } catch {
    console.log('⚠️  Database service not running on port 5432');
    checks.push({ name: 'Database Service', status: 'warn', message: 'Not running' });
  }
  
  // Check Redis (port 6379)
  try {
    await checkPort(6379);
    console.log('✅ Redis service running on port 6379');
    checks.push({ name: 'Redis Service', status: 'pass' });
  } catch {
    console.log('⚠️  Redis service not running on port 6379');
    checks.push({ name: 'Redis Service', status: 'warn', message: 'Not running' });
  }
};

// Helper function to check if a port is open
const checkPort = (port) => {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: port,
      method: 'GET',
      timeout: 1000
    }, (res) => {
      resolve(true);
    });
    
    req.on('error', () => reject(false));
    req.on('timeout', () => reject(false));
    req.end();
  });
};

// Check environment files
const checkEnvironment = () => {
  console.log('\n🔐 Checking environment configuration...');
  
  const envFiles = [
    '.env',
    'apps/client/.env.local',
    'apps/server/.env'
  ];
  
  let allPresent = true;
  envFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file} exists`);
    } else {
      console.log(`❌ ${file} missing`);
      allPresent = false;
    }
  });
  
  checks.push({ name: 'Environment Files', status: allPresent ? 'pass' : 'fail' });
};

// Generate summary report
const generateSummary = () => {
  console.log('\n📊 Health Check Summary');
  console.log('========================');
  
  const passed = checks.filter(c => c.status === 'pass').length;
  const failed = checks.filter(c => c.status === 'fail').length;
  const warnings = checks.filter(c => c.status === 'warn').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  
  if (failed > 0) {
    console.log('\n🔧 Issues found:');
    checks.filter(c => c.status === 'fail').forEach(check => {
      console.log(`  ❌ ${check.name}: ${check.error || 'Failed'}`);
    });
    
    console.log('\n💡 Suggested fixes:');
    console.log('  - Run: npm run setup');
    console.log('  - Check environment files');
    console.log('  - Ensure all dependencies are installed');
  }
  
  if (warnings > 0) {
    console.log('\n⚠️  Warnings:');
    checks.filter(c => c.status === 'warn').forEach(check => {
      console.log(`  ⚠️  ${check.name}: ${check.message || 'Warning'}`);
    });
    
    console.log('\n💡 To start services:');
    console.log('  - Database: npm run docker:up');
    console.log('  - Development: npm run dev');
  }
  
  if (failed === 0 && warnings === 0) {
    console.log('\n🎉 All checks passed! Development environment is healthy.');
  }
};

// Main execution
const main = async () => {
  try {
    checkSystemRequirements();
    checkDependencies();
    checkEnvironment();
    checkTypeScript();
    await checkServices();
    generateSummary();
  } catch (error) {
    console.error('\n❌ Health check failed:', error.message);
    process.exit(1);
  }
};

main();