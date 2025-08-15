import { ComponentType, lazy, LazyExoticComponent } from 'react';

// Dynamic import utilities
export class BundleOptimizer {
  private static loadedChunks = new Set<string>();
  private static preloadedChunks = new Set<string>();

  // Lazy loading with error boundaries
  static lazyWithRetry<T extends ComponentType<any>>(
    importFn: () => Promise<{ default: T }>,
    chunkName?: string
  ): LazyExoticComponent<T> {
    return lazy(async () => {
      try {
        const module = await importFn();
        if (chunkName) {
          this.loadedChunks.add(chunkName);
        }
        return module;
      } catch (error) {
        console.error('Chunk loading failed:', error);
        // Retry once after a delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        return importFn();
      }
    });
  }

  // Preload chunks based on user interaction
  static async preloadChunk(importFn: () => Promise<any>, chunkName: string): Promise<void> {
    if (this.preloadedChunks.has(chunkName)) {
      return;
    }

    try {
      await importFn();
      this.preloadedChunks.add(chunkName);
      console.log(`Preloaded chunk: ${chunkName}`);
    } catch (error) {
      console.warn(`Failed to preload chunk ${chunkName}:`, error);
    }
  }

  // Intelligent preloading based on route patterns
  static async preloadRouteChunks(currentRoute: string): Promise<void> {
    const preloadMap: Record<string, () => Promise<any>> = {
      '/dashboard': () => import('../components/features/dashboard'),
      '/tasks': () => import('../components/features/tasks'),
      '/projects': () => import('../components/features/projects'),
      '/settings': () => import('../components/features/settings'),
    };

    // Preload likely next routes
    const likelyRoutes = this.getLikelyNextRoutes(currentRoute);
    
    for (const route of likelyRoutes) {
      if (preloadMap[route]) {
        this.preloadChunk(preloadMap[route], route);
      }
    }
  }

  private static getLikelyNextRoutes(currentRoute: string): string[] {
    const routePatterns: Record<string, string[]> = {
      '/dashboard': ['/tasks', '/projects'],
      '/tasks': ['/projects', '/dashboard'],
      '/projects': ['/tasks', '/dashboard'],
      '/login': ['/dashboard'],
      '/register': ['/dashboard'],
    };

    return routePatterns[currentRoute] || [];
  }

  // Bundle analysis utilities
  static getBundleStats() {
    return {
      loadedChunks: Array.from(this.loadedChunks),
      preloadedChunks: Array.from(this.preloadedChunks),
      totalChunks: this.loadedChunks.size + this.preloadedChunks.size,
    };
  }
}

// Progressive loading utilities
export class ProgressiveLoader {
  private static imageCache = new Map<string, HTMLImageElement>();
  private static observer?: IntersectionObserver;

  // Progressive image loading
  static setupImageObserver(): void {
    if (this.observer || typeof window === 'undefined') return;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;
            
            if (src && !img.src) {
              this.loadImage(src).then((loadedImg) => {
                img.src = loadedImg.src;
                img.classList.remove('loading');
                img.classList.add('loaded');
              });
            }
          }
        });
      },
      { rootMargin: '50px' }
    );
  }

  static async loadImage(src: string): Promise<HTMLImageElement> {
    if (this.imageCache.has(src)) {
      return this.imageCache.get(src)!;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.imageCache.set(src, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  static observeImage(img: HTMLImageElement): void {
    if (this.observer) {
      this.observer.observe(img);
    }
  }

  // Progressive content loading
  static async loadContentProgressively<T>(
    items: T[],
    batchSize: number = 10,
    delay: number = 100
  ): Promise<T[][]> {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      batches.push(batch);
      
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return batches;
  }
}

// Service Worker integration for caching
export class ServiceWorkerManager {
  private static registration: ServiceWorkerRegistration | null = null;

  static async register(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', this.registration);
        
        this.setupUpdateListener();
        this.setupMessageListener();
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  private static setupUpdateListener(): void {
    if (!this.registration) return;

    this.registration.addEventListener('updatefound', () => {
      const newWorker = this.registration!.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            this.notifyUpdate();
          }
        });
      }
    });
  }

  private static setupMessageListener(): void {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, payload } = event.data;
      
      switch (type) {
        case 'CACHE_UPDATED':
          console.log('Cache updated:', payload);
          break;
        case 'OFFLINE_READY':
          console.log('App ready for offline use');
          break;
        default:
          console.log('SW message:', event.data);
      }
    });
  }

  private static notifyUpdate(): void {
    // This would trigger a UI notification for app update
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('App Update Available', {
        body: 'A new version is available. Refresh to update.',
        icon: '/icon-192x192.png',
      });
    }
  }

  static async skipWaiting(): Promise<void> {
    if (this.registration?.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  static async updateCache(): Promise<void> {
    if (this.registration?.active) {
      this.registration.active.postMessage({ type: 'UPDATE_CACHE' });
    }
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private static metrics: Record<string, number[]> = {};

  static startTiming(label: string): () => void {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      this.recordMetric(label, duration);
    };
  }

  static recordMetric(label: string, value: number): void {
    if (!this.metrics[label]) {
      this.metrics[label] = [];
    }
    
    this.metrics[label].push(value);
    
    // Keep only last 100 measurements
    if (this.metrics[label].length > 100) {
      this.metrics[label] = this.metrics[label].slice(-100);
    }
  }

  static getMetrics(): Record<string, {
    count: number;
    average: number;
    min: number;
    max: number;
    p95: number;
  }> {
    const result: Record<string, any> = {};
    
    for (const [label, values] of Object.entries(this.metrics)) {
      const sorted = [...values].sort((a, b) => a - b);
      const count = values.length;
      const sum = values.reduce((a, b) => a + b, 0);
      
      result[label] = {
        count,
        average: sum / count,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p95: sorted[Math.floor(sorted.length * 0.95)],
      };
    }
    
    return result;
  }

  static reportWebVitals(): void {
    // Report Core Web Vitals
    if ('web-vitals' in window) {
      // This would use the web-vitals library
      console.log('Web Vitals reporting enabled');
    }
  }
}

// Resource hints and preloading
export class ResourceOptimizer {
  static preloadCriticalResources(): void {
    const criticalResources = [
      { href: '/fonts/inter-var.woff2', as: 'font', type: 'font/woff2' },
      { href: '/api/trpc', as: 'fetch' },
    ];

    criticalResources.forEach(({ href, as, type }) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = href;
      link.as = as;
      if (type) link.type = type;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
  }

  static prefetchNextPageResources(nextRoute: string): void {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = nextRoute;
    document.head.appendChild(link);
  }

  static preconnectToOrigins(): void {
    const origins = [
      process.env.NEXT_PUBLIC_API_URL,
      process.env.NEXT_PUBLIC_CDN_URL,
    ].filter(Boolean);

    origins.forEach((origin) => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = origin!;
      document.head.appendChild(link);
    });
  }
}

// Initialize optimizations
export function initializeOptimizations(): void {
  // Setup progressive loading
  ProgressiveLoader.setupImageObserver();
  
  // Register service worker
  ServiceWorkerManager.register();
  
  // Preload critical resources
  ResourceOptimizer.preloadCriticalResources();
  ResourceOptimizer.preconnectToOrigins();
  
  // Start performance monitoring
  PerformanceMonitor.reportWebVitals();
  
  console.log('Bundle optimizations initialized');
}