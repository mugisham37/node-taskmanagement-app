#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🚀 Setting up unified development environment...\n');

// Environment setup
const setupEnvironment = () => {
  console.log('🔧 Setting up environment files...');
  
  // Root .env
  if (!fs.existsSync('.env')) {
    console.log('📋 Creating root .env file from .env.example...');
    fs.copyFileSync('.env.example', '.env');
    console.log('✅ Root .env file created.');
  }

  // Client .env.local
  const clientEnvPath = 'apps/client/.env.local';
  if (!fs.existsSync(clientEnvPath)) {
    console.log('📋 Creating client .env.local file...');
    const clientEnvContent = `# Client Environment Variables
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-here
NODE_ENV=development
`;
    fs.writeFileSync(clientEnvPath, clientEnvContent);
    console.log('✅ Client .env.local file created.');
  }

  // Server .env (if not exists)
  const serverEnvPath = 'apps/server/.env';
  if (!fs.existsSync(serverEnvPath)) {
    console.log('📋 Creating server .env file...');
    const serverEnvContent = `# Server Environment Variables
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taskmanagement
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret-here
CORS_ORIGIN=http://localhost:3000
`;
    fs.writeFileSync(serverEnvPath, serverEnvContent);
    console.log('✅ Server .env file created.');
  }

  console.log('✅ Environment setup complete.\n');
};

// Check system requirements
const checkSystemRequirements = () => {
  console.log('🔍 Checking system requirements...');
  
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    
    console.log(`✅ Node.js: ${nodeVersion}`);
    console.log(`✅ npm: ${npmVersion}`);
    
    // Check if Docker is available
    try {
      execSync('docker --version', { encoding: 'utf8', stdio: 'pipe' });
      console.log('✅ Docker is available');
    } catch {
      console.log('⚠️  Docker not found - database services may not work');
    }
    
    console.log('✅ System requirements check complete.\n');
  } catch (error) {
    console.error('❌ System requirements check failed:', error.message);
    process.exit(1);
  }
};

// Install dependencies with better error handling
const installDependencies = () => {
  console.log('📦 Installing dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed successfully.\n');
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    console.log('💡 Try running: npm cache clean --force && npm install');
    process.exit(1);
  }
};

// Build packages with dependency order
const buildPackages = () => {
  console.log('🔨 Building packages in dependency order...');
  try {
    // Build shared packages first
    console.log('Building shared packages...');
    execSync('npm run build --workspace=@taskmanagement/shared', { stdio: 'inherit' });
    execSync('npm run build --workspace=@taskmanagement/database', { stdio: 'inherit' });
    execSync('npm run build --workspace=@taskmanagement/config', { stdio: 'inherit' });
    execSync('npm run build --workspace=@taskmanagement/ui', { stdio: 'inherit' });
    
    // Build applications
    console.log('Building applications...');
    execSync('npm run build --workspace=@taskmanagement/server', { stdio: 'inherit' });
    execSync('npm run build --workspace=@taskmanagement/client', { stdio: 'inherit' });
    
    console.log('✅ All packages built successfully.\n');
  } catch (error) {
    console.error('❌ Failed to build packages:', error.message);
    console.log('⚠️  This is expected on first setup. Packages will be built as needed.\n');
  }
};

// Setup development database
const setupDatabase = () => {
  console.log('🗄️  Setting up development database...');
  try {
    // Check if Docker Compose is available
    execSync('docker-compose --version', { stdio: 'pipe' });
    
    console.log('Starting database services...');
    execSync('docker-compose up -d database redis', { stdio: 'inherit' });
    
    // Wait a moment for services to start
    console.log('Waiting for services to start...');
    setTimeout(() => {
      try {
        execSync('npm run db:push --workspace=@taskmanagement/server', { stdio: 'inherit' });
        console.log('✅ Database schema pushed successfully.');
      } catch (error) {
        console.log('⚠️  Database setup will be completed when you first run the server.');
      }
    }, 3000);
    
  } catch (error) {
    console.log('⚠️  Docker not available. Database setup skipped.');
    console.log('💡 You can manually start the database later with: npm run docker:up');
  }
};

// Create development scripts
const createDevScripts = () => {
  console.log('📝 Creating development scripts...');
  
  const scriptsDir = 'scripts';
  if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
  }

  // Create dev-start script
  const devStartScript = `#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting unified development environment...\\n');

// Start all development processes
const processes = [];

// Start server
console.log('🔧 Starting server...');
const server = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, '..', 'apps', 'server'),
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});

server.stdout.on('data', (data) => {
  console.log(\`[SERVER] \${data.toString().trim()}\`);
});

server.stderr.on('data', (data) => {
  console.error(\`[SERVER] \${data.toString().trim()}\`);
});

processes.push(server);

// Wait a moment then start client
setTimeout(() => {
  console.log('🎨 Starting client...');
  const client = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, '..', 'apps', 'client'),
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true
  });

  client.stdout.on('data', (data) => {
    console.log(\`[CLIENT] \${data.toString().trim()}\`);
  });

  client.stderr.on('data', (data) => {
    console.error(\`[CLIENT] \${data.toString().trim()}\`);
  });

  processes.push(client);
}, 2000);

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\\n🛑 Shutting down development environment...');
  processes.forEach(proc => {
    if (proc && !proc.killed) {
      proc.kill('SIGINT');
    }
  });
  process.exit(0);
});

process.on('SIGTERM', () => {
  processes.forEach(proc => {
    if (proc && !proc.killed) {
      proc.kill('SIGTERM');
    }
  });
  process.exit(0);
});
`;

  fs.writeFileSync(path.join(scriptsDir, 'dev-start.js'), devStartScript);
  
  // Make script executable on Unix systems
  if (os.platform() !== 'win32') {
    try {
      execSync(`chmod +x ${path.join(scriptsDir, 'dev-start.js')}`);
    } catch (error) {
      // Ignore chmod errors on Windows
    }
  }

  console.log('✅ Development scripts created.\n');
};

// Main setup function
const main = async () => {
  try {
    checkSystemRequirements();
    setupEnvironment();
    installDependencies();
    createDevScripts();
    buildPackages();
    setupDatabase();

    console.log('🎉 Unified development environment setup complete!');
    console.log('\\n📋 Available commands:');
    console.log('  npm run dev          - Start all development servers');
    console.log('  npm run dev:full     - Start with database services');
    console.log('  npm run build        - Build all packages');
    console.log('  npm run test         - Run all tests');
    console.log('  npm run lint         - Lint all code');
    console.log('  npm run type-check   - Type check all packages');
    console.log('\\n🚀 Quick start:');
    console.log('  1. npm run docker:up  (start database services)');
    console.log('  2. npm run dev        (start development servers)');
    console.log('\\n🌐 URLs:');
    console.log('  Client: http://localhost:3000');
    console.log('  Server: http://localhost:3001');
    console.log('  API Docs: http://localhost:3001/docs');
    console.log('\\nHappy coding! 🚀');
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
};

main();