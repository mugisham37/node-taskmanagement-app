import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDebounce } from 'use-debounce'

// Performance monitoring hook
export function usePerformanceMonitor(name: string) {
  const startTime = useRef<number>()
  const measurements = useRef<number[]>([])

  const start = useCallback(() => {
    startTime.current = performance.now()
  }, [])

  const end = useCallback(() => {
    if (startTime.current) {
      const duration = performance.now() - startTime.current
      measurements.current.push(duration)
      
      // Keep only last 100 measurements
      if (measurements.current.length > 100) {
        measurements.current = measurements.current.slice(-100)
      }

      // Log performance in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`)
      }

      return duration
    }
    return 0
  }, [name])

  const getStats = useCallback(() => {
    const durations = measurements.current
    if (durations.length === 0) return null

    const sum = durations.reduce((a, b) => a + b, 0)
    const avg = sum / durations.length
    const min = Math.min(...durations)
    const max = Math.max(...durations)

    return { avg, min, max, count: durations.length }
  }, [])

  return { start, end, getStats }
}

// Debounced value hook with performance optimization
export function useOptimizedDebounce<T>(
  value: T,
  delay: number,
  options: {
    leading?: boolean
    trailing?: boolean
    maxWait?: number
  } = {}
) {
  const [debouncedValue] = useDebounce(value, delay, options)
  
  // Memoize the debounced value to prevent unnecessary re-renders
  return useMemo(() => debouncedValue, [debouncedValue])
}

// Throttled callback hook
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCall = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout>()

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now()
    
    if (now - lastCall.current >= delay) {
      lastCall.current = now
      return callback(...args)
    } else {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        lastCall.current = Date.now()
        callback(...args)
      }, delay - (now - lastCall.current))
    }
  }, [callback, delay]) as T
}

// Memoized expensive computation hook
export function useExpensiveComputation<T>(
  computeFn: () => T,
  deps: React.DependencyList,
  options: {
    timeout?: number
    fallback?: T
  } = {}
): { value: T | undefined; isComputing: boolean; error: Error | null } {
  const [state, setState] = useState<{
    value: T | undefined
    isComputing: boolean
    error: Error | null
  }>({
    value: options.fallback,
    isComputing: false,
    error: null,
  })

  const computationRef = useRef<Promise<T>>()

  useEffect(() => {
    setState(prev => ({ ...prev, isComputing: true, error: null }))

    const computation = Promise.resolve().then(() => {
      const startTime = performance.now()
      
      try {
        const result = computeFn()
        const duration = performance.now() - startTime
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Expensive Computation] Duration: ${duration.toFixed(2)}ms`)
        }
        
        return result
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error))
      }
    })

    computationRef.current = computation

    // Add timeout if specified
    const timeoutPromise = options.timeout
      ? new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Computation timeout')), options.timeout)
        })
      : null

    const racePromise = timeoutPromise
      ? Promise.race([computation, timeoutPromise])
      : computation

    racePromise
      .then(value => {
        if (computationRef.current === computation) {
          setState({ value, isComputing: false, error: null })
        }
      })
      .catch(error => {
        if (computationRef.current === computation) {
          setState(prev => ({
            ...prev,
            isComputing: false,
            error: error instanceof Error ? error : new Error(String(error)),
          }))
        }
      })

    return () => {
      computationRef.current = undefined
    }
  }, deps)

  return state
}

// Virtual scrolling hook for large lists
export function useVirtualScrolling<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) {
  const [scrollTop, setScrollTop] = useState(0)

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    )

    return { startIndex, endIndex }
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan])

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1)
      .map((item, index) => ({
        item,
        index: visibleRange.startIndex + index,
        top: (visibleRange.startIndex + index) * itemHeight,
      }))
  }, [items, visibleRange, itemHeight])

  const totalHeight = items.length * itemHeight

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }, [])

  return {
    visibleItems,
    totalHeight,
    handleScroll,
    visibleRange,
  }
}

// Intersection observer hook for lazy loading
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null)
  const elementRef = useRef<Element | null>(null)

  const observer = useMemo(() => {
    if (typeof window === 'undefined') return null

    return new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting)
      setEntry(entry)
    }, {
      threshold: 0.1,
      rootMargin: '50px',
      ...options,
    })
  }, [options.threshold, options.rootMargin, options.root])

  useEffect(() => {
    if (!observer || !elementRef.current) return

    observer.observe(elementRef.current)

    return () => {
      observer.disconnect()
    }
  }, [observer])

  const setElement = useCallback((element: Element | null) => {
    if (elementRef.current && observer) {
      observer.unobserve(elementRef.current)
    }

    elementRef.current = element

    if (element && observer) {
      observer.observe(element)
    }
  }, [observer])

  return { isIntersecting, entry, setElement }
}

// Image lazy loading hook
export function useLazyImage(src: string, placeholder?: string) {
  const [imageSrc, setImageSrc] = useState(placeholder || '')
  const [isLoaded, setIsLoaded] = useState(false)
  const [isError, setIsError] = useState(false)
  const { isIntersecting, setElement } = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '50px',
  })

  useEffect(() => {
    if (!isIntersecting) return

    const img = new Image()
    
    img.onload = () => {
      setImageSrc(src)
      setIsLoaded(true)
      setIsError(false)
    }

    img.onerror = () => {
      setIsError(true)
      setIsLoaded(false)
    }

    img.src = src
  }, [isIntersecting, src])

  return {
    imageSrc,
    isLoaded,
    isError,
    setElement,
  }
}

// Bundle size optimization utilities
export const bundleOptimization = {
  // Dynamic import with error handling
  dynamicImport: async <T>(importFn: () => Promise<T>): Promise<T | null> => {
    try {
      const startTime = performance.now()
      const module = await importFn()
      const duration = performance.now() - startTime

      if (process.env.NODE_ENV === 'development') {
        console.log(`[Dynamic Import] Duration: ${duration.toFixed(2)}ms`)
      }

      return module
    } catch (error) {
      console.error('Dynamic import failed:', error)
      return null
    }
  },

  // Preload critical resources
  preloadResource: (href: string, as: string) => {
    if (typeof window === 'undefined') return

    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = href
    link.as = as
    document.head.appendChild(link)
  },

  // Prefetch non-critical resources
  prefetchResource: (href: string) => {
    if (typeof window === 'undefined') return

    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = href
    document.head.appendChild(link)
  },
}

// Performance budget monitoring
export function usePerformanceBudget() {
  const [metrics, setMetrics] = useState<{
    fcp?: number
    lcp?: number
    fid?: number
    cls?: number
  }>({})

  useEffect(() => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return
    }

    // First Contentful Paint
    const fcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const fcp = entries.find(entry => entry.name === 'first-contentful-paint')
      if (fcp) {
        setMetrics(prev => ({ ...prev, fcp: fcp.startTime }))
      }
    })

    // Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1]
      if (lastEntry) {
        setMetrics(prev => ({ ...prev, lcp: lastEntry.startTime }))
      }
    })

    // First Input Delay
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach(entry => {
        if (entry.name === 'first-input') {
          const fid = (entry as any).processingStart - entry.startTime
          setMetrics(prev => ({ ...prev, fid }))
        }
      })
    })

    // Cumulative Layout Shift
    const clsObserver = new PerformanceObserver((list) => {
      let cls = 0
      list.getEntries().forEach(entry => {
        if (!(entry as any).hadRecentInput) {
          cls += (entry as any).value
        }
      })
      setMetrics(prev => ({ ...prev, cls }))
    })

    try {
      fcpObserver.observe({ entryTypes: ['paint'] })
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
      fidObserver.observe({ entryTypes: ['first-input'] })
      clsObserver.observe({ entryTypes: ['layout-shift'] })
    } catch (error) {
      console.warn('Performance observer not supported:', error)
    }

    return () => {
      fcpObserver.disconnect()
      lcpObserver.disconnect()
      fidObserver.disconnect()
      clsObserver.disconnect()
    }
  }, [])

  return metrics
}