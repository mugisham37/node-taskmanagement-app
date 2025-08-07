import type { Request, Response, NextFunction } from "express";
import logger from "../config/logger";
import config from "../config/environment";
import { db } from "../db/connection";
import { auditLogs, type AuditAction } from "../db/schema/audit-logs";
import { AuthRequest } from "./auth";

/**
 * Create audit log entry using Drizzle ORM
 */
export const createAuditLog = async (data: {
  userId?: string;
  userEmail?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValues?: any;
  newValues?: any;
  changes?: any;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> => {
  try {
    if (config.enableAuditLog !== "true") {
      return;
    }

    await db.insert(auditLogs).values({
      userId: data.userId || null,
      userEmail: data.userEmail || null,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      oldValues: data.oldValues || null,
      newValues: data.newValues || null,
      changes: data.changes || null,
      metadata: data.metadata || {},
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
    });

    logger.debug("Audit log created", {
      userId: data.userId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
    });
  } catch (error) {
    logger.error("Failed to create audit log:", error);
  }
};

export interface AuditLogOptions {
  action: string;
  resource: string;
  getResourceId?: (req: Request) => string | undefined;
  getDetails?: (req: Request) => any;
  skipCondition?: (req: Request) => boolean;
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
  sensitiveFields?: string[];
  logLevel?: "debug" | "info" | "warn" | "error";
}

/**
 * Enhanced middleware to log audit events
 */
export const auditLogMiddleware = (options: AuditLogOptions) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    // Skip if condition is met
    if (options.skipCondition && options.skipCondition(req)) {
      return next();
    }

    // Skip if audit logging is disabled
    if (config.enableAuditLog !== "true") {
      return next();
    }

    // Store original end method
    const originalEnd = res.end;
    const chunks: Buffer[] = [];

    // Override end method to capture response
    res.end = function (chunk?: any, encoding?: any, cb?: any): any {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      // Create audit log after response is sent
      setImmediate(async () => {
        try {
          await logAuditEntry(req, res, options, chunks, res.statusCode);
        } catch (error) {
          logger.error("Error in audit log middleware:", error);
        }
      });

      // Call original end method
      return originalEnd.call(this, chunk, encoding, cb);
    };

    next();
  };
};

/**
 * Create audit log entry
 */
const logAuditEntry = async (
  req: AuthRequest,
  res: Response,
  options: AuditLogOptions,
  responseChunks: Buffer[],
  statusCode: number
) => {
  const user = req.user;
  const userId = user?.id;

  // Get additional details if provided
  let details: any = {};
  if (options.getDetails) {
    details = options.getDetails(req);
  }

  // Include request body if specified
  if (options.includeRequestBody && req.body) {
    details.requestBody = sanitizeData(req.body, options.sensitiveFields);
  }

  // Include response body if specified
  if (options.includeResponseBody && responseChunks.length > 0) {
    try {
      const responseBody = Buffer.concat(responseChunks).toString();
      const parsedResponse = JSON.parse(responseBody);
      details.responseBody = sanitizeData(parsedResponse, options.sensitiveFields);
    } catch (error) {
      // Response is not JSON, skip including it
    }
  }

  // Add request metadata
  details.method = req.method;
  details.url = req.originalUrl;
  details.statusCode = statusCode;
  details.userAgent = req.get("User-Agent");
  details.ip = req.ip;
  details.timestamp = new Date().toISOString();

  // Get resource ID
  const resourceId = options.getResourceId ? options.getResourceId(req) : extractResourceId(req);

  // Determine success status
  const status = statusCode >= 200 && statusCode < 400 ? "success" : "failure";

  // Create audit log entry
  await createAuditLog({
    userId,
    userEmail: user?.email,
    action: options.action.toUpperCase() as AuditAction,
    entityType: options.resource,
    entityId: resourceId || "unknown",
    metadata: details,
    ipAddress: req.ip,
    userAgent: req.get("User-Agent"),
  });

  // Log based on specified level
  const logLevel = options.logLevel || "info";
  if (logLevel in logger) {
    (logger as any)[logLevel]("Audit log entry created", {
      userId,
      action: options.action,
      entityType: options.resource,
      entityId: resourceId,
      statusCode,
    });
  }
};

/**
 * Extract resource ID from request parameters
 */
const extractResourceId = (req: Request): string | undefined => {
  // Try common parameter names
  const idParams = ["id", "taskId", "projectId", "teamId", "workspaceId", "userId"];

  for (const param of idParams) {
    if (req.params[param]) {
      return req.params[param];
    }
  }

  return undefined;
};

/**
 * Remove sensitive data from objects
 */
const sanitizeData = (data: any, sensitiveFields: string[] = []): any => {
  if (!data || typeof data !== "object") {
    return data;
  }

  const defaultSensitiveFields = [
    "password",
    "passwordHash",
    "token",
    "refreshToken",
    "secret",
    "apiKey",
    "privateKey",
    "accessToken",
    "sessionId",
    "creditCard",
    "ssn",
    "socialSecurityNumber",
  ];

  const allSensitiveFields = [...defaultSensitiveFields, ...sensitiveFields];

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item, sensitiveFields));
  }

  const sanitized: any = {};

  for (const [key, value] of Object.entries(data)) {
    if (allSensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeData(value, sensitiveFields);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

/**
 * Predefined audit log middleware for common actions
 */

export const auditCreate = (resource: string, getDetails?: (req: Request) => any) =>
  auditLogMiddleware({
    action: "create",
    resource,
    getDetails,
    includeRequestBody: true,
    logLevel: "info",
  });

export const auditUpdate = (resource: string, getDetails?: (req: Request) => any) =>
  auditLogMiddleware({
    action: "update",
    resource,
    getDetails,
    includeRequestBody: true,
    logLevel: "info",
  });

export const auditDelete = (resource: string, getDetails?: (req: Request) => any) =>
  auditLogMiddleware({
    action: "delete",
    resource,
    getDetails,
    logLevel: "warn",
  });

export const auditView = (resource: string, getDetails?: (req: Request) => any) =>
  auditLogMiddleware({
    action: "view",
    resource,
    getDetails,
    skipCondition: (req) => req.method === "GET" && req.query.skipAudit === "true",
    logLevel: "debug",
  });

export const auditExport = (resource: string, getDetails?: (req: Request) => any) =>
  auditLogMiddleware({
    action: "export",
    resource,
    getDetails,
    includeRequestBody: true,
    logLevel: "warn",
  });

export const auditImport = (resource: string, getDetails?: (req: Request) => any) =>
  auditLogMiddleware({
    action: "import",
    resource,
    getDetails,
    includeRequestBody: true,
    logLevel: "warn",
  });

export const auditLogin = () =>
  auditLogMiddleware({
    action: "login",
    resource: "auth",
    getDetails: (req) => ({
      email: req.body.email,
      loginMethod: "email",
      userAgent: req.get("User-Agent"),
      ip: req.ip,
    }),
    sensitiveFields: ["password"],
    logLevel: "info",
  });

export const auditLogout = () =>
  auditLogMiddleware({
    action: "logout",
    resource: "auth",
    logLevel: "info",
  });

export const auditPasswordChange = () =>
  auditLogMiddleware({
    action: "password_change",
    resource: "auth",
    sensitiveFields: ["currentPassword", "newPassword", "confirmPassword"],
    logLevel: "warn",
  });

export const auditPermissionChange = (getDetails?: (req: Request) => any) =>
  auditLogMiddleware({
    action: "permission_change",
    resource: "user",
    getDetails,
    includeRequestBody: true,
    logLevel: "warn",
  });

export const auditDataAccess = (resource: string, getDetails?: (req: Request) => any) =>
  auditLogMiddleware({
    action: "data_access",
    resource,
    getDetails,
    skipCondition: (req) => req.method === "GET" && req.query.skipAudit === "true",
    logLevel: "debug",
  });

export const auditBulkOperation = (resource: string, getDetails?: (req: Request) => any) =>
  auditLogMiddleware({
    action: "bulk_operation",
    resource,
    getDetails,
    includeRequestBody: true,
    logLevel: "warn",
  });

export const auditConfigChange = (getDetails?: (req: Request) => any) =>
  auditLogMiddleware({
    action: "config_change",
    resource: "system",
    getDetails,
    includeRequestBody: true,
    logLevel: "error",
  });

export const auditFileUpload = (getDetails?: (req: Request) => any) =>
  auditLogMiddleware({
    action: "file_upload",
    resource: "file",
    getDetails: (req) => {
      const file = req.file as Express.Multer.File;
      const files = req.files as Express.Multer.File[];

      let fileInfo = {};

      if (file) {
        fileInfo = {
          filename: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          destination: file.destination,
        };
      } else if (files && files.length > 0) {
        fileInfo = {
          files: files.map((f) => ({
            filename: f.originalname,
            size: f.size,
            mimetype: f.mimetype,
            destination: f.destination,
          })),
        };
      }

      return {
        ...fileInfo,
        ...(getDetails ? getDetails(req) : {}),
      };
    },
    logLevel: "info",
  });

export const auditFileDownload = (getDetails?: (req: Request) => any) =>
  auditLogMiddleware({
    action: "file_download",
    resource: "file",
    getDetails,
    logLevel: "info",
  });

export const auditApiAccess = (getDetails?: (req: Request) => any) =>
  auditLogMiddleware({
    action: "api_access",
    resource: "api",
    getDetails: (req) => ({
      endpoint: req.originalUrl,
      method: req.method,
      apiVersion: (req as any).apiVersion,
      ...(getDetails ? getDetails(req) : {}),
    }),
    skipCondition: (req) => req.originalUrl.includes("/health"),
    logLevel: "debug",
  });

export const auditSecurityEvent = (eventType: string, getDetails?: (req: Request) => any) =>
  auditLogMiddleware({
    action: "security_event",
    resource: "security",
    getDetails: (req) => ({
      eventType,
      ...(getDetails ? getDetails(req) : {}),
    }),
    logLevel: "error",
  });

export const auditComplianceEvent = (eventType: string, getDetails?: (req: Request) => any) =>
  auditLogMiddleware({
    action: "compliance_event",
    resource: "compliance",
    getDetails: (req) => ({
      eventType,
      ...(getDetails ? getDetails(req) : {}),
    }),
    logLevel: "warn",
  });
