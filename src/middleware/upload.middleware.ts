import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import type { Request } from "express";
import { BadRequestError } from "../utils/app-error";
import config from "../config/environment";
import logger from "../config/logger";

// Ensure upload directories exist
const ensureUploadDirs = () => {
  const dirs = [
    "uploads/attachments",
    "uploads/avatars",
    "uploads/feedback",
    "uploads/temp",
    "uploads/exports",
    "uploads/imports",
    "uploads/documents",
    "uploads/images",
    "uploads/archives",
  ];

  dirs.forEach((dir) => {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });
};

// Initialize upload directories
ensureUploadDirs();

// File type configurations
const FILE_TYPES = {
  images: {
    mimeTypes: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "image/bmp",
      "image/tiff",
    ],
    maxSize: 10 * 1024 * 1024, // 10MB
    extensions: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".tiff"],
  },
  documents: {
    mimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
      "application/rtf",
      "application/vnd.oasis.opendocument.text",
      "application/vnd.oasis.opendocument.spreadsheet",
      "application/vnd.oasis.opendocument.presentation",
    ],
    maxSize: 50 * 1024 * 1024, // 50MB
    extensions: [
      ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
      ".txt", ".csv", ".rtf", ".odt", ".ods", ".odp",
    ],
  },
  archives: {
    mimeTypes: [
      "application/zip",
      "application/x-zip-compressed",
      "application/x-rar-compressed",
      "application/x-7z-compressed",
      "application/gzip",
      "application/x-tar",
    ],
    maxSize: 100 * 1024 * 1024, // 100MB
    extensions: [".zip", ".rar", ".7z", ".gz", ".tar"],
  },
  audio: {
    mimeTypes: [
      "audio/mpeg",
      "audio/wav",
      "audio/ogg",
      "audio/mp4",
      "audio/webm",
    ],
    maxSize: 25 * 1024 * 1024, // 25MB
    extensions: [".mp3", ".wav", ".ogg", ".m4a", ".webm"],
  },
  video: {
    mimeTypes: [
      "video/mp4",
      "video/webm",
      "video/ogg",
      "video/avi",
      "video/mov",
      "video/wmv",
    ],
    maxSize: 200 * 1024 * 1024, // 200MB
    extensions: [".mp4", ".webm", ".ogg", ".avi", ".mov", ".wmv"],
  },
};

// Get all allowed types
const ALL_ALLOWED_TYPES = Object.values(FILE_TYPES).flatMap((type) => type.mimeTypes);
const ALL_ALLOWED_EXTENSIONS = Object.values(FILE_TYPES).flatMap((type) => type.extensions);

/**
 * Enhanced storage configuration with better security
 */
const createEnhancedStorage = (destination: string, options?: {
  preserveOriginalName?: boolean;
  addTimestamp?: boolean;
  addUserId?: boolean;
}) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(process.cwd(), "uploads", destination);
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      try {
        const ext = path.extname(file.originalname).toLowerCase();
        const baseName = path.basename(file.originalname, ext);
        
        // Sanitize filename
        const sanitizedBaseName = baseName
          .replace(/[^a-zA-Z0-9\-_]/g, "_")
          .substring(0, 50);

        let filename = sanitizedBaseName;

        // Add user ID if requested and available
        if (options?.addUserId && (req as any).user?.id) {
          filename = `${(req as any).user.id}_${filename}`;
        }

        // Add timestamp if requested
        if (options?.addTimestamp !== false) {
          const timestamp = Date.now();
          filename = `${filename}_${timestamp}`;
        }

        // Add random suffix for uniqueness
        const randomSuffix = crypto.randomBytes(8).toString("hex");
        filename = `${filename}_${randomSuffix}${ext}`;

        cb(null, filename);
      } catch (error) {
        cb(error as Error, "");
      }
    },
  });
};

/**
 * Enhanced file filter with better security checks
 */
const createEnhancedFileFilter = (
  allowedTypes: string[],
  allowedExtensions?: string[],
  customValidation?: (file: Express.Multer.File) => boolean
) => {
  return (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    try {
      // Check MIME type
      if (!allowedTypes.includes(file.mimetype)) {
        return cb(
          new BadRequestError(
            `File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(", ")}`
          )
        );
      }

      // Check file extension
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowedExtensions && !allowedExtensions.includes(ext)) {
        return cb(
          new BadRequestError(
            `File extension ${ext} is not allowed. Allowed extensions: ${allowedExtensions.join(", ")}`
          )
        );
      }

      // Check for dangerous file names
      const dangerousPatterns = [
        /\.exe$/i,
        /\.bat$/i,
        /\.cmd$/i,
        /\.scr$/i,
        /\.pif$/i,
        /\.com$/i,
        /\.vbs$/i,
        /\.js$/i,
        /\.jar$/i,
        /\.php$/i,
        /\.asp$/i,
        /\.jsp$/i,
      ];

      if (dangerousPatterns.some((pattern) => pattern.test(file.originalname))) {
        return cb(new BadRequestError("File type is potentially dangerous and not allowed"));
      }

      // Custom validation
      if (customValidation && !customValidation(file)) {
        return cb(new BadRequestError("File failed custom validation"));
      }

      cb(null, true);
    } catch (error) {
      cb(error as Error);
    }
  };
};

/**
 * Avatar upload middleware
 */
export const avatarUpload = multer({
  storage: createEnhancedStorage("avatars", { addUserId: true }),
  limits: {
    fileSize: FILE_TYPES.images.maxSize,
    files: 1,
  },
  fileFilter: createEnhancedFileFilter(
    FILE_TYPES.images.mimeTypes,
    FILE_TYPES.images.extensions,
    (file) => {
      // Additional validation for avatars
      return file.size <= 5 * 1024 * 1024; // 5MB max for avatars
    }
  ),
});

/**
 * Document upload middleware
 */
export const documentUpload = multer({
  storage: createEnhancedStorage("documents"),
  limits: {
    fileSize: FILE_TYPES.documents.maxSize,
    files: 10,
  },
  fileFilter: createEnhancedFileFilter(
    FILE_TYPES.documents.mimeTypes,
    FILE_TYPES.documents.extensions
  ),
});

/**
 * Attachment upload middleware (supports multiple file types)
 */
export const attachmentUpload = multer({
  storage: createEnhancedStorage("attachments"),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10,
  },
  fileFilter: createEnhancedFileFilter(ALL_ALLOWED_TYPES, ALL_ALLOWED_EXTENSIONS),
});

/**
 * Feedback upload middleware (for screenshots and attachments)
 */
export const feedbackUpload = multer({
  storage: createEnhancedStorage("feedback"),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
    files: 5,
  },
  fileFilter: createEnhancedFileFilter([
    ...FILE_TYPES.images.mimeTypes,
    ...FILE_TYPES.documents.mimeTypes,
  ]),
});

/**
 * Import file upload middleware
 */
export const importUpload = multer({
  storage: createEnhancedStorage("imports"),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 1,
  },
  fileFilter: createEnhancedFileFilter([
    "text/csv",
    "application/json",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/xml",
    "text/xml",
  ]),
});

/**
 * Archive upload middleware
 */
export const archiveUpload = multer({
  storage: createEnhancedStorage("archives"),
  limits: {
    fileSize: FILE_TYPES.archives.maxSize,
    files: 1,
  },
  fileFilter: createEnhancedFileFilter(
    FILE_TYPES.archives.mimeTypes,
    FILE_TYPES.archives.extensions
  ),
});

/**
 * Memory storage for temporary processing
 */
export const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
  fileFilter: createEnhancedFileFilter(ALL_ALLOWED_TYPES, ALL_ALLOWED_EXTENSIONS),
});

/**
 * General upload middleware
 */
export const upload = multer({
  storage: createEnhancedStorage("temp"),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10,
  },
  fileFilter: createEnhancedFileFilter(ALL_ALLOWED_TYPES, ALL_ALLOWED_EXTENSIONS),
});

/**
 * Create custom upload middleware with enhanced options
 */
export const createUploadMiddleware = (options: {
  destination: string;
  allowedTypes: string[];
  allowedExtensions?: string[];
  maxFileSize: number;
  maxFiles: number;
  preserveOriginalName?: boolean;
  addTimestamp?: boolean;
  addUserId?: boolean;
  customValidation?: (file: Express.Multer.File) => boolean;
}) => {
  return multer({
    storage: createEnhancedStorage(options.destination, {
      preserveOriginalName: options.preserveOriginalName,
      addTimestamp: options.addTimestamp,
      addUserId: options.addUserId,
    }),
    limits: {
      fileSize: options.maxFileSize,
      files: options.maxFiles,
    },
    fileFilter: createEnhancedFileFilter(
      options.allowedTypes,
      options.allowedExtensions,
      options.customValidation
    ),
  });
};

/**
 * File validation middleware (to be used after multer)
 */
export const validateUploadedFiles = async (req: Request, res: any, next: any) => {
  const files = req.files as Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
  const file = req.file as Express.Multer.File;

  try {
    // Validate single file
    if (file) {
      await validateSingleFile(file);
    }

    // Validate multiple files
    if (files) {
      if (Array.isArray(files)) {
        await Promise.all(files.map(validateSingleFile));
      } else {
        const allFiles = Object.values(files).flat();
        await Promise.all(allFiles.map(validateSingleFile));
      }
    }

    next();
  } catch (error) {
    // Cleanup uploaded files on validation error
    if (file) cleanupFile(file.path);
    if (files) {
      const filesToCleanup = Array.isArray(files) ? files : Object.values(files).flat();
      filesToCleanup.forEach((f) => cleanupFile(f.path));
    }

    next(error);
  }
};

/**
 * Enhanced file validation
 */
const validateSingleFile = async (file: Express.Multer.File): Promise<void> => {
  // Check if file exists
  if (!fs.existsSync(file.path)) {
    throw new BadRequestError("Uploaded file not found");
  }

  // Check file size matches
  const stats = fs.statSync(file.path);
  if (stats.size !== file.size) {
    throw new BadRequestError("File size mismatch");
  }

  // Check for empty files
  if (stats.size === 0) {
    throw new BadRequestError("Empty files are not allowed");
  }

  // Additional security checks
  await performSecurityChecks(file);

  logger.debug("File validation passed", {
    filename: file.filename,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
  });
};

/**
 * Perform security checks on uploaded files
 */
const performSecurityChecks = async (file: Express.Multer.File): Promise<void> => {
  // Read first few bytes to check file signature
  const buffer = Buffer.alloc(512);
  const fd = fs.openSync(file.path, "r");
  
  try {
    fs.readSync(fd, buffer, 0, 512, 0);
    
    // Check for common malicious patterns
    const content = buffer.toString("hex");
    
    // Check for executable signatures
    const executableSignatures = [
      "4d5a", // PE executable
      "7f454c46", // ELF executable
      "cafebabe", // Java class file
      "504b0304", // ZIP (could contain executables)
    ];
    
    if (executableSignatures.some((sig) => content.startsWith(sig))) {
      throw new BadRequestError("Executable files are not allowed");
    }
    
    // Check for script content in text files
    if (file.mimetype.startsWith("text/")) {
      const textContent = buffer.toString("utf8");
      const scriptPatterns = [
        /<script/i,
        /javascript:/i,
        /vbscript:/i,
        /onload=/i,
        /onerror=/i,
        /<?php/i,
        /<%/,
      ];
      
      if (scriptPatterns.some((pattern) => pattern.test(textContent))) {
        throw new BadRequestError("Files containing script content are not allowed");
      }
    }
  } finally {
    fs.closeSync(fd);
  }
};

/**
 * File cleanup utility
 */
export const cleanupFile = (filePath: string): void => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.debug("File cleaned up", { filePath });
    }
  } catch (error) {
    logger.error("Error cleaning up file:", { filePath, error });
  }
};

/**
 * Cleanup multiple files
 */
export const cleanupFiles = (filePaths: string[]): void => {
  filePaths.forEach(cleanupFile);
};

/**
 * Enhanced multer error handler
 */
export const handleUploadErrors = (error: any, req: Request, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    let message = "File upload error";
    let statusCode = 400;

    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        message = `File too large. Maximum size is ${formatFileSize(error.field || "unknown")}`;
        break;
      case "LIMIT_FILE_COUNT":
        message = "Too many files uploaded";
        break;
      case "LIMIT_UNEXPECTED_FILE":
        message = `Unexpected file field: ${error.field}`;
        break;
      case "LIMIT_PART_COUNT":
        message = "Too many parts in multipart form";
        break;
      case "LIMIT_FIELD_KEY":
        message = "Field name too long";
        break;
      case "LIMIT_FIELD_VALUE":
        message = "Field value too long";
        break;
      case "LIMIT_FIELD_COUNT":
        message = "Too many fields in form";
        break;
      default:
        message = error.message;
    }

    logger.warn("Upload error", {
      code: error.code,
      message: error.message,
      field: error.field,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    return res.status(statusCode).json({
      success: false,
      message,
      error: error.code,
      timestamp: new Date().toISOString(),
    });
  }

  next(error);
};

/**
 * Format file size for error messages
 */
const formatFileSize = (field: string): string => {
  // This is a simplified version - you might want to make this more sophisticated
  return "50MB"; // Default
};

/**
 * Get file URL helper
 */
export const getFileUrl = (filePath: string): string => {
  // Remove the uploads/ prefix and return relative path
  return filePath.replace(/^uploads\//, "");
};

/**
 * Check if file exists
 */
export const fileExists = (filePath: string): boolean => {
  const fullPath = path.join(process.cwd(), "uploads", filePath);
  return fs.existsSync(fullPath);
};

/**
 * Get file info
 */
export const getFileInfo = (filePath: string) => {
  const fullPath = path.join(process.cwd(), "uploads", filePath);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const stats = fs.statSync(fullPath);
  const ext = path.extname(fullPath);
  const name = path.basename(fullPath, ext);

  return {
    name,
    extension: ext,
    size: stats.size,
    createdAt: stats.birthtime,
    modifiedAt: stats.mtime,
    path: filePath,
    isImage: FILE_TYPES.images.extensions.includes(ext.toLowerCase()),
    isDocument: FILE_TYPES.documents.extensions.includes(ext.toLowerCase()),
    isArchive: FILE_TYPES.archives.extensions.includes(ext.toLowerCase()),
  };
};

/**
 * Get file type category
 */
export const getFileTypeCategory = (mimetype: string): string => {
  for (const [category, config] of Object.entries(FILE_TYPES)) {
    if (config.mimeTypes.includes(mimetype)) {
      return category;
    }
  }
  return "unknown";
};

/**
 * Virus scanning placeholder (integrate with actual antivirus solution)
 */
export const scanFileForViruses = async (filePath: string): Promise<boolean> => {
  // This is a placeholder - integrate with actual antivirus solution like ClamAV
  // For now, just return true (clean)
  logger.debug("Virus scan placeholder", { filePath });
  return true;
};

/**
 * File quarantine utility
 */
export const quarantineFile = (filePath: string): void => {
  try {
    const quarantinePath = path.join(process.cwd(), "quarantine");
    if (!fs.existsSync(quarantinePath)) {
      fs.mkdirSync(quarantinePath, { recursive: true });
    }

    const fileName = path.basename(filePath);
    const quarantineFilePath = path.join(quarantinePath, `${Date.now()}_${fileName}`);

    fs.renameSync(filePath, quarantineFilePath);
    logger.warn("File quarantined", { originalPath: filePath, quarantinePath: quarantineFilePath });
  } catch (error) {
    logger.error("Error quarantining file:", { filePath, error });
  }
};
