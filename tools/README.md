# Development Tools and Automation

This directory contains comprehensive development tools and automation scripts for the Task Management App monorepo.

## Directory Structure

```
tools/
├── build/              # Build configurations and tools
├── scripts/            # Automation and maintenance scripts
├── generators/         # Code generators for components and APIs
├── linting/           # Code quality and linting configurations
├── testing/           # Testing infrastructure and configurations
├── quality/           # Code quality analysis tools
└── README.md          # This file
```

## Build Tools (`tools/build/`)

### Webpack Configuration
- **webpack.common.js** - Shared Webpack configuration
- **webpack.dev.js** - Development-specific configuration
- **webpack.prod.js** - Production-specific configuration

### Vite Configuration
- **vite.config.ts** - Modern build tool configuration for faster development

### ESBuild Configuration
- **esbuild.config.js** - Ultra-fast JavaScript bundler configuration

### PostCSS Configuration
- **postcss.config.js** - CSS processing and optimization

## Scripts (`tools/scripts/`)

### Setup Scripts
- **setup.sh** / **setup.ps1** - Complete development environment setup
- Cross-platform support for Unix/Linux and Windows

### Database Management
- **database.sh** - Comprehensive database operations
  - Start/stop containers
  - Run migrations and seeds
  - Backup and restore
  - Health checks

### Deployment
- **deploy.sh** - Production deployment automation
  - Multi-environment support
  - Docker image building
  - Kubernetes deployment
  - Rollback capabilities

### Maintenance
- **maintenance.sh** - System maintenance and optimization
  - Cleanup temporary files
  - Update dependencies
  - Health checks
  - Performance optimization
  - Security scans

## Code Generators (`tools/generators/`)

### React Component Generator
```bash
node tools/generators/component.js MyComponent --with-styles --with-variants
```

Features:
- TypeScript support
- Test file generation
- Storybook stories
- CSS modules
- Accessibility compliance

### API Route Generator
```bash
node tools/generators/api-route.js user --with-subscription --fields '[{"name":"email","type":"email"}]'
```

Features:
- tRPC route generation
- Validation schemas
- Service layer
- Test files
- Type-safe APIs

## Linting and Code Quality (`tools/linting/`)

### ESLint Configuration
- **eslint.config.js** - Comprehensive linting rules
- TypeScript support
- React/JSX rules
- Node.js rules
- Security rules
- Accessibility rules

### Prettier Configuration
- **prettier.config.js** - Code formatting rules
- Multi-language support
- Consistent formatting

### Stylelint Configuration
- **stylelint.config.js** - CSS/SCSS linting
- BEM methodology
- Performance rules
- Browser compatibility

## Testing Infrastructure (`tools/testing/`)

### Vitest Configuration
- **vitest.config.ts** - Unit and integration testing
- Coverage reporting
- Mock configurations
- Performance testing

### Test Setup
- **setup.ts** - Global test configuration
- Mock utilities
- Test data builders
- Helper functions

### Playwright Configuration
- **playwright.config.ts** - End-to-end testing
- Cross-browser testing
- Visual regression testing
- Performance testing

## Quality Assurance (`tools/quality/`)

### SonarQube Configuration
- **sonarqube.properties** - Code quality analysis
- Technical debt tracking
- Security vulnerability detection
- Code coverage integration

### Codecov Configuration
- **codecov.yml** - Coverage reporting
- Multi-package support
- Quality gates
- Component-based coverage

## Usage Examples

### Initial Setup
```bash
# Unix/Linux/macOS
./tools/scripts/setup.sh

# Windows
./tools/scripts/setup.ps1
```

### Development Workflow
```bash
# Start development environment
pnpm run dev

# Generate a new component
node tools/generators/component.js UserProfile --with-styles

# Generate an API route
node tools/generators/api-route.js task --with-subscription

# Run tests
pnpm run test

# Run linting
pnpm run lint

# Build for production
pnpm run build
```

### Database Operations
```bash
# Start database
./tools/scripts/database.sh start

# Run migrations
./tools/scripts/database.sh migrate

# Seed database
./tools/scripts/database.sh seed

# Create backup
./tools/scripts/database.sh backup

# Check health
./tools/scripts/database.sh health
```

### Deployment
```bash
# Build and deploy to staging
./tools/scripts/deploy.sh build staging
./tools/scripts/deploy.sh deploy staging

# Deploy to production
./tools/scripts/deploy.sh deploy production --force

# Check deployment status
./tools/scripts/deploy.sh status production

# Rollback if needed
./tools/scripts/deploy.sh rollback production
```

### Maintenance
```bash
# Run all maintenance tasks
./tools/scripts/maintenance.sh all

# Clean up temporary files
./tools/scripts/maintenance.sh cleanup

# Update dependencies
./tools/scripts/maintenance.sh update

# Run health checks
./tools/scripts/maintenance.sh health

# Optimize performance
./tools/scripts/maintenance.sh optimize
```

## Configuration Files

### Package.json Scripts
The tools integrate with the following package.json scripts:

```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "build:packages": "turbo run build --filter='./packages/*'",
    "test": "turbo run test",
    "test:unit": "vitest run",
    "test:e2e": "playwright test",
    "lint": "turbo run lint",
    "lint:fix": "turbo run lint:fix",
    "type-check": "turbo run type-check",
    "format": "prettier --write .",
    "clean": "turbo run clean",
    "setup": "./tools/scripts/setup.sh"
  }
}
```

### Environment Variables
The tools support various environment variables:

- `NODE_ENV` - Environment (development, staging, production)
- `DATABASE_URL` - Database connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret
- `API_URL` - API server URL
- `WS_URL` - WebSocket server URL

## IDE Integration

### VS Code
The tools work seamlessly with VS Code extensions:
- ESLint extension for real-time linting
- Prettier extension for formatting
- TypeScript support
- Debugger configurations

### WebStorm/IntelliJ
Full support for JetBrains IDEs:
- Built-in TypeScript support
- ESLint integration
- Prettier integration
- Run configurations

## CI/CD Integration

The tools are designed to work with various CI/CD platforms:

### GitHub Actions
```yaml
- name: Setup
  run: ./tools/scripts/setup.sh

- name: Run tests
  run: pnpm run test

- name: Build
  run: pnpm run build

- name: Deploy
  run: ./tools/scripts/deploy.sh deploy production
```

### GitLab CI
```yaml
setup:
  script:
    - ./tools/scripts/setup.sh

test:
  script:
    - pnpm run test

deploy:
  script:
    - ./tools/scripts/deploy.sh deploy production
```

## Troubleshooting

### Common Issues

1. **Permission Denied on Scripts**
   ```bash
   chmod +x tools/scripts/*.sh
   ```

2. **Node Version Issues**
   ```bash
   nvm use 18
   # or
   nvm install 18
   ```

3. **Docker Issues**
   ```bash
   docker system prune -f
   ./tools/scripts/database.sh restart
   ```

4. **Port Conflicts**
   ```bash
   lsof -i :3000
   kill -9 <PID>
   ```

### Getting Help

- Check the logs in `./logs/` directory
- Run health checks: `./tools/scripts/maintenance.sh health`
- Review the setup script output
- Check the troubleshooting section in each tool's documentation

## Contributing

When adding new tools:

1. Follow the existing directory structure
2. Include comprehensive documentation
3. Add error handling and logging
4. Support both Unix and Windows where applicable
5. Include tests for the tools
6. Update this README

## License

These tools are part of the Task Management App project and follow the same license terms.