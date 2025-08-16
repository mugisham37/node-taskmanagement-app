# @taskmanagement/auth

Comprehensive authentication and authorization package for the task management system. This package provides secure, scalable, and feature-rich authentication services including JWT tokens, password management, two-factor authentication, role-based access control, OAuth integration, and more.

## Features

### 🔐 JWT Token Management
- Access and refresh token generation
- Token verification and validation
- Password reset and email verification tokens
- Configurable expiration times and security settings

### 🛡️ Password Security
- Argon2 password hashing
- Password strength validation
- Secure password generation
- Common password detection
- Configurable password policies

### 👥 Session Management
- Redis-backed session storage
- Session validation and rotation
- Concurrent session limiting
- Device tracking and fingerprinting

### 🔢 Two-Factor Authentication (2FA)
- TOTP (Time-based One-Time Password) support
- SMS and email verification
- Backup codes generation
- QR code generation for authenticator apps

### 🎭 Role-Based Access Control (RBAC)
- Hierarchical role system
- Fine-grained permissions
- Resource-level access control
- Multi-tenant support

### 🌐 OAuth Integration
- Support for multiple providers (Google, GitHub, Microsoft)
- PKCE (Proof Key for Code Exchange) support
- OpenID Connect compatibility
- Token refresh and revocation

### 🚦 Rate Limiting
- Configurable rate limits per endpoint
- User-specific and IP-based limiting
- Built-in protection for common endpoints
- Redis-backed storage for distributed systems

### 🧹 Input Sanitization
- XSS prevention
- SQL injection protection
- HTML sanitization with configurable policies
- File path and email sanitization

### 📊 Audit Logging
- Comprehensive security event logging
- Authentication and authorization tracking
- Suspicious activity detection
- Configurable severity levels

## Installation

```bash
npm install @taskmanagement/auth
```

## Quick Start

### JWT Service

```typescript
import { JWTService } from '@taskmanagement/auth';

const jwtService = new JWTService({
  accessTokenSecret: 'your-access-secret',
  refreshTokenSecret: 'your-refresh-secret',
  accessTokenExpiresIn: '15m',
  refreshTokenExpiresIn: '7d',
  issuer: 'your-app',
  audience: 'your-users'
});

// Generate token pair
const tokenPair = jwtService.generateTokenPair({
  userId: 'user-123',
  email: 'user@example.com',
  roles: ['user'],
  permissions: ['read:tasks'],
  sessionId: 'session-123'
});

// Verify access token
const payload = jwtService.verifyAccessToken(tokenPair.accessToken);
```

### Password Service

```typescript
import { PasswordService } from '@taskmanagement/auth';

const passwordService = new PasswordService({
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  hashingOptions: {
    type: 2, // Argon2id
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    hashLength: 32
  }
});

// Hash password
const hash = await passwordService.hashPassword('MySecurePassword123!');

// Verify password
const isValid = await passwordService.verify('MySecurePassword123!', hash);

// Check password strength
const strength = passwordService.checkPasswordStrength('MySecurePassword123!');
```

### Authentication Middleware

```typescript
import { AuthMiddleware } from '@taskmanagement/auth';
import { FastifyInstance } from 'fastify';

const authMiddleware = new AuthMiddleware({
  jwtService,
  rateLimitService,
  skipPaths: ['/health', '/auth/login'],
  optionalPaths: ['/public/*']
});

// Apply authentication middleware
fastify.addHook('preHandler', authMiddleware.authenticate());

// Require specific permissions
fastify.addHook('preHandler', authMiddleware.authorize({
  resource: 'tasks',
  action: 'create',
  requiredRoles: ['user'],
  requiredPermissions: ['tasks:create']
}));
```

### Two-Factor Authentication

```typescript
import { TwoFactorAuthService } from '@taskmanagement/auth';

const twoFactorService = new TwoFactorAuthService(
  logger,
  cacheService,
  emailService,
  {
    issuer: 'Your App',
    serviceName: 'Your App'
  }
);

// Generate 2FA setup
const setup = await twoFactorService.generateSetup('user-123', 'user@example.com');

// Enable 2FA
const result = await twoFactorService.enableTwoFactor('user-123', '123456');

// Verify 2FA token
const verification = await twoFactorService.verifyToken('user-123', '123456');
```

### RBAC Service

```typescript
import { RBACService } from '@taskmanagement/auth';

const rbacService = new RBACService(logger, cacheService);

// Check access
const accessResult = await rbacService.checkAccess({
  userId: 'user-123',
  resource: 'tasks',
  action: 'create',
  workspaceId: 'workspace-456'
});

// Assign role
await rbacService.assignRole('user-123', 'project-manager', 'admin-456');

// Create custom role
const role = await rbacService.createRole(
  'custom-role',
  'Custom Role Description',
  ['tasks:read', 'tasks:create'],
  ['team-member']
);
```

## Configuration

### Environment Variables

```bash
# JWT Configuration
JWT_ACCESS_SECRET=your-very-long-and-secure-access-token-secret
JWT_REFRESH_SECRET=your-very-long-and-secure-refresh-token-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=your-app-name
JWT_AUDIENCE=your-app-users

# Session Configuration
SESSION_DURATION=86400000
MAX_SESSIONS_PER_USER=5
ENABLE_SESSION_ROTATION=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# 2FA Configuration
TWO_FACTOR_ISSUER=Your App Name
TWO_FACTOR_SERVICE_NAME=Your App
```

## API Reference

### Core Services

- **JWTService**: JWT token generation and verification
- **PasswordService**: Password hashing and validation
- **SessionManager**: Session lifecycle management
- **TwoFactorAuthService**: Two-factor authentication
- **RBACService**: Role-based access control
- **OAuthService**: OAuth provider integration
- **RateLimitService**: Request rate limiting
- **InputSanitizer**: Input validation and sanitization
- **AuditLogger**: Security event logging

### Middleware

- **AuthMiddleware**: Authentication and authorization middleware
- **ComprehensiveSecurityMiddleware**: Complete security stack

### Types

All services export comprehensive TypeScript types for configuration, requests, responses, and data models.

## Security Best Practices

1. **Use strong secrets**: Ensure JWT secrets are at least 32 characters long
2. **Configure HTTPS**: Always use HTTPS in production
3. **Set appropriate timeouts**: Configure reasonable token expiration times
4. **Enable rate limiting**: Protect against brute force attacks
5. **Use 2FA**: Enable two-factor authentication for sensitive accounts
6. **Monitor audit logs**: Regularly review security events
7. **Keep dependencies updated**: Regularly update security-related packages

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details.