#!/usr/bin/env node

/**
 * Pre-commit hooks setup for code quality enforcement
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PreCommitSetup {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.hooksDir = path.join(this.rootDir, '.git', 'hooks');
  }

  setup() {
    console.log('🔧 Setting up pre-commit hooks...\n');

    this.createPreCommitHook();
    this.createPrePushHook();
    this.createCommitMsgHook();
    this.installHusky();

    console.log('✅ Pre-commit hooks setup complete!');
  }

  createPreCommitHook() {
    const preCommitScript = `#!/bin/sh
# Pre-commit hook for code quality checks

echo "🔍 Running pre-commit checks..."

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "❌ Not in a git repository"
  exit 1
fi

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E "\\.(ts|tsx|js|jsx)$" || true)

if [ -z "$STAGED_FILES" ]; then
  echo "✅ No TypeScript/JavaScript files to check"
  exit 0
fi

echo "📝 Checking staged files:"
echo "$STAGED_FILES"

# Run type checking
echo "\\n🔧 Running type check..."
if ! npm run type-check; then
  echo "❌ Type check failed"
  exit 1
fi

# Run linting
echo "\\n🧹 Running linter..."
if ! npm run lint; then
  echo "❌ Linting failed"
  echo "💡 Try running: npm run lint:fix"
  exit 1
fi

# Run formatting check
echo "\\n💅 Checking code formatting..."
if ! npm run format:check; then
  echo "❌ Code formatting check failed"
  echo "💡 Try running: npm run format"
  exit 1
fi

# Run tests for affected packages
echo "\\n🧪 Running tests..."
if ! npm run test; then
  echo "❌ Tests failed"
  exit 1
fi

echo "\\n✅ All pre-commit checks passed!"
exit 0
`;

    const hookPath = path.join(this.hooksDir, 'pre-commit');
    
    // Ensure hooks directory exists
    if (!fs.existsSync(this.hooksDir)) {
      fs.mkdirSync(this.hooksDir, { recursive: true });
    }

    fs.writeFileSync(hookPath, preCommitScript);
    
    // Make executable on Unix systems
    if (process.platform !== 'win32') {
      try {
        execSync(`chmod +x ${hookPath}`);
      } catch (error) {
        console.warn('⚠️  Could not make pre-commit hook executable');
      }
    }

    console.log('✅ Pre-commit hook created');
  }

  createPrePushHook() {
    const prePushScript = `#!/bin/sh
# Pre-push hook for comprehensive checks

echo "🚀 Running pre-push checks..."

# Run full test suite
echo "\\n🧪 Running full test suite..."
if ! npm run test:coverage; then
  echo "❌ Test suite failed"
  exit 1
fi

# Run build to ensure everything compiles
echo "\\n🔨 Running build..."
if ! npm run build; then
  echo "❌ Build failed"
  exit 1
fi

# Run security audit
echo "\\n🔒 Running security audit..."
if ! npm audit --audit-level=moderate; then
  echo "❌ Security audit failed"
  echo "💡 Try running: npm audit fix"
  exit 1
fi

echo "\\n✅ All pre-push checks passed!"
exit 0
`;

    const hookPath = path.join(this.hooksDir, 'pre-push');
    fs.writeFileSync(hookPath, prePushScript);
    
    if (process.platform !== 'win32') {
      try {
        execSync(`chmod +x ${hookPath}`);
      } catch (error) {
        console.warn('⚠️  Could not make pre-push hook executable');
      }
    }

    console.log('✅ Pre-push hook created');
  }

  createCommitMsgHook() {
    const commitMsgScript = `#!/bin/sh
# Commit message validation hook

COMMIT_MSG_FILE=$1
COMMIT_MSG=$(cat $COMMIT_MSG_FILE)

# Check commit message format
# Expected format: type(scope): description
# Examples: feat(auth): add login functionality
#           fix(ui): resolve button styling issue
#           docs: update README

PATTERN="^(feat|fix|docs|style|refactor|test|chore|perf|ci|build)(\\(.+\\))?: .{1,50}"

if ! echo "$COMMIT_MSG" | grep -qE "$PATTERN"; then
  echo "❌ Invalid commit message format!"
  echo ""
  echo "Expected format: type(scope): description"
  echo ""
  echo "Types:"
  echo "  feat:     A new feature"
  echo "  fix:      A bug fix"
  echo "  docs:     Documentation only changes"
  echo "  style:    Changes that do not affect the meaning of the code"
  echo "  refactor: A code change that neither fixes a bug nor adds a feature"
  echo "  test:     Adding missing tests or correcting existing tests"
  echo "  chore:    Changes to the build process or auxiliary tools"
  echo "  perf:     A code change that improves performance"
  echo "  ci:       Changes to CI configuration files and scripts"
  echo "  build:    Changes that affect the build system or external dependencies"
  echo ""
  echo "Examples:"
  echo "  feat(auth): add login functionality"
  echo "  fix(ui): resolve button styling issue"
  echo "  docs: update README"
  echo ""
  exit 1
fi

echo "✅ Commit message format is valid"
exit 0
`;

    const hookPath = path.join(this.hooksDir, 'commit-msg');
    fs.writeFileSync(hookPath, commitMsgScript);
    
    if (process.platform !== 'win32') {
      try {
        execSync(`chmod +x ${hookPath}`);
      } catch (error) {
        console.warn('⚠️  Could not make commit-msg hook executable');
      }
    }

    console.log('✅ Commit message hook created');
  }

  installHusky() {
    console.log('📦 Installing Husky for better hook management...');
    
    try {
      // Check if husky is already installed
      execSync('npm list husky', { stdio: 'pipe' });
      console.log('✅ Husky already installed');
    } catch (error) {
      // Install husky
      try {
        execSync('npm install --save-dev husky', { stdio: 'inherit' });
        execSync('npx husky install', { stdio: 'inherit' });
        console.log('✅ Husky installed and initialized');
      } catch (installError) {
        console.warn('⚠️  Could not install Husky automatically');
        console.log('💡 You can install it manually with: npm install --save-dev husky');
      }
    }
  }

  createLintStagedConfig() {
    const lintStagedConfig = {
      '*.{ts,tsx,js,jsx}': [
        'eslint --fix --max-warnings=0',
        'prettier --write'
      ],
      '*.{json,md,yml,yaml}': [
        'prettier --write'
      ]
    };

    const configPath = path.join(this.rootDir, '.lintstagedrc.json');
    fs.writeFileSync(configPath, JSON.stringify(lintStagedConfig, null, 2));
    console.log('✅ Lint-staged configuration created');
  }

  disable() {
    console.log('🛑 Disabling pre-commit hooks...');
    
    const hooks = ['pre-commit', 'pre-push', 'commit-msg'];
    hooks.forEach(hook => {
      const hookPath = path.join(this.hooksDir, hook);
      if (fs.existsSync(hookPath)) {
        fs.unlinkSync(hookPath);
        console.log(`✅ Removed ${hook} hook`);
      }
    });
  }

  status() {
    console.log('📊 Pre-commit hooks status:');
    
    const hooks = ['pre-commit', 'pre-push', 'commit-msg'];
    hooks.forEach(hook => {
      const hookPath = path.join(this.hooksDir, hook);
      const exists = fs.existsSync(hookPath);
      const status = exists ? '✅ Installed' : '❌ Not installed';
      console.log(`  ${hook}: ${status}`);
    });
  }
}

// CLI interface
if (require.main === module) {
  const command = process.argv[2];
  const preCommit = new PreCommitSetup();

  switch (command) {
    case 'setup':
      preCommit.setup();
      preCommit.createLintStagedConfig();
      break;
    case 'disable':
      preCommit.disable();
      break;
    case 'status':
      preCommit.status();
      break;
    default:
      console.log('📋 Available commands:');
      console.log('  setup   - Setup pre-commit hooks');
      console.log('  disable - Disable pre-commit hooks');
      console.log('  status  - Show hooks status');
      preCommit.setup();
      preCommit.createLintStagedConfig();
  }
}

module.exports = PreCommitSetup;