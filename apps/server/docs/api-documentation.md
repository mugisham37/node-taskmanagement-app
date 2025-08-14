# Task Management System API Documentation

## Overview

This document provides comprehensive documentation for the Task Management System REST API. The API follows RESTful principles and uses JSON for data exchange.

## Base URL

```
Production: https://api.taskmanagement.com
Staging: https://staging-api.taskmanagement.com
Development: http://localhost:3000
```

## Authentication

The API uses JWT (JSON Web Token) based authentication. Include the access token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## Rate Limiting

API requests are rate limited to prevent abuse:
- **Authenticated users**: 1000 requests per hour
- **Unauthenticated users**: 100 requests per hour

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when the rate limit resets

## Error Handling

The API uses standard HTTP status codes and returns error details in JSON format:

```json
{
  "error": "ValidationError",
  "message": "Invalid input data",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ],
  "timestamp": "2024-01-15T12:00:00Z",
  "requestId": "req_123456"
}
```

### Common Status Codes

- **200 OK**: Request successful
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request data
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

## Pagination

List endpoints support pagination using query parameters:

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

Paginated responses include metadata:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

## Endpoints

### Authentication

#### POST /api/auth/register

Register a new user account

**Authentication Required**: No

**Request Body** (application/json):

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}
```

**Responses**:

**201** - User registered successfully

```json
{
  "id": "user_123",
  "email": "user@example.com",
  "name": "John Doe",
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

**400** - Validation error

```json
{
  "error": "ValidationError",
  "message": "Invalid input data",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

---

#### POST /api/auth/login

Authenticate user and receive access tokens

**Authentication Required**: No

**Request Body** (application/json):

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Responses**:

**200** - Login successful

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

**401** - Invalid credentials

```json
{
  "error": "AuthenticationError",
  "message": "Invalid email or password"
}
```

---

### Tasks

#### GET /api/tasks

Retrieve tasks with optional filtering and pagination

**Authentication Required**: Yes

**Required Permissions**: read:tasks

**Parameters**:

| Name | Type | Required | Location | Description |
|------|------|----------|----------|-------------|
| projectId | string | No | query | Filter tasks by project ID |
| status | string | No | query | Filter tasks by status (TODO, IN_PROGRESS, COMPLETED, etc.) |
| assigneeId | string | No | query | Filter tasks by assignee ID |
| page | number | No | query | Page number for pagination (default: 1) |
| limit | number | No | query | Number of items per page (default: 20, max: 100) |

**Responses**:

**200** - Tasks retrieved successfully

```json
{
  "data": [
    {
      "id": "task_123",
      "title": "Implement user authentication",
      "description": "Add JWT-based authentication system",
      "status": "IN_PROGRESS",
      "priority": "HIGH",
      "assigneeId": "user_456",
      "projectId": "project_789",
      "dueDate": "2024-02-01T00:00:00Z",
      "createdAt": "2024-01-15T00:00:00Z",
      "updatedAt": "2024-01-16T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

#### POST /api/tasks

Create a new task

**Authentication Required**: Yes

**Required Permissions**: create:tasks

**Request Body** (application/json):

```json
{
  "title": "Implement user authentication",
  "description": "Add JWT-based authentication system with proper security measures",
  "priority": "HIGH",
  "assigneeId": "user_456",
  "projectId": "project_789",
  "dueDate": "2024-02-01T00:00:00Z",
  "estimatedHours": 8
}
```

**Responses**:

**201** - Task created successfully

```json
{
  "id": "task_123",
  "title": "Implement user authentication",
  "description": "Add JWT-based authentication system with proper security measures",
  "status": "TODO",
  "priority": "HIGH",
  "assigneeId": "user_456",
  "projectId": "project_789",
  "createdById": "user_789",
  "dueDate": "2024-02-01T00:00:00Z",
  "estimatedHours": 8,
  "createdAt": "2024-01-15T00:00:00Z",
  "updatedAt": "2024-01-15T00:00:00Z"
}
```

---

### Projects

#### GET /api/projects

Retrieve projects accessible to the authenticated user

**Authentication Required**: Yes

**Required Permissions**: read:projects

**Parameters**:

| Name | Type | Required | Location | Description |
|------|------|----------|----------|-------------|
| workspaceId | string | No | query | Filter projects by workspace ID |
| status | string | No | query | Filter projects by status |

**Responses**:

**200** - Projects retrieved successfully

```json
{
  "data": [
    {
      "id": "project_123",
      "name": "Task Management System",
      "description": "A comprehensive task management platform",
      "status": "ACTIVE",
      "workspaceId": "workspace_456",
      "managerId": "user_789",
      "memberCount": 5,
      "taskCount": 23,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

#### POST /api/projects

Create a new project

**Authentication Required**: Yes

**Required Permissions**: create:projects

**Request Body** (application/json):

```json
{
  "name": "Task Management System",
  "description": "A comprehensive task management platform",
  "workspaceId": "workspace_456",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-06-01T00:00:00Z"
}
```

**Responses**:

**201** - Project created successfully

---

### Workspaces

#### GET /api/workspaces

Retrieve workspaces accessible to the authenticated user

**Authentication Required**: Yes

**Required Permissions**: read:workspaces

**Responses**:

**200** - Workspaces retrieved successfully

```json
{
  "data": [
    {
      "id": "workspace_123",
      "name": "Acme Corporation",
      "description": "Main workspace for Acme Corp projects",
      "ownerId": "user_456",
      "memberCount": 15,
      "projectCount": 8,
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

### Health Checks

#### GET /health

Basic health check endpoint

**Authentication Required**: No

**Responses**:

**200** - Service is healthy

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T12:00:00Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

---

#### GET /health/database

Database connectivity health check

**Authentication Required**: No

**Responses**:

**200** - Database is healthy

```json
{
  "status": "healthy",
  "database": "connected",
  "responseTime": 15
}
```

---


## WebSocket API

The system supports real-time updates via WebSocket connections.

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onopen = () => {
  // Send authentication
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your_jwt_token'
  }));
};
```

### Events

#### Task Updates
```json
{
  "type": "task_updated",
  "data": {
    "taskId": "task_123",
    "changes": {
      "status": "COMPLETED"
    },
    "updatedBy": "user_456",
    "timestamp": "2024-01-15T12:00:00Z"
  }
}
```

#### User Presence
```json
{
  "type": "user_presence",
  "data": {
    "userId": "user_123",
    "status": "online",
    "lastSeen": "2024-01-15T12:00:00Z"
  }
}
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import { TaskManagementAPI } from '@taskmanagement/sdk';

const api = new TaskManagementAPI({
  baseUrl: 'https://api.taskmanagement.com',
  apiKey: 'your_api_key'
});

// Create a task
const task = await api.tasks.create({
  title: 'New Task',
  description: 'Task description',
  projectId: 'project_123',
  priority: 'HIGH'
});

// Get tasks with filtering
const tasks = await api.tasks.list({
  projectId: 'project_123',
  status: 'IN_PROGRESS',
  page: 1,
  limit: 20
});
```

### cURL Examples

```bash
# Login
curl -X POST https://api.taskmanagement.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Create a task
curl -X POST https://api.taskmanagement.com/api/tasks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Task",
    "description": "Task description",
    "projectId": "project_123",
    "priority": "HIGH"
  }'

# Get tasks
curl -X GET "https://api.taskmanagement.com/api/tasks?projectId=project_123&status=IN_PROGRESS" \
  -H "Authorization: Bearer <token>"
```

## Changelog

### Version 1.0.0 (2024-01-15)
- Initial API release
- Authentication and authorization
- Task management endpoints
- Project management endpoints
- Workspace management endpoints
- Real-time WebSocket support
- Comprehensive error handling
- Rate limiting and security measures

---

For support or questions, please contact: api-support@taskmanagement.com
