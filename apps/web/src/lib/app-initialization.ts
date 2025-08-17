import { appConfig } from '@/config/app'
import { initializeApiIntegration } from './api-integration'

// App initialization configuration
interface AppInitConfig {
  enableMSW?: boolean
  enableAnalytics?: boolean
  enableErrorReporting?: boolean
  enablePerformanceMonitoring?: boolean
}

// Initialize the application
export async function initializeApp(config: AppInitConfig = {}) {
  const {
    enableMSW = appConfig.isDevelopment,
    enableAnalytics = appConfig.features.analytics,
    enableErrorReporting = appConfig.features.errorReporting,
    enablePerformanceMonitoring = appConfig.isProduction,
  } = config

  console.log('🚀 Initializing Task Management App...')

  try {
    // Initialize API integration
    await initializeApiIntegration({
      enableMSW,
      enableCaching: appConfig.features.offline,
      enableBatching: true,
      enableOffline: appConfig.features.offline,
      enableRealTime: appConfig.features.realtime,
      enableErrorHandling: true,
    })

    // Initialize error reporting
    if (enableErrorReporting && appConfig.services.sentry.dsn) {
      await initializeSentry()
    }

    // Initialize analytics
    if (enableAnalytics && appConfig.services.analytics.id) {
      await initializeAnalytics()
    }

    // Initialize performance monitoring
    if (enablePerformanceMonitoring) {
      initializePerformanceMonitoring()
    }

    // Setup theme
    initializeTheme()

    console.log('✅ App initialization completed successfully')
  } catch (error) {
    console.error('❌ App initialization failed:', error)
    throw error
  }
}

// Initialize Sentry for error reporting
async function initializeSentry() {
  try {
    const Sentry = await import('@sentry/nextjs')
    
    Sentry.init({
      dsn: appConfig.services.sentry.dsn,
      environment: appConfig.services.sentry.environment,
      tracesSampleRate: appConfig.services.sentry.tracesSampleRate,
      beforeSend(event) {
        // Filter out development errors
        if (appConfig.isDevelopment) {
          return null
        }
        return event
      },
      integrations: [
        new Sentry.BrowserTracing({
          tracingOrigins: [appConfig.appUrl, appConfig.apiUrl],
        }),
      ],
    })

    console.log('✅ Sentry initialized')
  } catch (error) {
    console.warn('⚠️ Sentry initialization failed:', error)
  }
}

// Initialize analytics
async function initializeAnalytics() {
  try {
    // Google Analytics 4
    if (appConfig.services.analytics.id) {
      const { gtag } = await import('gtag')
      
      gtag('config', appConfig.services.analytics.id, {
        page_title: appConfig.name,
        page_location: window.location.href,
      })

      console.log('✅ Analytics initialized')
    }
  } catch (error) {
    console.warn('⚠️ Analytics initialization failed:', error)
  }
}

// Initialize performance monitoring
function initializePerformanceMonitoring() {
  if (typeof window === 'undefined') return

  try {
    // Web Vitals monitoring
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(console.log)
      getFID(console.log)
      getFCP(console.log)
      getLCP(console.log)
      getTTFB(console.log)
    })

    // Performance observer for long tasks
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > 50) {
            console.warn('Long task detected:', entry)
          }
        })
      })

      observer.observe({ entryTypes: ['longtask'] })
    }

    console.log('✅ Performance monitoring initialized')
  } catch (error) {
    console.warn('⚠️ Performance monitoring initialization failed:', error)
  }
}

// Initialize theme
function initializeTheme() {
  if (typeof window === 'undefined') return

  try {
    const savedTheme = localStorage.getItem(appConfig.theme.storageKey)
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const theme = savedTheme || (prefersDark ? 'dark' : 'light')

    document.documentElement.classList.toggle('dark', theme === 'dark')
    
    console.log('✅ Theme initialized:', theme)
  } catch (error) {
    console.warn('⚠️ Theme initialization failed:', error)
  }
}

// App health check
export async function performHealthCheck() {
  const checks = {
    api: false,
    websocket: false,
    localStorage: false,
    indexedDB: false,
  }

  try {
    // API health check
    const { api } = await import('./api-integration')
    await api.health()
    checks.api = true
  } catch (error) {
    console.warn('API health check failed:', error)
  }

  try {
    // WebSocket health check
    const { webSocketService } = await import('@/services/websocket')
    checks.websocket = webSocketService.isConnected
  } catch (error) {
    console.warn('WebSocket health check failed:', error)
  }

  try {
    // localStorage check
    localStorage.setItem('health-check', 'test')
    localStorage.removeItem('health-check')
    checks.localStorage = true
  } catch (error) {
    console.warn('localStorage health check failed:', error)
  }

  try {
    // IndexedDB check (for future use)
    if ('indexedDB' in window) {
      checks.indexedDB = true
    }
  } catch (error) {
    console.warn('IndexedDB health check failed:', error)
  }

  return checks
}

// Cleanup function for app shutdown
export function cleanupApp() {
  try {
    const { webSocketService } = require('@/services/websocket')
    const { cacheUtils } = require('@/services/response-cache')

    // Disconnect WebSocket
    webSocketService.disconnect()

    // Clear caches if needed
    if (appConfig.isDevelopment) {
      cacheUtils.clear()
    }

    console.log('✅ App cleanup completed')
  } catch (error) {
    console.warn('⚠️ App cleanup failed:', error)
  }
}

// Export configuration
export { appConfig }
export type { AppInitConfig }
