# Presence and Activity Tracking - Task 4.4 Implementation

This document describes the implementation of enhanced presence and activity tracking features for the unified enterprise platform, completing task 4.4 of the real-time collaboration and WebSocket integration.

## Overview

The presence and activity tracking system provides comprehensive real-time awareness of user activities across workspaces, projects, and tasks. It enables teams to see who is online, what they're working on, and facilitates better collaboration through activity indicators and typing notifications.

## Features Implemented

### 1. Enhanced Presence Tracking

#### User Presence Status

- **Online**: User is actively using the application
- **Away**: User is idle or has been inactive
- **Busy**: User has set themselves as busy
- **Offline**: User is not connected

#### Location Context

Users' presence now includes location context:

- Current workspace
- Current project
- Current task being viewed/edited

#### Custom Status Messages

Users can set custom status messages with:

- Text message (up to 100 characters)
- Optional emoji
- Optional expiry time

### 2. Activity Indicators

#### Real-time Activity Types

- **Viewing**: User is currently viewing a resource
- **Editing**: User is actively editing a resource
- **Commenting**: User is adding comments to a resource

#### Activity Tracking

- Shows who is currently viewing or editing tasks
- Displays activity start time and last update
- Provides comprehensive activity summaries per resource

### 3. Typing Indicators

#### Real-time Typing Notifications

- Shows when users are typing in tasks or comments
- Automatically expires after 2 minutes of inactivity
- Broadcasts typing status to relevant team members

### 4. Activity History

#### User Activity Tracking

- Maintains history of user activities
- Tracks editing sessions, task views, and interactions
- Provides activity feed for workspaces

#### Activity Feed

- Real-time activity feed for workspaces
- Shows recent team member activities
- Includes task creation, editing, and completion events

## API Endpoints

### Presence Management

#### Update Presence Status

```http
PUT /api/v1/presence/status
Content-Type: application/json

{
  "status": "online|away|busy|offline",
  "workspaceId": "uuid" // optional
}
```

#### Update Location Context

```http
PUT /api/v1/presence/location
Content-Type: application/json

{
  "workspaceId": "uuid",
  "projectId": "uuid",
  "taskId": "uuid"
}
```

#### Set Custom Status

```http
PUT /api/v1/presence/status/custom
Content-Type: application/json

{
  "message": "In a meeting",
  "emoji": "📅",
  "expiresAt": "2024-01-01T15:00:00Z" // optional
}
```

#### Clear Custom Status

```http
DELETE /api/v1/presence/status/custom
```

### Activity Tracking

#### Update Activity

```http
PUT /api/v1/presence/activity
Content-Type: application/json

{
  "type": "viewing|editing|commenting",
  "resourceType": "task|project|workspace",
  "resourceId": "uuid",
  "resourceTitle": "Task Title" // optional
}
```

#### Clear Activity

```http
DELETE /api/v1/presence/activity
Content-Type: application/json

{
  "resourceId": "uuid" // optional
}
```

#### Get Resource Activity Summary

```http
GET /api/v1/presence/activity/resource?resourceId=uuid
```

Response:

```json
{
  "success": true,
  "data": {
    "resourceId": "uuid",
    "viewers": [
      {
        "userId": "uuid",
        "userName": "John Doe",
        "userAvatar": "url",
        "activity": {
          "type": "viewing",
          "startedAt": "2024-01-01T10:00:00Z",
          "lastUpdate": "2024-01-01T10:05:00Z"
        }
      }
    ],
    "editors": [...],
    "commenters": [...],
    "typing": [...],
    "totalActiveUsers": 3
  }
}
```

### Typing Indicators

#### Start Typing

```http
POST /api/v1/presence/typing/start
Content-Type: application/json

{
  "resourceType": "task|comment",
  "resourceId": "uuid"
}
```

#### Stop Typing

```http
POST /api/v1/presence/typing/stop
Content-Type: application/json

{
  "resourceId": "uuid"
}
```

### Query Endpoints

#### Get Presence Information

```http
GET /api/v1/presence?userIds[]=uuid1&userIds[]=uuid2
GET /api/v1/presence?workspaceId=uuid
```

#### Get Activity History

```http
GET /api/v1/presence/activity/history?userId=uuid&limit=50
```

#### Get Activity Feed

```http
GET /api/v1/presence/feed?workspaceId=uuid&limit=50&offset=0
```

#### Get Enhanced Statistics

```http
GET /api/v1/presence/stats
```

## WebSocket Events

### Real-time Events

#### Presence Updates

```javascript
socket.on('presence:update', data => {
  console.log('User presence updated:', data);
  // {
  //   userId: 'uuid',
  //   status: 'online',
  //   userName: 'John Doe',
  //   userAvatar: 'url',
  //   workspaceId: 'uuid',
  //   location: { workspaceId, projectId, taskId },
  //   customStatus: { message, emoji, expiresAt },
  //   timestamp: '2024-01-01T10:00:00Z'
  // }
});
```

#### Activity Updates

```javascript
socket.on('activity:update', data => {
  console.log('User activity updated:', data);
  // {
  //   resourceId: 'uuid',
  //   userId: 'uuid',
  //   userName: 'John Doe',
  //   activity: {
  //     type: 'editing',
  //     resourceType: 'task',
  //     resourceId: 'uuid',
  //     startedAt: '2024-01-01T10:00:00Z'
  //   }
  // }
});
```

#### Typing Indicators

```javascript
socket.on('typing:start', data => {
  console.log('User started typing:', data);
  // {
  //   userId: 'uuid',
  //   userName: 'John Doe',
  //   resourceType: 'task',
  //   resourceId: 'uuid',
  //   timestamp: '2024-01-01T10:00:00Z'
  // }
});

socket.on('typing:stop', data => {
  console.log('User stopped typing:', data);
  // {
  //   userId: 'uuid',
  //   resourceId: 'uuid',
  //   timestamp: '2024-01-01T10:00:00Z'
  // }
});
```

### Client-side Events

#### Update Presence

```javascript
socket.emit('presence:update', {
  status: 'online',
  workspaceId: 'uuid',
});
```

#### Update Activity

```javascript
socket.emit('activity:start', {
  type: 'editing',
  resourceType: 'task',
  resourceId: 'uuid',
  resourceTitle: 'Task Title',
});

socket.emit('activity:stop', {
  resourceId: 'uuid',
});
```

#### Typing Indicators

```javascript
socket.emit('typing:start', {
  resourceType: 'task',
  resourceId: 'uuid',
});

socket.emit('typing:stop', {
  resourceId: 'uuid',
});
```

#### Query Data

```javascript
socket.emit('presence:get', {
  workspaceId: 'uuid',
});

socket.emit('activity:get', {
  resourceId: 'uuid',
});

socket.emit('feed:get', {
  workspaceId: 'uuid',
  limit: 50,
});
```

## Implementation Details

### Service Architecture

#### PresenceService

- Manages in-memory presence data with cleanup intervals
- Tracks user locations, custom statuses, and activity history
- Provides comprehensive activity summaries and statistics
- Handles automatic cleanup of stale data

#### WebSocketService Integration

- Broadcasts presence and activity updates in real-time
- Manages WebSocket connections with workspace context
- Handles typing indicators and activity notifications
- Provides connection statistics and monitoring

### Data Structures

#### PresenceInfo

```typescript
interface PresenceInfo {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: Date;
  currentActivity?: {
    type: 'viewing' | 'editing' | 'commenting';
    resourceType: 'task' | 'project' | 'workspace';
    resourceId: string;
    resourceTitle?: string;
    startedAt: Date;
  };
  workspaceId?: string;
  projectId?: string;
  location?: {
    workspaceId?: string;
    projectId?: string;
    taskId?: string;
  };
  customStatus?: {
    message: string;
    emoji?: string;
    expiresAt?: Date;
  };
  deviceInfo?: {
    type: 'desktop' | 'mobile' | 'tablet';
    browser?: string;
    os?: string;
  };
}
```

#### ActivityIndicator

```typescript
interface ActivityIndicator {
  userId: string;
  userName: string;
  userAvatar?: string;
  activity: {
    type: 'viewing' | 'editing' | 'commenting' | 'typing';
    resourceType: 'task' | 'project' | 'workspace' | 'comment';
    resourceId: string;
    resourceTitle?: string;
    startedAt: Date;
    lastUpdate: Date;
  };
  presence: {
    status: 'online' | 'away' | 'busy' | 'offline';
    lastSeen: Date;
  };
}
```

### Performance Optimizations

#### Memory Management

- Automatic cleanup of stale presence data (30 minutes)
- Automatic cleanup of typing indicators (2 minutes)
- Limited activity history per user (100 items)
- Limited activity feed per workspace (1000 items)

#### Caching Strategy

- In-memory storage for real-time data
- Efficient data structures for quick lookups
- Batch processing for WebSocket broadcasts

#### Monitoring

- Comprehensive metrics collection
- Performance tracking for all operations
- Error monitoring and alerting

## Security Considerations

### Authentication

- All endpoints require valid JWT authentication
- WebSocket connections are authenticated on connection
- User context is validated for all operations

### Authorization

- Users can only update their own presence and activity
- Workspace-level access control for viewing others' presence
- Admin-only access for system statistics

### Data Privacy

- Activity data is automatically cleaned up
- Custom statuses can have expiry times
- No persistent storage of sensitive activity data

## Testing

### Unit Tests

- Comprehensive test coverage for PresenceService
- Mock-based testing for isolated functionality
- Activity tracking and cleanup verification

### Integration Tests

- API endpoint testing with authentication
- WebSocket event testing
- Error handling verification

### Performance Tests

- Load testing for concurrent users
- Memory usage monitoring
- WebSocket connection scaling

## Monitoring and Metrics

### Key Metrics

- Active user count by status
- Activity indicators count
- Typing indicators count
- Custom statuses count
- WebSocket connection statistics

### Health Checks

- Service availability monitoring
- Memory usage tracking
- Cleanup interval verification
- WebSocket connection health

## Future Enhancements

### Planned Features

- Persistent activity history in database
- Advanced activity analytics
- Team productivity insights
- Integration with calendar systems
- Mobile push notifications for presence changes

### Scalability Improvements

- Redis-based presence storage for multi-instance deployments
- Message queue integration for reliable event delivery
- Database persistence for long-term activity analytics
- Horizontal scaling support for WebSocket connections

## Conclusion

The presence and activity tracking implementation provides a comprehensive foundation for real-time collaboration awareness. It enables teams to work more effectively by providing visibility into who is online, what they're working on, and facilitating seamless communication through typing indicators and activity feeds.

The system is designed for performance, scalability, and security, with comprehensive monitoring and testing to ensure reliable operation in production environments.
