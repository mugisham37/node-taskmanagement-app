#!/usr/bin/env node

/**
 * File Watcher for Development
 * Provides intelligent file watching and hot reloading across the monorepo
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const chokidar = require('chokidar');

class FileWatcher {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.watchers = new Map();
    this.buildQueue = new Set();
    this.isBuilding = false;
    this.debounceTimeout = null;
    
    this.packageDependencies = {
      '@taskmanagement/shared': [],
      '@taskmanagement/database': ['@taskmanagement/shared'],
      '@taskmanagement/config': ['@taskmanagement/shared'],
      '@taskmanagement/ui': ['@taskmanagement/shared'],
      '@taskmanagement/server': ['@taskmanagement/shared', '@taskmanagement/database', '@taskmanagement/config'],
      '@taskmanagement/client': ['@taskmanagement/shared', '@taskmanagement/database', '@taskmanagement/ui', '@taskmanagement/config']
    };
  }

  start() {
    console.log('👀 Starting file watcher for development...\n');
    
    this.setupPackageWatchers();
    this.setupAppWatchers();
    
    console.log('✅ File watchers initialized');
    console.log('🔄 Watching for changes...\n');
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down file watchers...');
      this.stop();
      process.exit(0);
    });
  }

  setupPackageWatchers() {
    const packages = ['shared', 'database', 'ui', 'config'];
    
    packages.forEach(pkg => {
      const packagePath = path.join(this.rootDir, 'packages', pkg, 'src');
      
      if (fs.existsSync(packagePath)) {
        const watcher = chokidar.watch(packagePath, {
          ignored: /node_modules|\.git/,
          persistent: true,
          ignoreInitial: true
        });

        watcher.on('change', (filePath) => {
          this.handlePackageChange(`@taskmanagement/${pkg}`, filePath);
        });

        watcher.on('add', (filePath) => {
          this.handlePackageChange(`@taskmanagement/${pkg}`, filePath);
        });

        watcher.on('unlink', (filePath) => {
          this.handlePackageChange(`@taskmanagement/${pkg}`, filePath);
        });

        this.watchers.set(`@taskmanagement/${pkg}`, watcher);
        console.log(`📦 Watching package: @taskmanagement/${pkg}`);
      }
    });
  }

  setupAppWatchers() {
    const apps = ['client', 'server'];
    
    apps.forEach(app => {
      const appPath = path.join(this.rootDir, 'apps', app, 'src');
      
      if (fs.existsSync(appPath)) {
        const watcher = chokidar.watch(appPath, {
          ignored: /node_modules|\.git|\.next|dist/,
          persistent: true,
          ignoreInitial: true
        });

        watcher.on('change', (filePath) => {
          this.handleAppChange(`@taskmanagement/${app}`, filePath);
        });

        this.watchers.set(`@taskmanagement/${app}`, watcher);
        console.log(`🚀 Watching app: @taskmanagement/${app}`);
      }
    });
  }

  handlePackageChange(packageName, filePath) {
    const relativePath = path.relative(this.rootDir, filePath);
    console.log(`📝 Changed: ${relativePath}`);
    
    // Add package to build queue
    this.buildQueue.add(packageName);
    
    // Add dependent packages to build queue
    this.addDependentPackages(packageName);
    
    // Debounce builds
    this.debounceBuild();
  }

  handleAppChange(appName, filePath) {
    const relativePath = path.relative(this.rootDir, filePath);
    console.log(`🔄 App changed: ${relativePath}`);
    
    // Apps handle their own hot reloading, but we might need to rebuild dependencies
    // This is mainly for logging and potential future enhancements
  }

  addDependentPackages(changedPackage) {
    Object.entries(this.packageDependencies).forEach(([pkg, deps]) => {
      if (deps.includes(changedPackage)) {
        this.buildQueue.add(pkg);
      }
    });
  }

  debounceBuild() {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    
    this.debounceTimeout = setTimeout(() => {
      this.processBuildQueue();
    }, 500); // 500ms debounce
  }

  async processBuildQueue() {
    if (this.isBuilding || this.buildQueue.size === 0) {
      return;
    }

    this.isBuilding = true;
    const packagesToBuild = Array.from(this.buildQueue);
    this.buildQueue.clear();

    console.log(`\n🔨 Building packages: ${packagesToBuild.join(', ')}`);
    
    try {
      // Build packages in dependency order
      const orderedPackages = this.orderPackagesByDependencies(packagesToBuild);
      
      for (const pkg of orderedPackages) {
        await this.buildPackage(pkg);
      }
      
      console.log('✅ Build completed successfully\n');
    } catch (error) {
      console.error('❌ Build failed:', error.message);
    } finally {
      this.isBuilding = false;
    }
  }

  orderPackagesByDependencies(packages) {
    const ordered = [];
    const visited = new Set();
    
    const visit = (pkg) => {
      if (visited.has(pkg)) return;
      visited.add(pkg);
      
      const deps = this.packageDependencies[pkg] || [];
      deps.forEach(dep => {
        if (packages.includes(dep)) {
          visit(dep);
        }
      });
      
      if (packages.includes(pkg)) {
        ordered.push(pkg);
      }
    };
    
    packages.forEach(visit);
    return ordered;
  }

  buildPackage(packageName) {
    return new Promise((resolve, reject) => {
      const packageDir = packageName.replace('@taskmanagement/', '');
      const isApp = ['client', 'server'].includes(packageDir);
      const workingDir = isApp ? `apps/${packageDir}` : `packages/${packageDir}`;
      
      console.log(`  🔧 Building ${packageName}...`);
      
      const buildProcess = spawn('npm', ['run', 'build'], {
        cwd: path.join(this.rootDir, workingDir),
        stdio: 'pipe'
      });

      let output = '';
      buildProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      buildProcess.stderr.on('data', (data) => {
        output += data.toString();
      });

      buildProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`  ✅ ${packageName} built successfully`);
          resolve();
        } else {
          console.error(`  ❌ ${packageName} build failed`);
          console.error(output);
          reject(new Error(`Build failed for ${packageName}`));
        }
      });
    });
  }

  stop() {
    this.watchers.forEach((watcher, name) => {
      watcher.close();
      console.log(`🛑 Stopped watching: ${name}`);
    });
    this.watchers.clear();
  }

  getStatus() {
    return {
      watchersCount: this.watchers.size,
      isBuilding: this.isBuilding,
      buildQueueSize: this.buildQueue.size,
      watchedPackages: Array.from(this.watchers.keys())
    };
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  const watcher = new FileWatcher();

  switch (command) {
    case 'start':
      watcher.start();
      break;
    case 'status':
      console.log('📊 File Watcher Status:', watcher.getStatus());
      break;
    default:
      console.log('📋 Available commands:');
      console.log('  start   - Start file watching');
      console.log('  status  - Show watcher status');
      watcher.start(); // Default to start
  }
}

module.exports = FileWatcher;