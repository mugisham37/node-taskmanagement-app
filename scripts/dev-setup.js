#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up development environment...\n');

// Check if .env exists, if not copy from .env.example
if (!fs.existsSync('.env')) {
  console.log('📋 Creating .env file from .env.example...');
  fs.copyFileSync('.env.example', '.env');
  console.log('✅ .env file created. Please update it with your configuration.\n');
} else {
  console.log('✅ .env file already exists.\n');
}

// Install dependencies
console.log('📦 Installing dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed successfully.\n');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Build packages
console.log('🔨 Building packages...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Packages built successfully.\n');
} catch (error) {
  console.error('❌ Failed to build packages:', error.message);
  console.log('⚠️  This is expected on first setup. Packages will be built as needed.\n');
}

console.log('🎉 Development environment setup complete!');
console.log('\nNext steps:');
console.log('1. Update your .env file with the correct configuration');
console.log('2. Start the development database: npm run docker:up');
console.log('3. Start the development servers: npm run dev');
console.log('\nHappy coding! 🚀');