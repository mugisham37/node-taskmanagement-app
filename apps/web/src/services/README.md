# Web Application API Integration

This directory contains the complete API integration implementation for the Task Management web application, providing comprehensive client-side API communication, real-time features, offline support, and performance optimizations.

## 🚀 Features

### Core API Client (`api.ts`)
- **HTTP Client**: Full-featured HTTP client with interceptors
- **Request/Response Transformation**: Automatic JSON handling
- **Error Handling**: Comprehensive error classification and recovery
- **Retry Logic**: Exponential backoff with configurable retries
- **Authentication**: Automatic token management and refresh
- **File Upload/Download**: Support for file operations
- **Timeout Management**: Configurable request timeouts

### WebSocket Service (`websocket.ts`)
- **Real-time Communication**: Bidirectional WebSocket connection
- **Auto-reconnection**: Intelligent reconnection with exponential backoff
- **Heartbeat**: Connection health monitoring
- **Message Queuing**: Queue messages when disconnected
- **Event System**: Type-safe event handling
- **Connection State Management**: Track connection status

### Request Batching (`request-batcher.ts`)
- **Automatic Batching**: Group similar requests for efficiency
- **Bulk Operations**: Optimize GET requests with bulk fetching
- **Queue Management**: Smart request queuing and processing
- **Performance Optimization**: Reduce network overhead

### Response Caching (`response-cache.ts`)
- **Intelligent Caching**: LRU cache with TTL support
- **Cache Invalidation**: Pattern-based and tag-based invalidation
- **Memory Management**: Automatic cleanup and size limits
- **Cache Statistics**: Monitor cache performance
- **Offline Support**: Serve cached responses when offline

## 🔧 Configuration

### Environment Variables
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_ENABLE_MSW=true
```

### App Configuration
```typescript
// config/app.ts
export const appConfig = {
  api: {
    timeout: 30000,
    retries: 3,
    retryDelay: 1000,
  },
  cache: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  },
  features: {
    offline: true,
    realtime: true,
    analytics: true,
  },
}
```

## 📚 Usage Examples

### Basic API Usage
```typescript
import { api } from '@/lib/api-integration'

// Fetch tasks
const tasks = await api.tasks.list({ status: 'active' })

// Create task
const newTask = await api.tasks.create({
  title: 'New Task',
  description: 'Task description',
  priority: 'high'
})

// Update task
await api.tasks.update(taskId, { status: 'completed' })
```

### Real-time Features
```typescript
import { useRealTimeUpdates } from '@/hooks/useRealTimeFeatures'

function TaskList() {
  const { subscribe, isConnected } = useRealTimeUpdates()

  useEffect(() => {
    const unsubscribe = subscribe('task.updated', (task) => {
      // Handle real-time task updates
      console.log('Task updated:', task)
    })

    return unsubscribe
  }, [subscribe])

  return (
    <div>
      Status: {isConnected ? 'Connected' : 'Disconnected'}
      {/* Task list UI */}
    </div>
  )
}
```

### Offline Support
```typescript
import { useOfflineSupport } from '@/hooks/useOfflineSupport'

function TaskForm() {
  const { isOnline, addToQueue } = useOfflineSupport()

  const handleSubmit = async (data) => {
    if (isOnline) {
      await api.tasks.create(data)
    } else {
      // Queue for when connection is restored
      addToQueue('/tasks', 'POST', data)
      toast.info('Task queued for sync when online')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form UI */}
    </form>
  )
}
```

### Request Batching
```typescript
import { requestBatcher } from '@/services/request-batcher'

// Batch multiple requests
const [task1, task2, task3] = await Promise.all([
  requestBatcher.addRequest('/tasks/1', 'GET'),
  requestBatcher.addRequest('/tasks/2', 'GET'),
  requestBatcher.addRequest('/tasks/3', 'GET'),
])
```

### Cache Management
```typescript
import { cacheUtils } from '@/services/response-cache'

// Invalidate cache when data changes
await api.tasks.update(taskId, data)
cacheUtils.invalidateResource('tasks', taskId)

// Warm cache with data
cacheUtils.warmCache('tasks-list', tasksData)

// Get cache statistics
const stats = cacheUtils.getStats()
console.log('Cache hit rate:', stats.hitRate)
```

## 🎯 Performance Optimizations

### Request Optimization
- **Batching**: Automatic request batching for efficiency
- **Caching**: Intelligent response caching with TTL
- **Compression**: Automatic request/response compression
- **Debouncing**: Debounced search and filter requests

### Network Optimization
- **Connection Pooling**: Reuse HTTP connections
- **Request Deduplication**: Prevent duplicate requests
- **Offline Queuing**: Queue requests when offline
- **Background Sync**: Sync data in background

### Memory Optimization
- **LRU Cache**: Least Recently Used cache eviction
- **Memory Monitoring**: Track memory usage
- **Cleanup**: Automatic cleanup of expired data
- **Lazy Loading**: Load data on demand

## 🔒 Security Features

### Authentication
- **JWT Tokens**: Secure token-based authentication
- **Token Refresh**: Automatic token refresh
- **Secure Storage**: Secure token storage
- **Session Management**: Handle session expiration

### Request Security
- **HTTPS Only**: Force HTTPS in production
- **CSRF Protection**: Cross-site request forgery protection
- **Input Validation**: Client-side input validation
- **Rate Limiting**: Respect API rate limits

## 🧪 Testing & Mocking

### Mock Service Worker (MSW)
```typescript
// Automatic API mocking in development
import { startMSW } from '@/lib/msw'

if (process.env.NODE_ENV === 'development') {
  await startMSW()
}
```

### Test Utilities
```typescript
import { api } from '@/lib/api-integration'
import { server } from '@/mocks/server'

// Setup MSW for testing
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

test('should fetch tasks', async () => {
  const tasks = await api.tasks.list()
  expect(tasks).toBeDefined()
})
```

## 📊 Monitoring & Analytics

### Performance Monitoring
- **Request Timing**: Track API request performance
- **Error Rates**: Monitor error rates and types
- **Cache Performance**: Track cache hit/miss rates
- **Network Quality**: Monitor connection quality

### Error Tracking
- **Error Classification**: Categorize errors by type
- **Error Recovery**: Automatic error recovery strategies
- **User Feedback**: Provide helpful error messages
- **Error Reporting**: Send errors to monitoring service

## 🔧 Troubleshooting

### Common Issues

1. **Connection Errors**
   - Check network connectivity
   - Verify API endpoint URLs
   - Check CORS configuration

2. **Authentication Issues**
   - Verify token validity
   - Check token refresh logic
   - Ensure proper logout handling

3. **Performance Issues**
   - Monitor cache hit rates
   - Check request batching
   - Optimize query patterns

4. **Real-time Issues**
   - Verify WebSocket connection
   - Check event subscriptions
   - Monitor connection stability

### Debug Mode
```typescript
// Enable debug logging
localStorage.setItem('debug', 'api:*')

// Check connection status
console.log('API Status:', api.health())
console.log('WebSocket Status:', webSocketService.isConnected)
console.log('Cache Stats:', cacheUtils.getStats())
```

## 🚀 Future Enhancements

- **GraphQL Support**: Add GraphQL client integration
- **Service Workers**: Enhanced offline capabilities
- **Push Notifications**: Real-time push notifications
- **Background Sync**: Advanced background synchronization
- **Edge Caching**: CDN and edge caching integration
- **Streaming**: Server-sent events and streaming support

## 📖 API Documentation

For detailed API documentation, see:
- [API Client Reference](./api.ts)
- [WebSocket Service Reference](./websocket.ts)
- [Caching Guide](./response-cache.ts)
- [Real-time Features Guide](../hooks/useRealTimeFeatures.ts)
- [Offline Support Guide](../hooks/useOfflineSupport.ts)