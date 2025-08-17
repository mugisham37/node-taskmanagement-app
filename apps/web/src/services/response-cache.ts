import { appConfig } from '@/config/app'

// Cache entry interface
interface CacheEntry<T = any> {
  data: T
  timestamp: number
  ttl: number
  etag?: string
  lastModified?: string
}

// Cache options interface
interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  maxSize?: number // Maximum number of entries
  serialize?: boolean // Whether to serialize data
  compress?: boolean // Whether to compress data (for large responses)
}

// Response cache class
class ResponseCache {
  private cache = new Map<string, CacheEntry>()
  private accessOrder = new Map<string, number>() // For LRU eviction
  private accessCounter = 0
  private readonly defaultTTL = appConfig.cache.staleTime
  private readonly maxSize = 1000

  // Get cached response
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.delete(key)
      return null
    }

    // Update access order for LRU
    this.accessOrder.set(key, ++this.accessCounter)
    
    return entry.data
  }

  // Set cached response
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const {
      ttl = this.defaultTTL,
      serialize = false,
    } = options

    // Serialize data if requested
    const processedData = serialize ? this.serialize(data) : data

    const entry: CacheEntry<T> = {
      data: processedData,
      timestamp: Date.now(),
      ttl,
    }

    // Ensure cache size limit
    this.ensureCacheSize()

    this.cache.set(key, entry)
    this.accessOrder.set(key, ++this.accessCounter)
  }

  // Delete cached response
  delete(key: string): boolean {
    this.accessOrder.delete(key)
    return this.cache.delete(key)
  }

  // Clear all cached responses
  clear(): void {
    this.cache.clear()
    this.accessOrder.clear()
    this.accessCounter = 0
  }

  // Check if entry exists and is valid
  has(key: string): boolean {
    const entry = this.cache.get(key)
    return entry ? !this.isExpired(entry) : false
  }

  // Get cache statistics
  getStats() {
    const now = Date.now()
    let validEntries = 0
    let expiredEntries = 0

    for (const entry of this.cache.values()) {
      if (this.isExpired(entry)) {
        expiredEntries++
      } else {
        validEntries++
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      memoryUsage: this.estimateMemoryUsage(),
    }
  }

  // Invalidate entries by pattern
  invalidatePattern(pattern: string | RegExp): number {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
    let invalidated = 0

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.delete(key)
        invalidated++
      }
    }

    return invalidated
  }

  // Invalidate entries by tags
  invalidateByTags(tags: string[]): number {
    let invalidated = 0

    for (const key of this.cache.keys()) {
      // Extract tags from key (assuming format: "endpoint:tag1,tag2")
      const keyTags = this.extractTagsFromKey(key)
      
      if (tags.some(tag => keyTags.includes(tag))) {
        this.delete(key)
        invalidated++
      }
    }

    return invalidated
  }

  // Cleanup expired entries
  cleanup(): number {
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.delete(key)
        cleaned++
      }
    }

    return cleaned
  }

  // Generate cache key
  generateKey(
    endpoint: string,
    params?: Record<string, any>,
    tags?: string[]
  ): string {
    let key = endpoint

    // Add query parameters
    if (params && Object.keys(params).length > 0) {
      const sortedParams = Object.keys(params)
        .sort()
        .map(k => `${k}=${encodeURIComponent(String(params[k]))}`)
        .join('&')
      key += `?${sortedParams}`
    }

    // Add tags
    if (tags && tags.length > 0) {
      key += `:${tags.sort().join(',')}`
    }

    return key
  }

  // Check if entry is expired
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  // Ensure cache doesn't exceed size limit
  private ensureCacheSize(): void {
    if (this.cache.size >= this.maxSize) {
      // Remove least recently used entries
      const sortedByAccess = Array.from(this.accessOrder.entries())
        .sort((a, b) => a[1] - b[1])

      const toRemove = Math.ceil(this.maxSize * 0.1) // Remove 10%
      
      for (let i = 0; i < toRemove && i < sortedByAccess.length; i++) {
        const [key] = sortedByAccess[i]
        this.delete(key)
      }
    }
  }

  // Serialize data for storage
  private serialize<T>(data: T): T {
    try {
      return JSON.parse(JSON.stringify(data))
    } catch {
      return data
    }
  }

  // Estimate memory usage
  private estimateMemoryUsage(): number {
    let size = 0
    
    for (const [key, entry] of this.cache.entries()) {
      size += key.length * 2 // UTF-16 characters
      size += JSON.stringify(entry).length * 2
    }
    
    return size
  }

  // Extract tags from cache key
  private extractTagsFromKey(key: string): string[] {
    const tagMatch = key.match(/:([^:]+)$/)
    return tagMatch ? tagMatch[1].split(',') : []
  }
}

// Create singleton instance
export const responseCache = new ResponseCache()

// Cache decorator for API methods
export function cached<T extends (...args: any[]) => Promise<any>>(
  options: CacheOptions & {
    keyGenerator?: (...args: Parameters<T>) => string
    tags?: string[]
  } = {}
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: Parameters<T>) {
      const {
        keyGenerator,
        tags = [],
        ...cacheOptions
      } = options

      // Generate cache key
      const key = keyGenerator 
        ? keyGenerator(...args)
        : responseCache.generateKey(
            `${target.constructor.name}.${propertyKey}`,
            { args: JSON.stringify(args) },
            tags
          )

      // Try to get from cache
      const cached = responseCache.get(key)
      if (cached !== null) {
        return cached
      }

      // Execute original method
      const result = await originalMethod.apply(this, args)

      // Cache the result
      responseCache.set(key, result, cacheOptions)

      return result
    }

    return descriptor
  }
}

// Cache middleware for API client
export function createCacheMiddleware(options: CacheOptions = {}) {
  return {
    request: (config: any) => {
      // Add cache headers if supported
      if (config.method?.toLowerCase() === 'get') {
        config.headers = {
          ...config.headers,
          'Cache-Control': 'max-age=300', // 5 minutes
        }
      }
      return config
    },
    
    response: (response: Response, config: any) => {
      // Cache GET responses
      if (config.method?.toLowerCase() === 'get' && response.ok) {
        const key = responseCache.generateKey(config.url, config.params)
        
        // Extract cache headers
        const cacheControl = response.headers.get('cache-control')
        const etag = response.headers.get('etag')
        const lastModified = response.headers.get('last-modified')
        
        // Determine TTL from cache headers
        let ttl = options.ttl || appConfig.cache.staleTime
        if (cacheControl) {
          const maxAgeMatch = cacheControl.match(/max-age=(\d+)/)
          if (maxAgeMatch) {
            ttl = parseInt(maxAgeMatch[1]) * 1000
          }
        }

        // Cache the response
        response.clone().json().then(data => {
          responseCache.set(key, data, { ...options, ttl })
        }).catch(() => {
          // Ignore JSON parsing errors for non-JSON responses
        })
      }
      
      return response
    },
  }
}

// Utility functions
export const cacheUtils = {
  // Invalidate cache for specific resource
  invalidateResource: (resource: string, id?: string) => {
    const pattern = id ? `${resource}.*${id}` : `${resource}.*`
    return responseCache.invalidatePattern(pattern)
  },

  // Invalidate cache by tags
  invalidateByTags: (tags: string[]) => {
    return responseCache.invalidateByTags(tags)
  },

  // Warm cache with data
  warmCache: <T>(key: string, data: T, options?: CacheOptions) => {
    responseCache.set(key, data, options)
  },

  // Get cache statistics
  getStats: () => responseCache.getStats(),

  // Cleanup expired entries
  cleanup: () => responseCache.cleanup(),

  // Clear all cache
  clear: () => responseCache.clear(),
}

// Auto cleanup interval
if (typeof window !== 'undefined') {
  setInterval(() => {
    responseCache.cleanup()
  }, 5 * 60 * 1000) // Cleanup every 5 minutes
}