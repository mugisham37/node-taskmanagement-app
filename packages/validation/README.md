# @taskmanagement/validation

Comprehensive validation package with Zod schemas, guards, decorators, middleware, and business rules for the task management application.

## Features

- **Zod Schemas**: Type-safe validation schemas for all entities
- **Validation Guards**: Domain-level validation guards
- **Decorators**: Method and property validation decorators
- **Middleware**: Request validation middleware for Fastify
- **Sanitizers**: Input sanitization utilities
- **Transformers**: Data transformation utilities
- **Business Rules**: Configurable business validation rules
- **CQRS Validators**: Command and query validation infrastructure

## Installation

```bash
npm install @taskmanagement/validation
```

## Usage

### Zod Schemas

```typescript
import { CreateTaskSchema, TaskQuerySchema } from '@taskmanagement/validation/schemas';

// Validate task creation data
const taskData = CreateTaskSchema.parse({
  title: 'New Task',
  description: 'Task description',
  priority: 'HIGH',
  projectId: 'uuid-here'
});

// Validate query parameters
const query = TaskQuerySchema.parse({
  page: 1,
  limit: 20,
  status: 'TODO'
});
```

### Validation Guards

```typescript
import { guardAgainstEmptyString, guardAgainstInvalidEmail } from '@taskmanagement/validation/guards';

function createUser(email: string, name: string) {
  guardAgainstInvalidEmail(email, 'email');
  guardAgainstEmptyString(name, 'name');
  
  // Create user logic
}
```

### Validation Decorators

```typescript
import { ValidateParams, ValidateEmail, Required } from '@taskmanagement/validation/decorators';

class UserService {
  @ValidateParams()
  async createUser(
    @ValidateEmail email: string,
    @Required name: string
  ) {
    // Method implementation
  }
}
```

### Validation Middleware

```typescript
import { ValidationMiddleware } from '@taskmanagement/validation/middleware';
import { CreateTaskSchema } from '@taskmanagement/validation/schemas';

const validationMiddleware = new ValidationMiddleware();

// Validate request body
app.post('/tasks', {
  preHandler: validationMiddleware.validateBody(CreateTaskSchema)
}, async (request, reply) => {
  // request.body is now validated and typed
});
```

### Business Rules

```typescript
import { BusinessRuleValidator, CommonBusinessRules } from '@taskmanagement/validation/rules';

const validator = new BusinessRuleValidator();

// Add business rules
validator.addRule('task', CommonBusinessRules.notInPast('dueDate'));
validator.addRule('task', CommonBusinessRules.unique('title', checkTitleUnique));

// Validate data
const result = await validator.validate('task', taskData);
if (!result.isValid) {
  console.log('Validation errors:', result.errors);
}
```

### Input Sanitization

```typescript
import { InputSanitizer } from '@taskmanagement/validation/sanitizers';

const cleanHtml = InputSanitizer.sanitizeHtml('<script>alert("xss")</script>Hello');
const cleanEmail = InputSanitizer.sanitizeEmail('  USER@EXAMPLE.COM  ');
const cleanSlug = InputSanitizer.sanitizeSlug('My Blog Post Title!');
```

### Data Transformation

```typescript
import { DataTransformer } from '@taskmanagement/validation/transformers';

const boolean = DataTransformer.toBoolean('true'); // true
const number = DataTransformer.toNumber('42'); // 42
const slug = DataTransformer.toSlug('My Title'); // 'my-title'
const email = DataTransformer.normalizeEmail('USER@Gmail.com'); // 'user@gmail.com'
```

## Validation Constants

The package includes validation constants for all entities:

```typescript
import { 
  TASK_VALIDATION, 
  PROJECT_VALIDATION, 
  USER_VALIDATION, 
  WORKSPACE_VALIDATION 
} from '@taskmanagement/validation';

console.log(TASK_VALIDATION.TITLE_MAX_LENGTH); // 255
console.log(USER_VALIDATION.PASSWORD_MIN_LENGTH); // 8
```

## Error Handling

```typescript
import { ValidationError, ValidationService } from '@taskmanagement/validation';

try {
  ValidationService.validateAndThrow(userData, ValidationService.validateUser);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Validation failed:', error.errors);
  }
}
```

## CQRS Integration

```typescript
import { CommandValidator, QueryValidator } from '@taskmanagement/validation';

const commandValidator = new CommandValidator();
const queryValidator = new QueryValidator();

// Add validation rules
commandValidator.addRule('CreateTaskCommand', myValidationRule);

// Validate commands/queries
const result = await commandValidator.validate(command);
```

## API Reference

### Schemas
- `TaskSchemas`: Task-related validation schemas
- `ProjectSchemas`: Project-related validation schemas  
- `UserSchemas`: User-related validation schemas
- `WorkspaceSchemas`: Workspace-related validation schemas
- `CommonSchemas`: Common validation schemas (pagination, etc.)

### Guards
- `guardAgainstNullOrUndefined`: Null/undefined checks
- `guardAgainstEmptyString`: Empty string validation
- `guardAgainstInvalidEmail`: Email format validation
- `guardAgainstInvalidUuid`: UUID format validation
- And many more...

### Decorators
- `@ValidateParams`: Method parameter validation
- `@ValidateResult`: Method result validation
- `@ValidateEmail`: Email property validation
- `@Required`: Required property validation
- `@ValidateLength`: String length validation
- `@ValidateRange`: Number range validation

### Middleware
- `ValidationMiddleware`: Basic request validation
- `ComprehensiveValidationMiddleware`: Advanced validation with sanitization

### Utilities
- `ValidationUtils`: Validation helper functions
- `ValidationService`: Centralized validation service
- `InputSanitizer`: Input sanitization utilities
- `DataTransformer`: Data transformation utilities

## Contributing

This package is part of the @taskmanagement monorepo. Please follow the established patterns and ensure all validation logic is properly tested.

## License

MIT