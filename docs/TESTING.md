# Testing Guide

This document outlines the testing strategy and infrastructure for the Unified Enterprise Platform.

## Testing Architecture

The testing infrastructure follows a multi-layered approach:

### Test Types

1. **Unit Tests** (`tests/unit/`)
   - Test individual functions, classes, and modules in isolation
   - Fast execution with mocked dependencies
   - High code coverage target (>90%)

2. **Integration Tests** (`tests/integration/`)
   - Test interactions between components
   - Use test server with mocked external services
   - Verify API endpoints and service integration

3. **End-to-End Tests** (`tests/e2e/`)
   - Test complete user workflows
   - Use real browser automation (future implementation)
   - Verify business scenarios from user perspective

## Test Infrastructure

### Test Setup (`tests/setup.ts`)

Global test configuration that:

- Sets test environment variables
- Configures test database isolation
- Sets up service mocks
- Provides global test utilities

### Test Utilities (`tests/utils/test-helpers.ts`)

Comprehensive utilities including:

- **TestDataFactory**: Create test data objects
- **MockServiceFactory**: Create service mocks
- **TestDatabaseUtils**: Database testing utilities
- **WebSocketTestUtils**: WebSocket testing helpers
- **AuthTestUtils**: Authentication testing utilities
- **ApiTestUtils**: API testing helpers

### Test Fixtures (`tests/fixtures/`)

Pre-defined test data for:

- Users with different roles and states
- Workspaces with various configurations
- Projects and tasks with relationships
- Comments and activities

### Service Mocks (`tests/mocks/services.ts`)

Mock implementations for:

- Database operations (Prisma)
- External services (Email, SMS, File storage)
- Infrastructure services (Cache, WebSocket)
- Domain services (Auth, Task, Workspace)

## Running Tests

### Local Development

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Docker Environment

```bash
# Run tests in isolated Docker environment
npm run test:docker

# Clean up test containers
npm run test:docker:clean
```

### Database Testing

For tests that require a database:

1. **Start test database**:

   ```bash
   docker-compose -f docker-compose.test.yml up -d postgres-test redis-test
   ```

2. **Run database-dependent tests**:

   ```bash
   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/unified_enterprise_platform_test" npm test
   ```

3. **Clean up**:
   ```bash
   docker-compose -f docker-compose.test.yml down -v
   ```

## Test Configuration

### Vitest Configuration (`vitest.config.ts`)

- TypeScript support with path aliases
- Global test setup and teardown
- Coverage reporting with v8 provider
- Test timeout and environment settings

### Environment Variables

Test-specific environment variables:

- `NODE_ENV=test`
- `DATABASE_URL_TEST` for test database
- Mock service configurations
- Reduced timeouts for faster tests

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect, vi } from 'vitest';
import { TestDataFactory } from '@/tests/utils/test-helpers';
import { TaskService } from '@/application/services/task-service';

describe('TaskService', () => {
  it('should create a task successfully', async () => {
    // Arrange
    const mockRepository = vi.fn();
    const service = new TaskService(mockRepository);
    const taskData = await TestDataFactory.createTestTask();

    // Act
    const result = await service.createTask(taskData);

    // Assert
    expect(result).toBeDefined();
    expect(result.title).toBe(taskData.title);
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  TestServer,
  setupTestServer,
  teardownTestServer,
} from '@/tests/integration/test-server';

describe('Task API Integration', () => {
  let testServer: TestServer;

  beforeAll(async () => {
    testServer = await setupTestServer();
  });

  afterAll(async () => {
    await teardownTestServer();
  });

  it('should create a task via API', async () => {
    const response = await testServer.createAuthenticatedRequest({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: 'Test Task',
        description: 'A test task',
        priority: 'MEDIUM',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('Test Task');
  });
});
```

## Test Data Management

### Using Fixtures

```typescript
import { createUserFixture, createTaskFixture } from '@/tests/fixtures';

// Create test user with default data
const user = await createUserFixture('adminUser');

// Create test task with overrides
const task = createTaskFixture('todoTask', {
  title: 'Custom Task Title',
  assigneeId: user.id,
});
```

### Using Test Data Factory

```typescript
import { TestDataFactory } from '@/tests/utils/test-helpers';

// Create dynamic test data
const user = await TestDataFactory.createTestUser({
  email: 'custom@example.com',
  name: 'Custom User',
});

const workspace = TestDataFactory.createTestWorkspace({
  ownerId: user.id,
  name: 'Custom Workspace',
});
```

## Mocking Strategy

### Service Mocking

```typescript
import { mockServices } from '@/tests/mocks/services';

// Mock database operations
mockServices.prisma.user.findUnique.mockResolvedValue(testUser);
mockServices.prisma.task.create.mockResolvedValue(testTask);

// Mock external services
mockServices.email.sendEmail.mockResolvedValue(true);
mockServices.websocket.broadcast.mockResolvedValue(true);
```

### Module Mocking

```typescript
import { vi } from 'vitest';

// Mock entire modules
vi.mock('@/infrastructure/database', () => ({
  prisma: mockPrismaClient,
}));

// Mock specific functions
vi.mock('@/utils/jwt', () => ({
  generateToken: vi.fn().mockReturnValue('mock-token'),
  verifyToken: vi.fn().mockReturnValue({ userId: 'test-id' }),
}));
```

## Best Practices

### Test Organization

1. **Group related tests** using `describe` blocks
2. **Use descriptive test names** that explain the scenario
3. **Follow AAA pattern**: Arrange, Act, Assert
4. **Keep tests independent** and isolated
5. **Use beforeEach/afterEach** for setup and cleanup

### Test Data

1. **Use factories** for dynamic test data creation
2. **Use fixtures** for consistent test scenarios
3. **Avoid hardcoded values** in test assertions
4. **Clean up test data** after each test

### Mocking

1. **Mock external dependencies** to ensure test isolation
2. **Use realistic mock data** that matches production behavior
3. **Verify mock interactions** when testing side effects
4. **Reset mocks** between tests to avoid interference

### Performance

1. **Keep unit tests fast** (< 100ms per test)
2. **Use parallel execution** for independent tests
3. **Mock expensive operations** like database calls
4. **Optimize test setup** and teardown

## Continuous Integration

### GitHub Actions (Future)

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
```

## Troubleshooting

### Common Issues

1. **Database connection errors**: Ensure test database is running
2. **Mock not working**: Check mock setup and import order
3. **Test timeout**: Increase timeout or optimize test performance
4. **Flaky tests**: Ensure proper cleanup and test isolation

### Debug Tips

1. **Use `console.log`** for debugging test data
2. **Run single test** with `npm test -- --run specific.test.ts`
3. **Check mock calls** with `expect(mock).toHaveBeenCalledWith(...)`
4. **Use test coverage** to identify untested code paths

## Coverage Goals

- **Unit Tests**: >90% code coverage
- **Integration Tests**: >80% API endpoint coverage
- **E2E Tests**: >70% critical user journey coverage

## Future Enhancements

1. **Visual regression testing** with screenshot comparison
2. **Performance testing** with load testing scenarios
3. **Accessibility testing** with automated a11y checks
4. **Security testing** with vulnerability scanning
5. **Contract testing** with API contract validation
