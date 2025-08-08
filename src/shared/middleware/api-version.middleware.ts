import type { Request, Response, NextFunction } from "express";
import config from "../config/environment";
import logger from "../config/logger";
import { AppError } from "../utils/app-error";

/**
 * API version middleware to handle versioning
 */
export const apiVersionMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Get version from header, query parameter, or URL path
  let requestedVersion = 
    req.headers["x-api-version"] as string ||
    req.query.version as string ||
    extractVersionFromPath(req.path);

  // Default to configured default version if none specified
  if (!requestedVersion) {
    requestedVersion = config.defaultApiVersion;
  }

  // Validate version format (should be like 'v1', 'v2', etc.)
  if (!isValidVersionFormat(requestedVersion)) {
    logger.warn("Invalid API version format", {
      requestedVersion,
      path: req.path,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    const error = new AppError(
      `Invalid API version format: ${requestedVersion}. Expected format: v1, v2, etc.`,
      400,
      true,
      "INVALID_API_VERSION_FORMAT"
    );

    return next(error);
  }

  // Check if version is supported
  if (!config.supportedApiVersions.includes(requestedVersion)) {
    logger.warn("Unsupported API version", {
      requestedVersion,
      supportedVersions: config.supportedApiVersions,
      path: req.path,
      ip: req.ip,
    });

    const error = new AppError(
      `API version ${requestedVersion} is not supported. Supported versions: ${config.supportedApiVersions.join(", ")}`,
      400,
      true,
      "UNSUPPORTED_API_VERSION"
    );

    return next(error);
  }

  // Add version to request object for use in controllers
  (req as any).apiVersion = requestedVersion;

  // Add version to response headers
  res.setHeader("X-API-Version", requestedVersion);

  // Log version usage for analytics
  logger.debug("API version resolved", {
    requestedVersion,
    resolvedVersion: requestedVersion,
    path: req.path,
    method: req.method,
  });

  next();
};

/**
 * Extract version from URL path (e.g., /api/v1/users -> v1)
 */
const extractVersionFromPath = (path: string): string | null => {
  const versionMatch = path.match(/\/api\/(v\d+)\//);
  return versionMatch ? versionMatch[1] : null;
};

/**
 * Validate version format
 */
const isValidVersionFormat = (version: string): boolean => {
  return /^v\d+$/.test(version);
};

/**
 * Middleware to deprecate old API versions
 */
export const deprecationWarningMiddleware = (deprecatedVersions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const apiVersion = (req as any).apiVersion;

    if (deprecatedVersions.includes(apiVersion)) {
      // Add deprecation warning to response headers
      res.setHeader("X-API-Deprecated", "true");
      res.setHeader("X-API-Deprecation-Date", getDeprecationDate(apiVersion));
      res.setHeader("X-API-Sunset-Date", getSunsetDate(apiVersion));

      // Log deprecation usage
      logger.warn("Deprecated API version used", {
        apiVersion,
        path: req.path,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        deprecationDate: getDeprecationDate(apiVersion),
        sunsetDate: getSunsetDate(apiVersion),
      });
    }

    next();
  };
};

/**
 * Get deprecation date for a version (you can customize this logic)
 */
const getDeprecationDate = (version: string): string => {
  // Example logic - you can customize based on your versioning strategy
  const deprecationDates: Record<string, string> = {
    v1: "2024-01-01",
    v2: "2024-06-01",
  };

  return deprecationDates[version] || "Unknown";
};

/**
 * Get sunset date for a version (you can customize this logic)
 */
const getSunsetDate = (version: string): string => {
  // Example logic - usually 6-12 months after deprecation
  const sunsetDates: Record<string, string> = {
    v1: "2024-07-01",
    v2: "2024-12-01",
  };

  return sunsetDates[version] || "Unknown";
};

/**
 * Middleware to enforce minimum API version
 */
export const minimumVersionMiddleware = (minimumVersion: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const apiVersion = (req as any).apiVersion;
    const requestedVersionNumber = parseInt(apiVersion.replace("v", ""), 10);
    const minimumVersionNumber = parseInt(minimumVersion.replace("v", ""), 10);

    if (requestedVersionNumber < minimumVersionNumber) {
      logger.warn("API version below minimum", {
        apiVersion,
        minimumVersion,
        path: req.path,
        ip: req.ip,
      });

      const error = new AppError(
        `API version ${apiVersion} is below minimum required version ${minimumVersion}`,
        400,
        true,
        "VERSION_BELOW_MINIMUM"
      );

      return next(error);
    }

    next();
  };
};

/**
 * Middleware to handle version-specific feature flags
 */
export const featureFlagMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const apiVersion = (req as any).apiVersion;

  // Add feature flags based on version
  (req as any).features = getVersionFeatures(apiVersion);

  next();
};

/**
 * Get available features for a specific API version
 */
const getVersionFeatures = (version: string): Record<string, boolean> => {
  const versionFeatures: Record<string, Record<string, boolean>> = {
    v1: {
      advancedFiltering: false,
      bulkOperations: false,
      realTimeUpdates: false,
      advancedAuth: false,
    },
    v2: {
      advancedFiltering: true,
      bulkOperations: true,
      realTimeUpdates: true,
      advancedAuth: true,
    },
  };

  return versionFeatures[version] || {};
};

/**
 * Utility function to check if a feature is enabled for the current API version
 */
export const isFeatureEnabled = (req: Request, featureName: string): boolean => {
  const features = (req as any).features || {};
  return features[featureName] === true;
};

/**
 * Middleware to redirect to latest version
 */
export const redirectToLatestMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const apiVersion = (req as any).apiVersion;
  const latestVersion = config.supportedApiVersions[config.supportedApiVersions.length - 1];

  // Only redirect if not already on latest version and client accepts redirects
  if (apiVersion !== latestVersion && req.query.redirect !== "false") {
    const newPath = req.path.replace(`/api/${apiVersion}/`, `/api/${latestVersion}/`);
    
    logger.info("Redirecting to latest API version", {
      fromVersion: apiVersion,
      toVersion: latestVersion,
      originalPath: req.path,
      newPath,
    });

    return res.redirect(301, newPath);
  }

  next();
};

/**
 * Get API version statistics
 */
export const getVersionStats = (): Record<string, any> => {
  // This would typically be stored in a database or cache
  // For now, return mock data
  return {
    supportedVersions: config.supportedApiVersions,
    defaultVersion: config.defaultApiVersion,
    deprecatedVersions: ["v1"], // Example
    usage: {
      v1: { requests: 1000, percentage: 20 },
      v2: { requests: 4000, percentage: 80 },
    },
    lastUpdated: new Date().toISOString(),
  };
};
