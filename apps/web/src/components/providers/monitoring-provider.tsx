'use client';

import { webMonitoring, WebMonitoringService } from '@/lib/monitoring';
import { useRouter } from 'next/router';
import React, { createContext, ReactNode, useContext, useEffect } from 'react';

interface MonitoringContextType {
  monitoring: WebMonitoringService;
  trackUserInteraction: (type: string, action: string, metadata?: Record<string, any>) => void;
  trackApiCall: (method: string, endpoint: string, duration: number, statusCode: number, requestSize?: number, responseSize?: number) => void;
  trackError: (error: Error, context?: Record<string, any>) => void;
  trackBusinessEvent: (eventType: string, workspaceId: string, userId?: string, metadata?: Record<string, any>) => void;
  setUserContext: (userId: string, workspaceId?: string, userRole?: string) => void;
  clearUserContext: () => void;
}

const MonitoringContext = createContext<MonitoringContextType | null>(null);

interface MonitoringProviderProps {
  children: ReactNode;
}

export function MonitoringProvider({ children }: MonitoringProviderProps) {
  const router = useRouter();

  useEffect(() => {
    // Track route changes
    const handleRouteChange = (url: string) => {
      webMonitoring.trackUserInteraction('navigation', 'route_change', {
        from: router.asPath,
        to: url,
        timestamp: new Date().toISOString(),
      });
    };

    const handleRouteChangeStart = (url: string) => {
      webMonitoring.getLogger().debug('Route change started', {
        from: router.asPath,
        to: url,
      });
    };

    const handleRouteChangeComplete = (url: string) => {
      webMonitoring.getLogger().debug('Route change completed', {
        url,
        timestamp: new Date().toISOString(),
      });
    };

    const handleRouteChangeError = (err: Error, url: string) => {
      webMonitoring.trackError(err, {
        type: 'route_change_error',
        url,
        from: router.asPath,
      });
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);
    router.events.on('routeChangeComplete', handleRouteChangeComplete);
    router.events.on('routeChangeError', handleRouteChangeError);

    // Cleanup
    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
      router.events.off('routeChangeError', handleRouteChangeError);
    };
  }, [router]);

  const contextValue: MonitoringContextType = {
    monitoring: webMonitoring,
    trackUserInteraction: webMonitoring.trackUserInteraction.bind(webMonitoring),
    trackApiCall: webMonitoring.trackApiCall.bind(webMonitoring),
    trackError: webMonitoring.trackError.bind(webMonitoring),
    trackBusinessEvent: webMonitoring.trackBusinessEvent.bind(webMonitoring),
    setUserContext: webMonitoring.setUserContext.bind(webMonitoring),
    clearUserContext: webMonitoring.clearUserContext.bind(webMonitoring),
  };

  return (
    <MonitoringContext.Provider value={contextValue}>
      {children}
    </MonitoringContext.Provider>
  );
}

export function useMonitoring(): MonitoringContextType {
  const context = useContext(MonitoringContext);
  if (!context) {
    throw new Error('useMonitoring must be used within a MonitoringProvider');
  }
  return context;
}

// Higher-order component for automatic error boundary monitoring
export function withMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  const WrappedComponent = (props: P) => {
    const { trackError } = useMonitoring();

    useEffect(() => {
      // Track component mount
      webMonitoring.trackUserInteraction('component', 'mount', {
        componentName: componentName || Component.displayName || Component.name,
      });

      return () => {
        // Track component unmount
        webMonitoring.trackUserInteraction('component', 'unmount', {
          componentName: componentName || Component.displayName || Component.name,
        });
      };
    }, []);

    return (
      <ErrorBoundary
        onError={(error, errorInfo) => {
          trackError(error, {
            type: 'component_error',
            componentName: componentName || Component.displayName || Component.name,
            errorInfo,
          });
        }}
      >
        <Component {...props} />
      </ErrorBoundary>
    );
  };

  WrappedComponent.displayName = `withMonitoring(${componentName || Component.displayName || Component.name})`;
  return WrappedComponent;
}

// Error boundary component
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg
                  className="h-8 w-8 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-gray-800">
                  Something went wrong
                </h3>
                <div className="mt-2 text-sm text-gray-500">
                  <p>An unexpected error occurred. Please try refreshing the page.</p>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    className="bg-red-100 px-2 py-1 text-sm font-medium text-red-800 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    onClick={this.resetError}
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };
