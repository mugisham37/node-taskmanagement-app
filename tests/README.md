# Testing Documentation

This directory contains the comprehensive test suite for the Unified Enterprise Platform. The testing strategy follows a multi-layered approach with unit tests, integration tests, end-to-end tests, performance tests, and security tests.

## Test Structure

```
tests/
├── config/                 # Test configuration files
│   ├── test-config.ts      # Main test configuration
│   └── vitest-setup.ts     # Vitest global setup
├── helpers/                # Test helper utilities
│   ├── test-helpers.ts     # Main test helpers export
│   ├── mock-helpers.ts     # Mock creation utilities
│   ├── database-helpers.ts # Database test utilities
│   └── api-helpers.ts      # API testing utilities
├── unit/                   # Unit tests
│   ├── domain/            # Domain layer tests
│   ├── application/       # Application layer tests
│   └── infrastructure/    # Infrastructure layer tests
├── integration/           # Integration tests
│   ├── database/         # Database integration tests
│   ├── external-services/ # External service integration tests
│   └── events/           # Event handling integration tests
├── e2e/                  # End-to-end tests
│   ├── api/             # API endpoint E2E tests
│   ├── performance/     # Performance tests
│   └── security/        # Security tests
└── setup.ts             # Global test setup (legacy)
```

## Test Categories

### 1. Unit Tests (`tests/unit/`)

Unit tests focus on testing individual components in isolation. They use mocks for dependencies and test business logic, validation, and edge cases.

**Coverage Areas:**

- Domain entities and value objects
- Domain services and specifications
- Application services and use cases
- Infrastructure services (with mocked dependencies)

**Example:**

```typescript
describe('Task Entity', () => {
  it('should create a task with valid properties', () => {
    const task = new Task(/* ... */);
    expect(task.getTitle()).toBe('Test Task');
  });
});
```

### 2. Integration Tests (`tests/integration/`)

Integration tests verify that different components work together correctly. They use real database connections and test actual data persistence and retrieval.

**Coverage Areas:**

- Repository implementations with real database
- External service integrations
- Event handling workflows
- Caching mechanisms

**Example:**

```typescript
describe('TaskRepository Integration', () => {
  it('should save and retrieve a task', async () => {
    await taskRepository.save(task);
    const retrieved = await taskRepository.findById(task.getId());
    expect(retrieved).toEqual(task);
  });
});
```

### 3. End-to-End Tests (`tests/e2e/`)

E2E tests verify complete user workflows through the API. They test the entire application stack from HTTP requests to database persistence.

**Coverage Areas:**

- Complete API workflows
- User authentication and authorization
- Business process flows
- Error handling scenarios

**Example:**

```typescript
describe('Task API E2E', () => {
  it('should complete full task lifecycle', async () => {
    // Create, update, complete, and verify task
  });
});
```

### 4. Performance Tests (`tests/e2e/performance/`)

Performance tests ensure the application meets performance requirements under various load conditions.

**Coverage Areas:**

- API response times
- Concurrent request handling
- Database query performance
- Memory usage patterns

**Example:**

```typescript
describe('API Performance', () => {
  it('should handle 100 concurrent requests', async () => {
    const responses = await Promise.all(requests);
    expect(averageResponseTime).toBeLessThan(200);
  });
});
```

### 5. Security Tests (`tests/e2e/security/`)

Security tests verify that the application properly handles authentication, authorization, input validation, and other security concerns.

**Coverage Areas:**

- Authentication and authorization
- Input validation and sanitization
- Rate limiting
- CORS and security headers
- Error message security

## Running Tests

### Prerequisites

1. **Database Setup:**

   ```bash
   # Start test database (Docker)
   docker-compose -f docker-compose.test.yml up -d

   # Or use local PostgreSQL
   createdb test_db
   ```

2. **Environment Variables:**
   ```bash
   export TEST_DATABASE_URL="postgresql://test:test@localhost:5432/test_db"
   export TEST_REDIS_URL="redis://localhost:6379/1"
   export NODE_ENV="test"
   ```

### Test Commands

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance
npm run test:security

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests in CI mode
npm run test:ci

# Quick unit tests only
npm run test:quick
```

### Advanced Test Commands

```bash
# Run specific test file
npm test -- tests/unit/domain/entities/task.test.ts

# Run tests matching pattern
npm test -- --grep "Task Entity"

# Run tests with specific timeout
npm test -- --timeout 60000

# Run tests with verbose output
npm test -- --verbose

# Run tests in parallel
npm test -- --parallel

# Run tests with specific environment
npm run test:integration -- --environment=docker
```

## Test Configuration

### Main Configuration (`tests/config/test-config.ts`)

Contains all test-related configuration including:

- Database and Redis URLs
- Performance thresholds
- Security settings
- Timeout values
- Coverage thresholds

### Vitest Setup (`tests/config/vitest-setup.ts`)

Global test setup that:

- Initializes test database
- Sets up environment variables
- Provides test isolation
- Extends expect with custom matchers

## Test Helpers

### MockHelpers (`tests/helpers/mock-helpers.ts`)

Provides utilities for creating mocks:

```typescript
const mockRepository = MockHelpers.createMockRepository();
const mockService = MockHelpers.createMockService();
const mockEventBus = MockHelpers.createMockEventBus();
```

### DatabaseHelpers (`tests/helpers/database-helpers.ts`)

Provides database testing utilities:

```typescript
await DatabaseHelpers.cleanupDatabase();
await DatabaseHelpers.seedTestData();
await DatabaseHelpers.resetDatabase();
```

### ApiHelpers (`tests/helpers/api-helpers.ts`)

Provides API testing utilities:

```typescript
const token = await ApiHelpers.authenticateUser(app, email, password);
const user = await ApiHelpers.registerUser(app, userData);
const workspace = await ApiHelpers.createWorkspace(app, token, data);
```

### TestDataFactory (`tests/helpers/test-helpers.ts`)

Provides test data generation:

```typescript
const user = TestDataFactory.createUser();
const task = TestDataFactory.createTask(projectId, assigneeId, creatorId);
const project = TestDataFactory.createProject(workspaceId, ownerId);
```

## Writing Tests

### Best Practices

1. **Test Structure:**

   ```typescript
   describe('Component Name', () => {
     describe('method or feature', () => {
       it('should do something specific', () => {
         // Arrange
         // Act
         // Assert
       });
     });
   });
   ```

2. **Use Descriptive Names:**

   ```typescript
   it('should throw error when task title is empty', () => {
     // Test implementation
   });
   ```

3. **Test Edge Cases:**

   ```typescript
   it('should handle null values gracefully', () => {
     // Test null handling
   });

   it('should validate maximum length constraints', () => {
     // Test boundary conditions
   });
   ```

4. **Use Test Helpers:**

   ```typescript
   const task = TestDataFactory.createTask(projectId, assigneeId, creatorId);
   const mockRepo = MockHelpers.createMockRepository();
   ```

5. **Clean Up After Tests:**
   ```typescript
   afterEach(async () => {
     await DatabaseHelpers.cleanupDatabase();
     MockHelpers.resetAllMocks();
   });
   ```

### Custom Matchers

The test suite includes custom matchers:

```typescript
expect(id).toBeValidId();
expect(email).toBeValidEmail();
expect(date).toBeValidDate();
expect(actualDate).toBeWithinTimeRange(expectedDate, 1000);
expect(object).toHaveValidStructure(['id', 'name', 'email']);
```

## Test Data Management

### Test Database

- Uses a separate test database (`test_db`)
- Automatically cleaned between tests
- Seeded with minimal required data
- Supports transaction rollback for isolation

### Test Data Generation

- Uses Faker.js for realistic test data
- Provides factory methods for domain objects
- Supports data relationships and constraints
- Includes edge case data scenarios

## Continuous Integration

### GitHub Actions Integration

The test suite is designed to work with CI/CD pipelines:

```yaml
- name: Run Tests
  run: npm run test:ci
  env:
    TEST_DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
    NODE_ENV: test
```

### Coverage Reports

- Generates coverage reports in multiple formats
- Enforces minimum coverage thresholds
- Integrates with code quality tools
- Provides detailed coverage analysis

## Debugging Tests

### Debug Mode

```bash
# Run tests with debug output
DEBUG=true npm test

# Run specific test with debugging
npm test -- --grep "specific test" --verbose
```

### Test Isolation Issues

If tests are interfering with each other:

1. Check database cleanup
2. Verify mock resets
3. Review shared state
4. Use test-specific data

### Performance Issues

If tests are running slowly:

1. Check database queries
2. Review test parallelization
3. Optimize test data setup
4. Use appropriate timeouts

## Maintenance

### Adding New Tests

1. Choose appropriate test category
2. Use existing helpers and patterns
3. Follow naming conventions
4. Include edge cases
5. Update documentation

### Updating Test Configuration

1. Modify `tests/config/test-config.ts`
2. Update environment variables
3. Adjust timeouts and thresholds
4. Test configuration changes

### Test Data Updates

1. Update factory methods
2. Modify seed data
3. Adjust cleanup procedures
4. Verify test isolation

## Troubleshooting

### Common Issues

1. **Database Connection Errors:**
   - Verify TEST_DATABASE_URL
   - Check database server status
   - Ensure test database exists

2. **Test Timeouts:**
   - Increase timeout values
   - Check for hanging promises
   - Review database queries

3. **Mock Issues:**
   - Verify mock setup
   - Check mock reset between tests
   - Review mock implementations

4. **Coverage Issues:**
   - Check excluded files
   - Review test completeness
   - Verify coverage thresholds

### Getting Help

- Check test logs for detailed error messages
- Review test configuration files
- Consult existing test examples
- Use debug mode for detailed output

## Metrics and Reporting

The test suite provides comprehensive metrics:

- **Coverage Reports:** Line, branch, function, and statement coverage
- **Performance Metrics:** Response times, throughput, resource usage
- **Test Results:** Pass/fail rates, test duration, flaky test detection
- **Quality Metrics:** Code complexity, maintainability scores

These metrics help ensure the application meets quality and performance standards while maintaining comprehensive test coverage.
