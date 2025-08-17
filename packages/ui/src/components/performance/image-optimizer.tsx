import React, { useCallback, useMemo, useState } from 'react';
import { useLazyImage } from '../../hooks/use-lazy-loading';

export interface ImageOptimizerProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  sizes?: string;
  priority?: boolean;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: (error: Event) => void;
}

interface ImageSource {
  src: string;
  type: string;
}

export const ImageOptimizer: React.FC<ImageOptimizerProps> = ({
  src,
  alt,
  width,
  height,
  quality = 75,
  format = 'webp',
  sizes,
  priority = false,
  placeholder = 'empty',
  blurDataURL,
  className,
  style,
  onLoad,
  onError,
}) => {
  const [hasError, setHasError] = useState(false);

  // Generate optimized image URLs
  const optimizedSources = useMemo(() => {
    const sources: ImageSource[] = [];
    const baseUrl = src.split('?')[0];
    const params = new URLSearchParams();

    if (width) params.set('w', width.toString());
    if (height) params.set('h', height.toString());
    params.set('q', quality.toString());

    // Modern formats first (better compression)
    if (format === 'avif' || format === 'webp') {
      sources.push({
        src: `${baseUrl}?${params.toString()}&f=avif`,
        type: 'image/avif',
      });
      sources.push({
        src: `${baseUrl}?${params.toString()}&f=webp`,
        type: 'image/webp',
      });
    }

    // Fallback format
    const fallbackFormat = format === 'avif' || format === 'webp' ? 'jpeg' : format;
    sources.push({
      src: `${baseUrl}?${params.toString()}&f=${fallbackFormat}`,
      type: `image/${fallbackFormat}`,
    });

    return sources;
  }, [src, width, height, quality, format]);

  // Generate responsive image sizes
  const responsiveSources = useMemo(() => {
    if (!width || !sizes) return optimizedSources;

    return optimizedSources.map(source => {
      const srcSet = [1, 1.5, 2, 3].map(scale => {
        const scaledWidth = Math.round(width * scale);
        const url = new URL(source.src);
        url.searchParams.set('w', scaledWidth.toString());
        return `${url.toString()} ${scale}x`;
      }).join(', ');

      return {
        ...source,
        srcSet,
      };
    });
  }, [optimizedSources, width, sizes]);

  // Lazy loading (skip if priority is true)
  const { src: lazySrc, isLoading, hasError: lazyError, ref } = useLazyImage(
    priority ? src : optimizedSources[optimizedSources.length - 1].src,
    {
      triggerOnce: true,
      threshold: 0.1,
      placeholder: placeholder === 'blur' ? blurDataURL : undefined,
      onLoad,
      onError: (error) => {
        setHasError(true);
        onError?.(error);
      },
    }
  );

  const handleError = useCallback((error: React.SyntheticEvent<HTMLImageElement>) => {
    setHasError(true);
    onError?.(error.nativeEvent);
  }, [onError]);

  // Placeholder component
  const renderPlaceholder = () => {
    if (placeholder === 'blur' && blurDataURL) {
      return (
        <img
          src={blurDataURL}
          alt=""
          className={`${className} blur-sm transition-all duration-300`}
          style={{
            ...style,
            width: width || '100%',
            height: height || 'auto',
          }}
        />
      );
    }

    return (
      <div
        className={`${className} bg-gray-200 animate-pulse flex items-center justify-center`}
        style={{
          ...style,
          width: width || '100%',
          height: height || 200,
        }}
      >
        <svg
          className="w-8 h-8 text-gray-400"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    );
  };

  // Error fallback
  if (hasError || lazyError) {
    return (
      <div
        className={`${className} bg-red-100 border border-red-300 rounded flex items-center justify-center`}
        style={{
          ...style,
          width: width || '100%',
          height: height || 200,
        }}
      >
        <span className="text-red-600 text-sm">Failed to load image</span>
      </div>
    );
  }

  // Loading state
  if (!priority && (isLoading || !lazySrc)) {
    return renderPlaceholder();
  }

  // Render optimized image
  return (
    <picture>
      {responsiveSources.slice(0, -1).map((source, index) => (
        <source
          key={index}
          srcSet={source.srcSet || source.src}
          type={source.type}
          sizes={sizes}
        />
      ))}
      <img
        ref={priority ? undefined : ref}
        src={priority ? src : lazySrc}
        alt={alt}
        width={width}
        height={height}
        className={`${className} transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        style={style}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onError={handleError}
        onLoad={() => {
          if (priority) onLoad?.();
        }}
      />
    </picture>
  );
};

// Higher-order component for image optimization
export function withImageOptimization<P extends object>(
  Component: React.ComponentType<P>
) {
  return React.forwardRef<any, P>((props, ref) => {
    return <Component {...props} ref={ref} />;
  });
}

// Hook for preloading critical images
export function useImagePreloader(imageSources: string[], priority = false) {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const preloadImage = useCallback((src: string) => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        setLoadedImages(prev => new Set(prev).add(src));
        resolve();
      };
      
      img.onerror = () => {
        setFailedImages(prev => new Set(prev).add(src));
        reject(new Error(`Failed to load image: ${src}`));
      };
      
      img.src = src;
    });
  }, []);

  const preloadAll = useCallback(async () => {
    const promises = imageSources.map(src => 
      preloadImage(src).catch(() => {}) // Ignore individual failures
    );
    
    await Promise.allSettled(promises);
  }, [imageSources, preloadImage]);

  // Auto-preload if priority is true
  React.useEffect(() => {
    if (priority) {
      preloadAll();
    }
  }, [priority, preloadAll]);

  return {
    preloadImage,
    preloadAll,
    loadedImages,
    failedImages,
    isLoaded: (src: string) => loadedImages.has(src),
    hasFailed: (src: string) => failedImages.has(src),
  };
}