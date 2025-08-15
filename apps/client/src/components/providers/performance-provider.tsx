"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createCacheManager, CacheManager } from '@taskmanagement/shared/cache';
import { ClientCacheIntegration } from '@/lib/cache-integration';
import { 
  initializeOptimizations, 
  BundleOptimizer, 
  PerformanceMonitor,
  ServiceWorkerManager 
} from '@/lib/bundle-optimization';

interface PerformanceContextType {
  cacheManager: CacheManager | null;
  cacheIntegration: ClientCacheIntegration | null;
  isOnline: boolean;
  performanceMetrics: Record<string, any>;
  bundleStats: any;
}

const PerformanceContext = createContext<PerformanceContextType>({
  cacheManager: null,
  cacheIntegration: null,
  isOnline: true,
  performanceMetrics: {},
  bundleStats: {},
});

export const usePerformance = () => {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformance must be used within PerformanceProvider');
  }
  return context;
};

interface PerformanceProviderProps {
  children: React.ReactNode;
}

export function PerformanceProvider({ children }: PerformanceProviderProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
        retry: 3,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        // Enable background refetching for active queries
        refetchInterval: (data, query) => {
          return query.state.isError ? false : 5 * 60 * 1000;
        },
      },
      mutations: {
        retry: 1,
      },
    },
  }));

  const [cacheManager, setCacheManager] = useState<CacheManager | null>(null);
  const [cacheIntegration, setCacheIntegration] = useState<ClientCacheIntegration | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [performanceMetrics, setPerformanceMetrics] = useState({});
  const [bundleStats, setBundleStats] = useState({});

  useEffect(() => {
    // Initialize cache manager
    const manager = createCacheManager({
      redis: process.env.NEXT_PUBLIC_REDIS_URL ? {
        url: process.env.NEXT_PUBLIC_REDIS_URL,
      } : undefined,
      memory: {
        memoryMaxSize: 1000,
        memoryTTL: 5 * 60 * 1000, // 5 minutes
        redisTTL: 30 * 60, // 30 minutes
        enableCompression: true,
        enableMetrics: true,
      },
      defaultTTL: 300, // 5 minutes
      keyPrefix: 'taskmanagement',
    });

    setCacheManager(manager);

    // Initialize cache integration
    const integration = new ClientCacheIntegration({
      queryClient,
      cacheManager: manager,
      enablePersistence: true,
      enableBackground: true,
    });

    setCacheIntegration(integration);

    // Initialize optimizations
    initializeOptimizations();

    // Setup online/offline detection
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Setup performance monitoring
    const metricsInterval = setInterval(() => {
      setPerformanceMetrics(PerformanceMonitor.getMetrics());
      setBundleStats(BundleOptimizer.getBundleStats());
    }, 30000); // Update every 30 seconds

    // Preload critical resources based on route
    const currentPath = window.location.pathname;
    BundleOptimizer.preloadRouteChunks(currentPath);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(metricsInterval);
    };
  }, [queryClient]);

  // Route-based preloading
  useEffect(() => {
    const handleRouteChange = () => {
      const currentPath = window.location.pathname;
      BundleOptimizer.preloadRouteChunks(currentPath);
    };

    // Listen for route changes (Next.js specific)
    window.addEventListener('popstate', handleRouteChange);
    
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  // Performance monitoring
  useEffect(() => {
    // Monitor Core Web Vitals
    if (typeof window !== 'undefined' && 'web-vitals' in window) {
      PerformanceMonitor.reportWebVitals();
    }

    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'longtask') {
            PerformanceMonitor.recordMetric('longTask', entry.duration);
          }
        }
      });

      try {
        observer.observe({ entryTypes: ['longtask'] });
      } catch (error) {
        console.warn('Long task monitoring not supported:', error);
      }

      return () => observer.disconnect();
    }
  }, []);

  // Cache warming on user authentication
  useEffect(() => {
    const warmCacheForUser = async () => {
      const userId = localStorage.getItem('user-id');
      if (userId && cacheIntegration) {
        await cacheIntegration.warmUserCache(userId);
      }
    };

    warmCacheForUser();
  }, [cacheIntegration]);

  const contextValue: PerformanceContextType = {
    cacheManager,
    cacheIntegration,
    isOnline,
    performanceMetrics,
    bundleStats,
  };

  return (
    <PerformanceContext.Provider value={contextValue}></PerformanceContext.Provider>   <QueryClientProvider client={queryClient}>
        {children}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </QueryClientProvider>
    </PerformanceContext.Provider>
  );
}

// Performance monitoring hooks
export function usePerformanceMetrics() {
  const { performanceMetrics } = usePerformance();
  return performanceMetrics;
}

export function useBundleStats() {
  const { bundleStats } = usePerformance();
  return bundleStats;
}

export function useOnlineStatus() {
  const { isOnline } = usePerformance();
  return isOnline;
}

// Cache management hooks
export function useCacheManager() {
  const { cacheManager } = usePerformance();
  return cacheManager;
}

export function useCacheIntegration() {
  const { cacheIntegration } = usePerformance();
  return cacheIntegration;
}

// Performance timing hook
export function usePerformanceTiming(label: string) {
  useEffect(() => {
    const endTiming = PerformanceMonitor.startTiming(label);
    return endTiming;
  }, [label]);
}

// Preloading hook
export function usePreloadRoute(route: string, condition: boolean = true) {
  useEffect(() => {
    if (condition) {
      BundleOptimizer.preloadRouteChunks(route);
    }
  }, [route, condition]);
}

// Service worker hook
export function useServiceWorker() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(setRegistration);

      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'UPDATE_AVAILABLE') {
          setUpdateAvailable(true);
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);
      
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, []);

  const updateApp = async () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  return {
    registration,
    updateAvailable,
    updateApp,
  };
}