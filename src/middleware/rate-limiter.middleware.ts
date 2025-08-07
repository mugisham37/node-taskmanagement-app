import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { createClient } from "redis";
import config from "../config/environment";
import logger from "../config/logger";
import type { Request, Response, NextFunction } from "express";
import { TooManyRequestsError } from "../utils/app-error";

// Parse rate limit configuration from environment variables with proper type handling
const RATE_LIMIT_WINDOW_MS = typeof config.rateLimitWindowMs === 'string' 
  ? Number.parseInt(config.rateLimitWindowMs, 10)
  : config.rateLimitWindowMs || 900000; // Default: 15 minutes

const RATE_LIMIT_MAX = typeof config.rateLimitMax === 'string'
  ? Number.parseInt(config.rateLimitMax, 10) 
  : config.rateLimitMax || 100; // Default: 100 requests per window

// Create Redis client for rate limiting if Redis URL is provided and Redis is enabled
let redisClient: any;

// Function to create a Redis store with unique prefix
const createRedisStore = (prefix: string) => {
  if (!config.redisUrl || !config.useRedis || config.disableCache === "true") {
    return undefined;
  }

  if (!redisClient) {
    try {
      redisClient = createClient({
        url: config.redisUrl,
      });

      redisClient.on("error", (err: Error) => {
        logger.error("Redis client error:", err);
      });

      redisClient.on("connect", () => {
        logger.info("Redis client connected for rate limiting");
      });

      redisClient.on("disconnect", () => {
        logger.warn("Redis client disconnected");
      });

      // Connect to Redis
      redisClient.connect().catch((error: Error) => {
        logger.error("Failed to connect to Redis:", error);
      });
    } catch (error) {
      logger.error("Failed to initialize Redis for rate limiting:", error);
      return undefined;
    }
  }

  try {
    return new RedisStore({
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
      prefix: `rate-limit:${prefix}:`,
    });
  } catch (error) {
    logger.error(`Failed to create Redis store for ${prefix}:`, error);
    return undefined;
  }
};

/**
 * General rate limiter for API endpoints
 */
export const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("api"),
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later",
    code: "RATE_LIMIT_EXCEEDED",
    timestamp: new Date().toISOString(),
  },
  skip: (req) => {
    // Skip rate limiting for certain paths or in development
    if (process.env.NODE_ENV === "development" && config.skipRateLimitInDev === "true") {
      return true;
    }

    // Skip rate limiting for health check endpoints
    if (req.path === "/health" || req.path === "/api/health") {
      return true;
    }

    return false;
  },
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    const user = (req as any).user;
    return user ? `user:${user.id}` : req.ip || "unknown";
  },
});

/**
 * Strict rate limiter for authentication endpoints
 */
export const authLimiter = rateLimit({
  windowMs: typeof config.authRateLimitWindowMs === 'string' 
    ? Number.parseInt(config.authRateLimitWindowMs, 10) 
    : Number.parseInt(config.authRateLimitWindowMs || "900000", 10), // 15 minutes
  max: typeof config.authRateLimitMax === 'string'
    ? Number.parseInt(config.authRateLimitMax, 10)
    : Number.parseInt(config.authRateLimitMax || "5", 10), // 5 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("auth"),
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later",
    code: "AUTH_RATE_LIMIT_EXCEEDED",
    timestamp: new Date().toISOString(),
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  keyGenerator: (req) => `auth:${req.ip}`,
});

/**
 * Password reset rate limiter
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("password-reset"),
  message: {
    success: false,
    message: "Too many password reset attempts, please try again later",
    code: "PASSWORD_RESET_RATE_LIMIT_EXCEEDED",
    timestamp: new Date().toISOString(),
  },
  keyGenerator: (req) => `password-reset:${req.ip}`,
});

/**
 * Email verification rate limiter
 */
export const emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 email verification requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("email-verification"),
  message: {
    success: false,
    message: "Too many email verification attempts, please try again later",
    code: "EMAIL_VERIFICATION_RATE_LIMIT_EXCEEDED",
    timestamp: new Date().toISOString(),
  },
  keyGenerator: (req) => `email-verification:${req.ip}`,
});

/**
 * File upload rate limiter
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 upload requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("upload"),
  message: {
    success: false,
    message: "Too many upload attempts, please try again later",
    code: "UPLOAD_RATE_LIMIT_EXCEEDED",
    timestamp: new Date().toISOString(),
  },
  keyGenerator: (req) => {
    const user = (req as any).user;
    return user ? `upload:user:${user.id}` : `upload:ip:${req.ip}`;
  },
});

/**
 * Search rate limiter
 */
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 search requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("search"),
  message: {
    success: false,
    message: "Too many search requests, please try again later",
    code: "SEARCH_RATE_LIMIT_EXCEEDED",
    timestamp: new Date().toISOString(),
  },
  keyGenerator: (req) => {
    const user = (req as any).user;
    return user ? `search:user:${user.id}` : `search:ip:${req.ip}`;
  },
});

/**
 * Export rate limiter
 */
export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 export requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore("export"),
  message: {
    success: false,
    message: "Too many export requests, please try again later",
    code: "EXPORT_RATE_LIMIT_EXCEEDED",
    timestamp: new Date().toISOString(),
  },
  keyGenerator: (req) => {
    const user = (req as any).user;
    return user ? `export:user:${user.id}` : `export:ip:${req.ip}`;
  },
});

/**
 * Create a custom rate limiter with specific options
 */
export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  keyPrefix?: string;
  skipCondition?: (req: Request) => boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore(options.keyPrefix || "custom"),
    message: {
      success: false,
      message: options.message || "Too many requests, please try again later",
      code: "CUSTOM_RATE_LIMIT_EXCEEDED",
      timestamp: new Date().toISOString(),
    },
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skip: options.skipCondition || (() => false),
    keyGenerator: (req) => {
      const user = (req as any).user;
      const prefix = options.keyPrefix || "custom";
      return user ? `${prefix}:user:${user.id}` : `${prefix}:ip:${req.ip}`;
    },
  });
};

/**
 * Dynamic rate limiter based on user role
 */
export const dynamicRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  // Get user from request (assumes auth middleware has run)
  const user = (req as any).user;
  
  let maxRequests = 100; // Default for unauthenticated users
  let windowMs = 15 * 60 * 1000; // 15 minutes
  
  if (user) {
    switch (user.role) {
      case 'admin':
        maxRequests = 1000;
        break;
      case 'premium':
        maxRequests = 500;
        break;
      case 'user':
        maxRequests = 200;
        break;
      default:
        maxRequests = 100;
    }
  }
  
  const limiter = rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore("dynamic"),
    message: {
      success: false,
      message: "Rate limit exceeded for your user level",
      code: "DYNAMIC_RATE_LIMIT_EXCEEDED",
      timestamp: new Date().toISOString(),
    },
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise use IP
      return user ? `dynamic:user:${user.id}` : `dynamic:ip:${req.ip}`;
    },
  });
  
  return limiter(req, res, next);
};

/**
 * Rate limiter for API endpoints based on complexity
 */
export const apiComplexityLimiter = (complexity: 'low' | 'medium' | 'high') => {
  const limits = {
    low: { windowMs: 1 * 60 * 1000, max: 100 }, // 1 minute, 100 requests
    medium: { windowMs: 5 * 60 * 1000, max: 50 }, // 5 minutes, 50 requests
    high: { windowMs: 15 * 60 * 1000, max: 10 }, // 15 minutes, 10 requests
  };

  const limitConfig = limits[complexity];

  return rateLimit({
    windowMs: limitConfig.windowMs,
    max: limitConfig.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore(`complexity-${complexity}`),
    message: {
      success: false,
      message: `Too many ${complexity} complexity requests, please try again later`,
      code: `${complexity.toUpperCase()}_COMPLEXITY_RATE_LIMIT_EXCEEDED`,
      timestamp: new Date().toISOString(),
    },
    keyGenerator: (req) => {
      const user = (req as any).user;
      return user ? `${complexity}:user:${user.id}` : `${complexity}:ip:${req.ip}`;
    },
  });
};

/**
 * Sliding window rate limiter for more precise control
 */
export const slidingWindowLimiter = (options: {
  windowMs: number;
  max: number;
  keyPrefix: string;
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!redisClient) {
      // Fallback to standard rate limiter if Redis is not available
      return createRateLimiter(options)(req, res, next);
    }

    try {
      const user = (req as any).user;
      const key = user 
        ? `${options.keyPrefix}:user:${user.id}` 
        : `${options.keyPrefix}:ip:${req.ip}`;
      
      const now = Date.now();
      const window = options.windowMs;
      const limit = options.max;

      // Remove expired entries
      await redisClient.zRemRangeByScore(key, 0, now - window);

      // Count current requests in window
      const current = await redisClient.zCard(key);

      if (current >= limit) {
        logger.warn("Sliding window rate limit exceeded", {
          ip: req.ip,
          userId: user?.id,
          path: req.path,
          method: req.method,
          current,
          limit,
          windowMs: window,
        });

        return res.status(429).json({
          success: false,
          message: "Too many requests, please try again later",
          code: "SLIDING_WINDOW_RATE_LIMIT_EXCEEDED",
          timestamp: new Date().toISOString(),
        });
      }

      // Add current request
      await redisClient.zAdd(key, { score: now, value: `${now}-${Math.random()}` });
      await redisClient.expire(key, Math.ceil(window / 1000));

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current - 1));
      res.setHeader('X-RateLimit-Reset', new Date(now + window).toISOString());

      next();
    } catch (error) {
      logger.error("Sliding window rate limiter error:", error);
      // Continue without rate limiting if Redis fails
      next();
    }
  };
};

/**
 * Cleanup function for Redis connections
 */
export const cleanupRateLimiter = async () => {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info("Redis client disconnected for rate limiting");
    } catch (error) {
      logger.error("Error disconnecting Redis client:", error);
    }
  }
};

// Export Redis client for external use
export { redisClient };

// Legacy alias for backward compatibility
export const rateLimiter = apiLimiter;
