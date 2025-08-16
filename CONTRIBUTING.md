# Contributing to Task Management Monolith

Thank you for your interest in contributing to the Task Management Monolith! This document provides guidelines and information for contributors.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Message Format](#commit-message-format)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)

## 🤝 Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow. Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## 🚀 Getting Started

### Prerequisites

- Node.js 18.18.0 or higher
- npm 9.0.0 or higher
- Docker and Docker Compose
- Git

### Development Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/taskmanagement-monolith.git
   cd taskmanagement-monolith
   ```

3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/taskmanagement-monolith.git
   ```

4. **Install dependencies**:
   ```bash
   make install
   # or
   npm install
   ```

5. **Set up environment**:
   ```bash
   make setup-env
   # Edit .env.local with your configuration
   ```

6. **Start development services**:
   ```bash
   make docker-up
   ```

7. **Run database migrations**:
   ```bash
   make db-migrate
   make db-seed
   ```

8. **Start development servers**:
   ```bash
   make dev
   ```

## 🔄 Development Workflow

### Branch Naming Convention

Use descriptive branch names with the following prefixes:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or modifications
- `chore/` - Maintenance tasks

Examples:
- `feature/user-authentication`
- `fix/task-creation-validation`
- `docs/api-documentation-update`

### Making Changes

1. **Create a new branch** from `main`:
   ```bash
   git checkout main
   git pull upstream main
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards

3. **Write tests** for new functionality

4. **Run tests** to ensure everything works:
   ```bash
   make test
   ```

5. **Check code quality**:
   ```bash
   make lint
   make type-check
   make format-check
   ```

6. **Commit your changes** using conventional commits:
   ```bash
   git add .
   git commit -m "feat(api): add user authentication endpoint"
   ```

7. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

8. **Create a Pull Request** on GitHub

## 📝 Coding Standards

### TypeScript

- Use strict TypeScript configuration
- No `any` types (use `unknown` if necessary)
- Prefer interfaces over type aliases for object shapes
- Use consistent type imports: `import type { User } from './types'`

### Code Style

- Use Prettier for formatting (configured in `.prettierrc`)
- Follow ESLint rules (configured in `.eslintrc.js`)
- Use meaningful variable and function names
- Write self-documenting code with clear comments when necessary

### Architecture Patterns

- Follow Clean Architecture principles
- Use Domain-Driven Design (DDD) patterns
- Implement CQRS for complex operations
- Separate concerns properly between layers

### File Organization

```
packages/package-name/
├── src/
│   ├── index.ts          # Main exports
│   ├── types/            # Type definitions
│   ├── utils/            # Utility functions
│   ├── __tests__/        # Unit tests
│   └── ...
├── package.json
├── tsconfig.json
└── README.md
```

## 🧪 Testing Guidelines

### Test Types

1. **Unit Tests**
   - Test individual functions and classes
   - Mock external dependencies
   - Use Jest/Vitest
   - Aim for 80%+ coverage

2. **Integration Tests**
   - Test component interactions
   - Use real database (test instance)
   - Test API endpoints

3. **End-to-End Tests**
   - Test complete user workflows
   - Use Playwright
   - Test critical paths only

### Test Structure

```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create a user with valid data', async () => {
      // Arrange
      const userData = { email: 'test@example.com', name: 'Test User' };
      
      // Act
      const result = await userService.createUser(userData);
      
      // Assert
      expect(result).toMatchObject(userData);
      expect(result.id).toBeDefined();
    });

    it('should throw error with invalid email', async () => {
      // Arrange
      const userData = { email: 'invalid-email', name: 'Test User' };
      
      // Act & Assert
      await expect(userService.createUser(userData)).rejects.toThrow('Invalid email');
    });
  });
});
```

### Test Best Practices

- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Test both happy path and error cases
- Use test builders/factories for complex objects
- Mock external dependencies
- Keep tests independent and isolated

## 📝 Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or modifying tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes
- `build`: Build system changes

### Scopes

Use the package or application name:
- `api`, `web`, `admin`, `mobile`
- `core`, `types`, `validation`, `auth`, etc.
- `infra`, `docs`, `ci`

### Examples

```bash
feat(api): add user authentication endpoint
fix(web): resolve task creation form validation
docs(readme): update installation instructions
test(auth): add unit tests for JWT service
refactor(database): improve query performance
chore(deps): update dependencies to latest versions
```

## 🔍 Pull Request Process

### Before Submitting

1. **Rebase your branch** on the latest main:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all checks**:
   ```bash
   make lint
   make type-check
   make test
   make build
   ```

3. **Update documentation** if needed

4. **Add tests** for new functionality

### PR Requirements

- [ ] Clear, descriptive title
- [ ] Detailed description of changes
- [ ] Link to related issues
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No merge conflicts
- [ ] All CI checks pass

### PR Template

```markdown
## Description
Brief description of the changes made.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Fixes #123

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots for UI changes.

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests added and passing
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. **Automated checks** must pass
2. **At least one approval** from maintainers
3. **Address feedback** promptly
4. **Squash commits** if requested
5. **Maintainer will merge** when ready

## 🐛 Issue Reporting

### Bug Reports

Use the bug report template and include:

- **Environment details** (OS, Node version, etc.)
- **Steps to reproduce** the issue
- **Expected behavior**
- **Actual behavior**
- **Screenshots** if applicable
- **Error messages** and stack traces

### Feature Requests

Use the feature request template and include:

- **Problem description** you're trying to solve
- **Proposed solution** or feature
- **Alternative solutions** considered
- **Additional context** or examples

### Security Issues

**Do not** create public issues for security vulnerabilities. Instead:

1. Email security@taskmanagement.com
2. Include detailed description
3. Wait for acknowledgment before disclosure

## 🏷️ Labels and Milestones

### Issue Labels

- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Improvements or additions to docs
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention is needed
- `priority: high` - High priority issue
- `status: blocked` - Blocked by other issues
- `type: breaking` - Breaking change

### Component Labels

- `api` - Backend API related
- `web` - Web frontend related
- `admin` - Admin dashboard related
- `mobile` - Mobile app related
- `infra` - Infrastructure related
- `docs` - Documentation related

## 🎯 Development Tips

### Debugging

- Use the debugger in your IDE
- Add logging with appropriate levels
- Use browser dev tools for frontend issues
- Check Docker logs: `make docker-logs`

### Performance

- Profile code with appropriate tools
- Monitor bundle sizes
- Use React DevTools for React components
- Check database query performance

### Common Issues

1. **Port conflicts**: Check if ports are already in use
2. **Database connection**: Ensure Docker services are running
3. **Environment variables**: Check `.env.local` configuration
4. **Cache issues**: Clear `.turbo` and `node_modules/.cache`

## 📚 Resources

- [Project Documentation](./docs/)
- [API Documentation](./docs/api/)
- [Architecture Guide](./docs/architecture/)
- [Deployment Guide](./docs/deployment/)

## 🙋‍♀️ Getting Help

- **GitHub Discussions** for questions and ideas
- **GitHub Issues** for bugs and feature requests
- **Code reviews** for feedback on implementations
- **Documentation** for guides and references

## 🎉 Recognition

Contributors will be recognized in:

- `CONTRIBUTORS.md` file
- Release notes for significant contributions
- GitHub contributor graphs
- Special mentions in project updates

Thank you for contributing to Task Management Monolith! 🚀