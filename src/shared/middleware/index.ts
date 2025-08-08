// Primary middleware exports
export * from "./auth";
export * from "./validate.middleware";
export * from "./error.middleware";
export * from "./rate-limiter.middleware";
export * from "./upload.middleware";
export * from "./audit-log.middleware";

// Legacy middleware exports for backward compatibility
export { createError, asyncHandler } from "./errorHandler";
export { notFoundHandler } from "./notFoundHandler";

// Re-export commonly used middleware with better names
export { authenticate as auth } from "./auth";
export { authorize } from "./auth";
export { optionalAuth } from "./auth";
export { errorHandler } from "./error.middleware";
export { validate } from "./validate.middleware";
export { auditLogMiddleware as auditLog } from "./audit-log.middleware";
export { apiLimiter as rateLimiter, authLimiter } from "./rate-limiter.middleware";
export { upload } from "./upload.middleware";

// Middleware composition utilities
import type { Request, Response, NextFunction } from "express";

/**
 * Compose multiple middleware functions into a single middleware
 */
export const composeMiddleware = (...middlewares: Array<(req: Request, res: Response, next: NextFunction) => void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    let index = 0;

    const dispatch = (i: number): void => {
      if (i <= index) return next(new Error("next() called multiple times"));
      index = i;

      let fn = middlewares[i];
      if (i === middlewares.length) fn = next as any;
      if (!fn) return next();

      try {
        fn(req, res, dispatch.bind(null, i + 1));
      } catch (err) {
        next(err);
      }
    };

    dispatch(0);
  };
};

/**
 * Apply middleware conditionally
 */
export const conditionalMiddleware = (
  condition: (req: Request) => boolean,
  middleware: (req: Request, res: Response, next: NextFunction) => void
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (condition(req)) {
      return middleware(req, res, next);
    }
    next();
  };
};

/**
 * Skip middleware for certain paths
 */
export const skipForPaths = (
  paths: string[],
  middleware: (req: Request, res: Response, next: NextFunction) => void
) => {
  return conditionalMiddleware(
    (req) => !paths.some(path => req.path.startsWith(path)),
    middleware
  );
};

/**
 * Apply middleware only for certain paths
 */
export const onlyForPaths = (
  paths: string[],
  middleware: (req: Request, res: Response, next: NextFunction) => void
) => {
  return conditionalMiddleware(
    (req) => paths.some(path => req.path.startsWith(path)),
    middleware
  );
};

/**
 * Apply middleware only for certain HTTP methods
 */
export const onlyForMethods = (
  methods: string[],
  middleware: (req: Request, res: Response, next: NextFunction) => void
) => {
  return conditionalMiddleware(
    (req) => methods.includes(req.method.toUpperCase()),
    middleware
  );
};

/**
 * Apply middleware only for authenticated users
 */
export const onlyForAuthenticated = (
  middleware: (req: Request, res: Response, next: NextFunction) => void
) => {
  return conditionalMiddleware(
    (req) => !!(req as any).user,
    middleware
  );
};

/**
 * Apply middleware only for specific user roles
 */
export const onlyForRoles = (
  roles: string[],
  middleware: (req: Request, res: Response, next: NextFunction) => void
) => {
  return conditionalMiddleware(
    (req) => {
      const user = (req as any).user;
      return user && roles.includes(user.role);
    },
    middleware
  );
};

/**
 * Timeout middleware
 */
export const timeout = (ms: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          message: "Request timeout",
          timestamp: new Date().toISOString(),
        });
      }
    }, ms);

    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));

    next();
  };
};

/**
 * Request ID middleware
 */
export const requestId = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.headers["x-request-id"] || 
               req.headers["x-correlation-id"] || 
               Math.random().toString(36).substring(2, 15);
    
    (req as any).requestId = id;
    res.setHeader("X-Request-ID", id);
    next();
  };
};

/**
 * CORS middleware with enhanced options
 */
export const cors = (options?: {
  origins?: string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
}) => {
  const defaultOptions = {
    origins: ["*"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    headers: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
  };

  const config = { ...defaultOptions, ...options };

  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    // Set CORS headers
    if (config.origins.includes("*") || (origin && config.origins.includes(origin))) {
      res.setHeader("Access-Control-Allow-Origin", origin || "*");
    }

    res.setHeader("Access-Control-Allow-Methods", config.methods.join(", "));
    res.setHeader("Access-Control-Allow-Headers", config.headers.join(", "));

    if (config.credentials) {
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    next();
  };
};

/**
 * Security headers middleware
 */
export const securityHeaders = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Prevent clickjacking
    res.setHeader("X-Frame-Options", "DENY");
    
    // Prevent MIME type sniffing
    res.setHeader("X-Content-Type-Options", "nosniff");
    
    // Enable XSS protection
    res.setHeader("X-XSS-Protection", "1; mode=block");
    
    // Strict transport security
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    
    // Referrer policy
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    
    // Content security policy
    res.setHeader("Content-Security-Policy", "default-src 'self'");
    
    next();
  };
};

/**
 * Response time middleware
 */
export const responseTime = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      res.setHeader("X-Response-Time", `${duration}ms`);
    });

    next();
  };
};

/**
 * Health check middleware
 */
export const healthCheck = (path: string = "/health") => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path === path) {
      return res.status(200).json({
        success: true,
        message: "Server is healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    }
    next();
  };
};

/**
 * API versioning middleware
 */
export const apiVersion = (defaultVersion: string = "v1") => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Extract version from URL path
    const pathVersion = req.path.split("/")[2]; // /api/v1/...
    
    // Extract version from header
    const headerVersion = req.headers["api-version"] as string;
    
    // Extract version from query parameter
    const queryVersion = req.query.version as string;
    
    // Determine version (priority: path > header > query > default)
    const version = pathVersion?.startsWith("v") ? pathVersion : 
                   headerVersion || queryVersion || defaultVersion;
    
    (req as any).apiVersion = version;
    res.setHeader("API-Version", version);
    
    next();
  };
};

/**
 * Request logging middleware
 */
export const requestLogger = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    res.on("finish", () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    });
    
    next();
  };
};
