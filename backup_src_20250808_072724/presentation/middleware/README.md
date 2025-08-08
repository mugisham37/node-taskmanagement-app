# Middleware Layer Documentation

This directory contains all middleware functions for the task management application. The middleware layer provides essential functionality for authentication, authorization, validation, file uploads, audit logging, rate limiting, and error handling.

## Architecture Overview

The middleware layer is built with a layered approach:

1. **Enhanced Middleware** - Modern, feature-rich implementations
2. **Legacy Middleware** - Backward compatibility support
3. **Composition Utilities** - Tools for combining and configuring middleware
4. **Security Layer** - Comprehensive security features

## Enhanced Middleware Files

### 🔐 Authentication & Authorization

#### `auth.enhanced.ts`
- **Purpose**: Advanced authentication and authorization with JWT support
- **Features**:
  - JWT token validation
  - User role-based access control
  - Optional authentication for public endpoints
  - Session management
  - Token refresh capabilities
- **Usage**:
  ```typescript
  import { authenticate, authorize, optionalAuth } from './middleware';
  
  // Require authentication
  app.use('/api/protected', authenticate());
  
  // Require specific roles
  app.use('/api/admin', authenticate(), authorize(['admin']));
  
  // Optional authentication
  app.use('/api/public', optionalAuth());
  ```

### 📝 Audit Logging

#### `audit-log.enhanced.ts`
- **Purpose**: Comprehensive audit trail for all user actions
- **Features**:
  - Automatic request/response logging
  - User action tracking
  - Sensitive data sanitization
  - Configurable log levels
  - Database integration with Drizzle ORM
- **Usage**:
  ```typescript
  import { auditCreate, auditUpdate, auditDelete } from './middleware';
  
  // Audit CRUD operations
  app.post('/api/tasks', auditCreate('task'), createTask);
  app.put('/api/tasks/:id', auditUpdate('task'), updateTask);
  app.delete('/api/tasks/:id', auditDelete('task'), deleteTask);
  ```

### 🚦 Rate Limiting

#### `rate-limit.enhanced.ts`
- **Purpose**: Advanced rate limiting with Redis support
- **Features**:
  - Multiple rate limit strategies
  - User role-based limits
  - Redis-backed distributed limiting
  - Custom rate limit configurations
  - Endpoint-specific limits
- **Usage**:
  ```typescript
  import { rateLimiter, authLimiter, dynamicRateLimiter } from './middleware';
  
  // General API rate limiting
  app.use('/api', rateLimiter());
  
  // Strict auth endpoint limiting
  app.use('/api/auth', authLimiter());
  
  // Dynamic limits based on user role
  app.use('/api/premium', dynamicRateLimiter);
  ```

### 📁 File Upload

#### `upload.enhanced.ts`
- **Purpose**: Secure file upload handling with validation
- **Features**:
  - Multiple file type support
  - Virus scanning integration
  - File size and type validation
  - Secure filename generation
  - Automatic cleanup on errors
  - Multiple storage destinations
- **Usage**:
  ```typescript
  import { avatarUpload, documentUpload, attachmentUpload } from './middleware';
  
  // Avatar uploads
  app.post('/api/users/avatar', avatarUpload.single('avatar'), uploadAvatar);
  
  // Document uploads
  app.post('/api/documents', documentUpload.array('files', 5), uploadDocuments);
  
  // General attachments
  app.post('/api/attachments', attachmentUpload.array('attachments'), uploadAttachments);
  ```

### ✅ Validation

#### `validate.enhanced.ts`
- **Purpose**: Comprehensive input validation with express-validator
- **Features**:
  - Pre-built validation chains
  - Custom validation functions
  - Sanitization utilities
  - Conditional validation
  - Detailed error reporting
- **Usage**:
  ```typescript
  import { validate, validateEmail, validatePassword, validateId } from './middleware';
  
  // User registration validation
  app.post('/api/auth/register', 
    validate([
      ...validateEmail('email'),
      ...validatePassword('password'),
      ...validateName('firstName'),
      ...validateName('lastName')
    ]),
    registerUser
  );
  
  // ID parameter validation
  app.get('/api/tasks/:id', validate(validateId()), getTask);
  ```

### ❌ Error Handling

#### `error.middleware.ts`
- **Purpose**: Centralized error handling and response formatting
- **Features**:
  - Structured error responses
  - Environment-aware error details
  - Automatic error logging
  - HTTP status code mapping
  - Stack trace handling
- **Usage**:
  ```typescript
  import { errorHandler, notFoundHandler } from './middleware';
  
  // Apply error handlers at the end of middleware stack
  app.use(notFoundHandler);
  app.use(errorHandler);
  ```

## Middleware Composition

### Utility Functions

The middleware layer includes powerful composition utilities:

```typescript
import { 
  composeMiddleware, 
  conditionalMiddleware, 
  onlyForPaths, 
  onlyForRoles 
} from './middleware';

// Compose multiple middleware
const authStack = composeMiddleware(
  authenticate(),
  authorize(['user', 'admin']),
  auditApiAccess()
);

// Conditional middleware
const adminOnly = conditionalMiddleware(
  (req) => req.user?.role === 'admin',
  auditConfigChange()
);

// Path-specific middleware
const apiMiddleware = onlyForPaths(['/api'], rateLimiter());

// Role-specific middleware
const adminMiddleware = onlyForRoles(['admin'], auditConfigChange());
```

## Security Features

### Built-in Security Middleware

```typescript
import { securityHeaders, cors, timeout } from './middleware';

// Security headers
app.use(securityHeaders());

// CORS configuration
app.use(cors({
  origins: ['https://yourdomain.com'],
  credentials: true
}));

// Request timeout
app.use(timeout(30000)); // 30 seconds
```

## Configuration

### Environment Variables

The middleware layer respects these environment variables:

```env
# Authentication
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=7d

# Rate Limiting
REDIS_URL=redis://localhost:6379
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Audit Logging
ENABLE_AUDIT_LOG=true

# File Uploads
MAX_FILE_SIZE=50MB
UPLOAD_PATH=./uploads

# Security
CORS_ORIGIN=*
ENABLE_SECURITY_HEADERS=true
```

## Best Practices

### 1. Middleware Order

Apply middleware in the correct order:

```typescript
// 1. Security and CORS
app.use(securityHeaders());
app.use(cors());

// 2. Request processing
app.use(requestId());
app.use(responseTime());

// 3. Rate limiting
app.use(rateLimiter());

// 4. Authentication (where needed)
app.use('/api/protected', authenticate());

// 5. Validation (route-specific)
app.post('/api/users', validate(userValidation), createUser);

// 6. Business logic routes
app.use('/api', routes);

// 7. Error handling (last)
app.use(notFoundHandler);
app.use(errorHandler);
```

### 2. Error Handling

Always use the async handler for async middleware:

```typescript
import { asyncHandler } from './middleware';

const myAsyncMiddleware = asyncHandler(async (req, res, next) => {
  // Async operations here
  const result = await someAsyncOperation();
  req.result = result;
  next();
});
```

### 3. Validation Patterns

Use consistent validation patterns:

```typescript
// Route-level validation
app.post('/api/tasks', 
  validate([
    ...validateTextContent('title', 1, 200),
    ...validateTextContent('description', 0, 1000, false),
    ...validatePriority('priority', false),
    ...validateDate('dueDate', false)
  ]),
  createTask
);
```

### 4. Audit Logging

Apply audit logging strategically:

```typescript
// High-value operations
app.post('/api/users', auditCreate('user'), createUser);
app.put('/api/users/:id/role', auditPermissionChange(), updateUserRole);
app.delete('/api/projects/:id', auditDelete('project'), deleteProject);

// Bulk operations
app.post('/api/tasks/bulk', auditBulkOperation('task'), bulkCreateTasks);

// Security events
app.post('/api/auth/login', auditLogin(), login);
app.post('/api/auth/logout', auditLogout(), logout);
```

## Performance Considerations

### 1. Rate Limiting

- Use Redis for distributed rate limiting in production
- Configure appropriate limits based on user roles
- Monitor rate limit metrics

### 2. File Uploads

- Implement virus scanning for production
- Use streaming for large files
- Clean up temporary files promptly

### 3. Audit Logging

- Use async logging to avoid blocking requests
- Implement log rotation and archival
- Consider sampling for high-volume endpoints

## Testing

### Unit Testing

```typescript
import { authenticate, validate } from '../middleware';
import { mockRequest, mockResponse } from 'jest-mock-req-res';

describe('Authentication Middleware', () => {
  it('should authenticate valid JWT token', async () => {
    const req = mockRequest({
      headers: { authorization: 'Bearer valid-token' }
    });
    const res = mockResponse();
    const next = jest.fn();

    await authenticate()(req, res, next);

    expect(req.user).toBeDefined();
    expect(next).toHaveBeenCalled();
  });
});
```

### Integration Testing

```typescript
import request from 'supertest';
import app from '../app';

describe('Middleware Integration', () => {
  it('should apply rate limiting', async () => {
    // Make multiple requests to trigger rate limit
    for (let i = 0; i < 101; i++) {
      await request(app).get('/api/test');
    }

    const response = await request(app).get('/api/test');
    expect(response.status).toBe(429);
  });
});
```

## Monitoring and Observability

### Metrics to Track

1. **Authentication**:
   - Login success/failure rates
   - Token validation errors
   - Session duration

2. **Rate Limiting**:
   - Rate limit hits by endpoint
   - User-specific rate limit violations
   - Rate limit effectiveness

3. **File Uploads**:
   - Upload success/failure rates
   - File size distributions
   - Virus detection events

4. **Validation**:
   - Validation error rates by field
   - Most common validation failures
   - Input sanitization events

5. **Audit Logging**:
   - Audit log volume
   - Critical security events
   - Compliance reporting metrics

## Troubleshooting

### Common Issues

1. **JWT Token Issues**:
   - Check JWT_SECRET configuration
   - Verify token expiration settings
   - Ensure proper token format

2. **Rate Limiting Problems**:
   - Verify Redis connection
   - Check rate limit configuration
   - Monitor memory usage

3. **File Upload Failures**:
   - Check file size limits
   - Verify upload directory permissions
   - Review file type restrictions

4. **Validation Errors**:
   - Review validation chain order
   - Check custom validation logic
   - Verify input sanitization

## Migration Guide

### From Legacy to Enhanced Middleware

1. **Update Imports**:
   ```typescript
   // Old
   import { authenticate } from './middleware/auth';
   
   // New
   import { authenticate } from './middleware';
   ```

2. **Update Configuration**:
   ```typescript
   // Old
   app.use(authenticate);
   
   // New
   app.use(authenticate());
   ```

3. **Update Error Handling**:
   ```typescript
   // Old
   app.use(errorHandler);
   
   // New
   app.use(errorHandler);
   app.use(notFoundHandler);
   ```

## Contributing

When adding new middleware:

1. Follow the established patterns
2. Include comprehensive JSDoc comments
3. Add unit tests
4. Update this documentation
5. Consider backward compatibility
6. Implement proper error handling
7. Add appropriate logging

## Security Considerations

1. **Input Validation**: Always validate and sanitize user input
2. **Authentication**: Use secure JWT practices
3. **File Uploads**: Implement virus scanning and file type validation
4. **Rate Limiting**: Protect against abuse and DoS attacks
5. **Audit Logging**: Log security-relevant events
6. **Error Handling**: Don't leak sensitive information in errors
7. **CORS**: Configure appropriate CORS policies
8. **Headers**: Set security headers consistently

This middleware layer provides a robust foundation for building secure, scalable, and maintainable applications.
