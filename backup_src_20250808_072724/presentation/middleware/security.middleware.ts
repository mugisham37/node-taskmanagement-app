import type { Application, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import config from "../config/environment";
import logger from "../config/logger";
import { AppError } from "../utils/app-error";

/**
 * Configure comprehensive security middleware
 */
export const configureSecurityMiddleware = (app: Application): void => {
  // Helmet for security headers
  if (config.enableHelmet === "true") {
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: config.nodeEnv === "production" ? [] : null,
          },
        },
        crossOriginEmbedderPolicy: false,
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
      })
    );
  }

  // CORS configuration
  if (config.enableCors === "true") {
    app.use(
      cors({
        origin: (origin, callback) => {
          // Allow requests with no origin (mobile apps, Postman, etc.)
          if (!origin) return callback(null, true);

          // Check if origin is in allowed origins
          if (config.allowedOrigins.includes(origin) || config.corsOrigin === "*") {
            return callback(null, true);
          }

          // In development, allow localhost with any port
          if (config.nodeEnv === "development" && origin.includes("localhost")) {
            return callback(null, true);
          }

          logger.warn("CORS policy violation", {
            origin,
            allowedOrigins: config.allowedOrigins,
            userAgent: callback.toString(),
          });

          return callback(new Error("Not allowed by CORS"), false);
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: [
          "Origin",
          "X-Requested-With",
          "Content-Type",
          "Accept",
          "Authorization",
          "X-API-Version",
          "X-Request-ID",
          "Accept-Language",
        ],
        exposedHeaders: ["X-Request-ID", "X-API-Version"],
        maxAge: 86400, // 24 hours
      })
    );
  }

  // Trust proxy if configured
  if (config.trustProxy === "true") {
    app.set("trust proxy", 1);
  }

  logger.info("Security middleware configured", {
    helmet: config.enableHelmet === "true",
    cors: config.enableCors === "true",
    trustProxy: config.trustProxy === "true",
    allowedOrigins: config.allowedOrigins,
  });
};

/**
 * Validate content type middleware
 */
export const validateContentType = (allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip validation for GET requests and health checks
    if (req.method === "GET" || req.path.includes("/health")) {
      return next();
    }

    const contentType = req.get("Content-Type");

    // Allow requests without content type for certain methods
    if (!contentType && ["DELETE", "OPTIONS"].includes(req.method)) {
      return next();
    }

    // Check if content type is allowed
    if (contentType) {
      const isAllowed = allowedTypes.some((type) =>
        contentType.toLowerCase().includes(type.toLowerCase())
      );

      if (isAllowed) {
        return next();
      }
    }

    logger.warn("Invalid content type", {
      contentType,
      allowedTypes,
      method: req.method,
      path: req.path,
      ip: req.ip,
    });

    const error = new AppError(
      `Content-Type must be one of: ${allowedTypes.join(", ")}`,
      415,
      true,
      "INVALID_CONTENT_TYPE"
    );

    next(error);
  };
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Remove sensitive headers
  res.removeHeader("X-Powered-By");
  res.removeHeader("Server");

  // Add custom security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

  // Add API version header
  res.setHeader("X-API-Version", config.apiVersion);

  next();
};

/**
 * Request sanitization middleware
 */
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction): void => {
  // Sanitize query parameters
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === "string") {
        req.query[key] = (req.query[key] as string)
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/javascript:/gi, "")
          .replace(/on\w+\s*=/gi, "");
      }
    }
  }

  // Sanitize request body
  if (req.body && typeof req.body === "object") {
    sanitizeObject(req.body);
  }

  next();
};

/**
 * Recursively sanitize object properties
 */
const sanitizeObject = (obj: any): void => {
  for (const key in obj) {
    if (typeof obj[key] === "string") {
      obj[key] = obj[key]
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/javascript:/gi, "")
        .replace(/on\w+\s*=/gi, "");
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
};

/**
 * IP whitelist middleware
 */
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = req.ip || req.connection.remoteAddress;

    if (config.nodeEnv === "development") {
      return next(); // Skip IP filtering in development
    }

    if (!clientIP || !allowedIPs.includes(clientIP)) {
      logger.warn("IP not in whitelist", {
        clientIP,
        allowedIPs,
        path: req.path,
        userAgent: req.get("User-Agent"),
      });

      const error = new AppError("Access denied", 403, true, "IP_NOT_ALLOWED");
      return next(error);
    }

    next();
  };
};

/**
 * Request size limit middleware
 */
export const requestSizeLimit = (maxSize: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get("Content-Length") || "0", 10);

    if (contentLength > maxSize) {
      logger.warn("Request size exceeds limit", {
        contentLength,
        maxSize,
        path: req.path,
        ip: req.ip,
      });

      const error = new AppError(
        `Request size exceeds limit of ${maxSize} bytes`,
        413,
        true,
        "REQUEST_TOO_LARGE"
      );

      return next(error);
    }

    next();
  };
};

/**
 * API key validation middleware
 */
export const validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.get("X-API-Key");

  // Skip API key validation for certain routes
  const skipRoutes = ["/health", "/api-docs", "/"];
  if (skipRoutes.some((route) => req.path.startsWith(route))) {
    return next();
  }

  // In development, API key is optional
  if (config.nodeEnv === "development" && !apiKey) {
    return next();
  }

  // Validate API key (you should implement your own validation logic)
  const validApiKeys = process.env.VALID_API_KEYS?.split(",") || [];

  if (!apiKey || !validApiKeys.includes(apiKey)) {
    logger.warn("Invalid or missing API key", {
      hasApiKey: !!apiKey,
      path: req.path,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    const error = new AppError("Invalid or missing API key", 401, true, "INVALID_API_KEY");
    return next(error);
  }

  next();
};
