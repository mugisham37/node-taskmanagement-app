import { ApiError, NetworkError, TimeoutError } from '@/services/api'
import { useCallback } from 'react'
import { toast } from 'react-hot-toast'

// Error types
export type ErrorType = 'api' | 'network' | 'timeout' | 'validation' | 'unknown'

// Error handler options
interface ErrorHandlerOptions {
  showToast?: boolean
  logError?: boolean
  customMessage?: string
  onError?: (error: Error, type: ErrorType) => void
}

// Default error messages
const defaultErrorMessages: Record<ErrorType, string> = {
  api: 'An error occurred while processing your request',
  network: 'Network connection error. Please check your internet connection',
  timeout: 'Request timed out. Please try again',
  validation: 'Please check your input and try again',
  unknown: 'An unexpected error occurred',
}

// Error classification
function classifyError(error: Error): ErrorType {
  if (error instanceof ApiError) {
    return 'api'
  }
  if (error instanceof NetworkError) {
    return 'network'
  }
  if (error instanceof TimeoutError) {
    return 'timeout'
  }
  if (error.name === 'ValidationError' || error.message.includes('validation')) {
    return 'validation'
  }
  return 'unknown'
}

// Get user-friendly error message
function getErrorMessage(error: Error, type: ErrorType, customMessage?: string): string {
  if (customMessage) {
    return customMessage
  }

  // API errors might have specific messages
  if (error instanceof ApiError && error.data?.message) {
    return error.data.message
  }

  // Use default message for error type
  return defaultErrorMessages[type]
}

// Error recovery suggestions
function getRecoverySuggestion(type: ErrorType): string | null {
  switch (type) {
    case 'network':
      return 'Please check your internet connection and try again'
    case 'timeout':
      return 'The request took too long. Please try again'
    case 'api':
      return 'Please try again or contact support if the problem persists'
    case 'validation':
      return 'Please check your input and correct any errors'
    default:
      return null
  }
}

// Error handler hook
export function useErrorHandler(defaultOptions: ErrorHandlerOptions = {}) {
  const handleError = useCallback((
    error: Error,
    options: ErrorHandlerOptions = {}
  ) => {
    const mergedOptions = { ...defaultOptions, ...options }
    const {
      showToast = true,
      logError = true,
      customMessage,
      onError,
    } = mergedOptions

    const errorType = classifyError(error)
    const message = getErrorMessage(error, errorType, customMessage)
    const suggestion = getRecoverySuggestion(errorType)

    // Log error if enabled
    if (logError) {
      console.error(`[${errorType.toUpperCase()}] ${error.message}`, {
        error,
        type: errorType,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      })
    }

    // Show toast notification if enabled
    if (showToast) {
      const toastMessage = suggestion ? `${message}\n${suggestion}` : message
      
      switch (errorType) {
        case 'network':
        case 'timeout':
          toast.error(toastMessage, {
            duration: 6000,
            icon: '🌐',
          })
          break
        case 'validation':
          toast.error(toastMessage, {
            duration: 4000,
            icon: '⚠️',
          })
          break
        case 'api':
          if (error instanceof ApiError && error.status >= 500) {
            toast.error(toastMessage, {
              duration: 6000,
              icon: '🚨',
            })
          } else {
            toast.error(toastMessage, {
              duration: 4000,
            })
          }
          break
        default:
          toast.error(toastMessage)
      }
    }

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorType)
    }

    return {
      type: errorType,
      message,
      suggestion,
      originalError: error,
    }
  }, [defaultOptions])

  return { handleError }
}

// Async operation wrapper with error handling
export function useAsyncErrorHandler(defaultOptions: ErrorHandlerOptions = {}) {
  const { handleError } = useErrorHandler(defaultOptions)

  const executeWithErrorHandling = useCallback(async <T>(
    asyncOperation: () => Promise<T>,
    options?: ErrorHandlerOptions
  ): Promise<T | null> => {
    try {
      return await asyncOperation()
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)), options)
      return null
    }
  }, [handleError])

  return {
    executeWithErrorHandling,
    handleError,
  }
}

// Error boundary hook for React components
export function useErrorBoundary() {
  const { handleError } = useErrorHandler({
    showToast: false, // Error boundaries should handle UI differently
    logError: true,
  })

  const captureError = useCallback((error: Error, errorInfo?: any) => {
    handleError(error, {
      onError: (err, type) => {
        // Send to error reporting service
        if (typeof window !== 'undefined' && window.Sentry) {
          window.Sentry.captureException(err, {
            extra: errorInfo,
            tags: { errorType: type },
          })
        }
      },
    })
  }, [handleError])

  return { captureError }
}

// Global error handler for unhandled errors
export function setupGlobalErrorHandling() {
  if (typeof window === 'undefined') return

  const { handleError } = useErrorHandler({
    showToast: true,
    logError: true,
  })

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    handleError(
      event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      { customMessage: 'An unexpected error occurred' }
    )
  })

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    handleError(event.error || new Error(event.message), {
      customMessage: 'An unexpected error occurred',
    })
  })
}

// Error retry utility
export function useRetryableError() {
  const { executeWithErrorHandling } = useAsyncErrorHandler()

  const executeWithRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<T | null> => {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (attempt === maxRetries) {
          break
        }

        // Don't retry on certain error types
        const errorType = classifyError(lastError)
        if (errorType === 'validation' || 
            (lastError instanceof ApiError && lastError.status >= 400 && lastError.status < 500)) {
          break
        }

        // Wait before retry with exponential backoff
        const delay = retryDelay * Math.pow(2, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // Handle the final error
    if (lastError) {
      return executeWithErrorHandling(() => Promise.reject(lastError))
    }

    return null
  }, [executeWithErrorHandling])

  return { executeWithRetry }
}