# Advanced Error Handling and Resilience System

This directory contains a comprehensive error handling and resilience system that provides robust error management, automatic recovery mechanisms, and excellent user experience even when things go wrong.

## Features Implemented

### 1. Unified Error Handling System ✅

- **Shared Error Classes**: Comprehensive error hierarchy with domain-specific errors
- **Error Normalization**: Converts any error type to standardized `AppError` format
- **Error Severity Classification**: Automatic severity determination (Critical, High, Medium, Low)
- **Error Context**: Rich context information for debugging and monitoring
- **Error Fingerprinting**: Deduplication of similar errors

### 2. React Error Boundaries ✅

- **Hierarchical Error Boundaries**: Page, section, and component level boundaries
- **Graceful Degradation**: Different fallback UIs based on error severity
- **Auto-Recovery**: Automatic reset for non-critical errors
- **User Actions**: Retry, go back, go home, and report issue options

### 3. Circuit Breaker Pattern ✅

- **Service Protection**: Prevents cascading failures
- **Automatic Recovery**: Tests service health and reopens circuit
- **Configurable Thresholds**: Customizable failure thresholds and timeouts
- **Multiple Services**: Independent circuit breakers per service
- **Real-time Monitoring**: Live stats and health status

### 4. Retry Mechanisms ✅

- **Exponential Backoff**: Intelligent retry delays with jitter
- **Configurable Policies**: Per-operation retry configuration
- **Retryable Error Detection**: Automatic identification of retryable errors
- **Operation Tracking**: Statistics and success rates per operation
- **Circuit Integration**: Works seamlessly with circuit breakers

### 5. Offline Support ✅

- **Queue Management**: Priority-based offline operation queue
- **Background Sync**: Service worker integration for background processing
- **Automatic Recovery**: Processes queue when connection restored
- **Storage Management**: Persistent queue with cleanup policies
- **Operation Handlers**: Pluggable handlers for different operation types

### 6. Error Reporting ✅

- **Monitoring Integration**: Ready for Sentry, LogRocket, etc.
- **Breadcrumb Collection**: Automatic user action tracking
- **Context Enrichment**: User, session, and environment data
- **Sampling**: Configurable error reporting rates
- **Deduplication**: Prevents spam from repeated errors

### 7. User Experience ✅

- **Toast Notifications**: Contextual error messages
- **Recovery Actions**: Clear next steps for users
- **Offline Indicators**: Visual feedback for connection status
- **Progress Feedback**: Loading states and retry progress
- **Error Dashboard**: Admin view of system health

## Architecture

```
Error Handling System
├── Shared Package
│   ├── Error Classes (base, domain, client)
│   ├── Error Utilities (normalization, severity, etc.)
│   └── Type Definitions
├── Client Components
│   ├── Error Boundaries (page, section, component)
│   ├── Error Fallbacks (specialized UI components)
│   ├── Error Dashboard (monitoring interface)
│   └── Error Provider (React context)
├── Core Services
│   ├── ClientErrorHandler (main error processor)
│   ├── CircuitBreakerManager (service protection)
│   ├── RetryManager (retry logic)
│   ├── OfflineManager (queue management)
│   └── ErrorReportingService (monitoring)
├── Integrations
│   ├── tRPC Error Handler (API error handling)
│   ├── Service Worker (background sync)
│   └── React Query (cache error handling)
└── Hooks & Utilities
    ├── useErrorHandling (component integration)
    ├── useAsyncOperation (loading + error states)
    └── Error Test Component (testing interface)
```

## Usage Examples

### Basic Error Handling

```tsx
import { useErrorHandling } from '@/hooks/use-error-handling';

function MyComponent() {
  const { handleError, executeWithErrorHandling } = useErrorHandling();

  const handleSubmit = async (data) => {
    await executeWithErrorHandling(
      () => api.createTask(data),
      'create_task',
      {
        onSuccess: (task) => console.log('Task created:', task),
        showSuccessToast: true,
        successMessage: 'Task created successfully!',
      }
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form content */}
    </form>
  );
}
```

### Error Boundaries

```tsx
import { ErrorBoundary } from '@/components/error';

function App() {
  return (
    <ErrorBoundary level="page">
      <Header />
      <ErrorBoundary level="section">
        <MainContent />
      </ErrorBoundary>
      <Footer />
    </ErrorBoundary>
  );
}
```

### Circuit Breaker

```tsx
import { useCircuitBreaker } from '@/components/providers/error-provider';

function DataFetcher() {
  const { execute } = useCircuitBreaker();

  const fetchData = () => {
    return execute('api-service', () => 
      fetch('/api/data').then(r => r.json())
    );
  };

  return <button onClick={fetchData}>Fetch Data</button>;
}
```

### Offline Support

```tsx
import { useOfflineSupport } from '@/lib/offline-support';

function TaskForm() {
  const { queueOfflineTask, isOffline } = useOfflineSupport();

  const createTask = (taskData) => {
    if (isOffline) {
      queueOfflineTask(taskData.id, 'create', taskData, 'high');
      toast.info('Task queued for sync when online');
    } else {
      // Normal API call
    }
  };

  return (
    <div>
      {isOffline && <OfflineBanner />}
      <TaskFormFields onSubmit={createTask} />
    </div>
  );
}
```

## Configuration

### Error Provider Setup

```tsx
// In your app root
import { ErrorProvider } from '@/components/providers/error-provider';

function App() {
  return (
    <ErrorProvider
      maxErrors={50}
      enableGlobalErrorHandling={true}
    >
      <YourApp />
    </ErrorProvider>
  );
}
```

### Circuit Breaker Configuration

```tsx
import { circuitBreakerManager } from '@/lib/circuit-breaker';

// Configure circuit breaker for specific service
const breaker = circuitBreakerManager.getBreaker('payment-service', {
  failureThreshold: 3,
  recoveryTimeout: 30000,
  monitoringPeriod: 60000,
});
```

### Error Reporting Configuration

```tsx
import { errorReportingService } from '@/lib/error-reporting';

// Set user context
errorReportingService.setUser('user-123', { 
  email: 'user@example.com',
  plan: 'premium' 
});

// Add custom breadcrumb
errorReportingService.addBreadcrumb(
  'User clicked export button',
  'user',
  'info',
  { feature: 'data-export' }
);
```

## Testing

The system includes a comprehensive test component (`ErrorTestComponent`) that demonstrates:

- Different error types and severities
- Retry mechanisms with exponential backoff
- Circuit breaker behavior
- Error reporting and breadcrumb collection
- User-friendly error messages
- Global error handling

## Monitoring

The error dashboard provides real-time visibility into:

- Error counts by severity
- Circuit breaker status
- Retry statistics
- Recent errors with details
- System health overview

## Best Practices

1. **Use Error Boundaries**: Wrap components at appropriate levels
2. **Provide Context**: Include relevant information with errors
3. **Handle Offline**: Queue operations when offline
4. **Show Progress**: Indicate retry attempts to users
5. **Monitor Health**: Use circuit breakers for external services
6. **Test Failures**: Use the test component to verify behavior
7. **Report Errors**: Configure monitoring for production

## Integration Points

- **tRPC**: Automatic error handling for API calls
- **React Query**: Retry and cache error handling
- **Service Worker**: Background sync for offline operations
- **Toast System**: User notifications
- **Monitoring**: Ready for Sentry, LogRocket, etc.

This system provides enterprise-grade error handling and resilience, ensuring your application remains functional and user-friendly even when things go wrong.