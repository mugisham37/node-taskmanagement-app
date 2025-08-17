import { useCallback, useEffect, useRef, useState } from 'react';

export interface LazyLoadingOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
  fallbackDelay?: number;
}

export interface LazyLoadingResult {
  isVisible: boolean;
  ref: React.RefObject<HTMLElement>;
}

export function useLazyLoading(options: LazyLoadingOptions = {}): LazyLoadingResult {
  const {
    threshold = 0.1,
    rootMargin = '50px',
    triggerOnce = true,
    fallbackDelay = 300,
  } = options;

  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Fallback for browsers without IntersectionObserver
    if (!window.IntersectionObserver) {
      const timer = setTimeout(() => setIsVisible(true), fallbackDelay);
      return () => clearTimeout(timer);
    }

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce && observerRef.current) {
            observerRef.current.disconnect();
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [threshold, rootMargin, triggerOnce, fallbackDelay]);

  return { isVisible, ref };
}

// Hook for lazy loading images with progressive enhancement
export interface LazyImageOptions extends LazyLoadingOptions {
  placeholder?: string;
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: (error: Event) => void;
}

export interface LazyImageResult {
  src: string | undefined;
  isLoading: boolean;
  hasError: boolean;
  ref: React.RefObject<HTMLImageElement>;
}

export function useLazyImage(
  imageSrc: string,
  options: LazyImageOptions = {}
): LazyImageResult {
  const { placeholder, blurDataURL, onLoad, onError, ...lazyOptions } = options;
  const { isVisible, ref: lazyRef } = useLazyLoading(lazyOptions);
  
  const [src, setSrc] = useState<string | undefined>(placeholder || blurDataURL);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!isVisible || !imageSrc) return;

    setIsLoading(true);
    setHasError(false);

    const img = new Image();
    
    img.onload = () => {
      setSrc(imageSrc);
      setIsLoading(false);
      onLoad?.();
    };

    img.onerror = (error) => {
      setHasError(true);
      setIsLoading(false);
      onError?.(error);
    };

    img.src = imageSrc;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [isVisible, imageSrc, onLoad, onError]);

  // Combine refs
  const ref = useCallback((node: HTMLImageElement) => {
    imgRef.current = node;
    if (lazyRef.current !== node) {
      (lazyRef as any).current = node;
    }
  }, [lazyRef]);

  return { src, isLoading, hasError, ref };
}

// Hook for lazy loading components
export function useLazyComponent<T = any>(
  importFn: () => Promise<{ default: React.ComponentType<T> }>,
  options: LazyLoadingOptions = {}
) {
  const { isVisible } = useLazyLoading(options);
  const [Component, setComponent] = useState<React.ComponentType<T> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isVisible || Component) return;

    setIsLoading(true);
    setError(null);

    importFn()
      .then((module) => {
        setComponent(() => module.default);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err);
        setIsLoading(false);
      });
  }, [isVisible, Component, importFn]);

  return { Component, isLoading, error };
}

// Hook for virtual scrolling
export interface VirtualScrollOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  scrollingDelay?: number;
}

export interface VirtualScrollResult {
  startIndex: number;
  endIndex: number;
  isScrolling: boolean;
  scrollTop: number;
  containerRef: React.RefObject<HTMLDivElement>;
  totalHeight: number;
}

export function useVirtualScroll(
  itemCount: number,
  options: VirtualScrollOptions
): VirtualScrollResult {
  const { itemHeight, containerHeight, overscan = 5, scrollingDelay = 150 } = options;
  
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollingTimeoutRef = useRef<NodeJS.Timeout>();

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    itemCount - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );
  const totalHeight = itemCount * itemHeight;

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const newScrollTop = containerRef.current.scrollTop;
    setScrollTop(newScrollTop);
    setIsScrolling(true);

    if (scrollingTimeoutRef.current) {
      clearTimeout(scrollingTimeoutRef.current);
    }

    scrollingTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, scrollingDelay);
  }, [scrollingDelay]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollingTimeoutRef.current) {
        clearTimeout(scrollingTimeoutRef.current);
      }
    };
  }, [handleScroll]);

  return {
    startIndex,
    endIndex,
    isScrolling,
    scrollTop,
    containerRef,
    totalHeight,
  };
}