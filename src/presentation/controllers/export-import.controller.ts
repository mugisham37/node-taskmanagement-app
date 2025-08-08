import type { Request, Response, NextFunction } from "express"
import path from "path"
import fs from "fs"
import multer from "multer"
import { asyncHandler } from "../shared/utils/async-handler"
import { successResponse } from "../shared/utils/response-formatter"
import { dataImportExportService } from "../services"
import type { AuthRequest } from "../shared/middleware/auth"
import { ValidationError } from "../services/base.service"

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "imports")
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    const ext = path.extname(file.originalname)
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`)
  },
})

// Configure multer upload
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = [".csv", ".json"]
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowedExtensions.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error(`Only ${allowedExtensions.join(", ")} files are allowed`))
    }
  },
})

/**
 * @desc    Get available models for export/import
 * @route   GET /api/v1/export-import/models
 * @access  Admin
 */
export const getAvailableModels = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const userRole = req.user?.role as string
  
  const models = await dataImportExportService.getAvailableModels({ 
    userId, 
    userRole,
    timestamp: new Date() 
  })

  successResponse(res, 200, models, "Available models retrieved successfully")
})

/**
 * @desc    Export data
 * @route   POST /api/v1/export-import/export
 * @access  Admin
 */
export const exportData = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const userRole = req.user?.role as string
  const { model, format, query } = req.body

  if (!model) {
    throw new ValidationError("Model is required")
  }

  if (!format || !["csv", "json"].includes(format)) {
    throw new ValidationError("Format must be csv or json")
  }

  const result = await dataImportExportService.exportData(
    { modelName: model, format, filters: query },
    { userId, userRole, timestamp: new Date() }
  )

  // Set headers for file download
  const fileName = path.basename(result.filePath)
  res.setHeader("Content-Disposition", `attachment; filename=${fileName}`)
  res.setHeader("Content-Type", format === "csv" ? "text/csv" : "application/json")

  // Stream file to response
  const fileStream = fs.createReadStream(result.filePath)
  fileStream.pipe(res)
})

/**
 * @desc    Import data
 * @route   POST /api/v1/export-import/import
 * @access  Admin
 */
export const importData = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const userRole = req.user?.role as string

  // Handle file upload
  upload.single("file")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      })
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      })
    }

    const { model, mode, identifierField } = req.body

    if (!model) {
      return res.status(400).json({
        success: false,
        message: "Model is required"
      })
    }

    if (!mode || !["insert", "update", "upsert"].includes(mode)) {
      return res.status(400).json({
        success: false,
        message: "Mode must be insert, update, or upsert"
      })
    }

    try {
      const result = await dataImportExportService.importData(
        req.file.path,
        {
          modelName: model,
          mode,
          identifierField,
        },
        { userId, userRole, timestamp: new Date() }
      )

      // Delete the uploaded file after import
      fs.unlinkSync(req.file.path)

      successResponse(res, 200, result, "Data imported successfully")
    } catch (error: any) {
      // Delete the uploaded file if import fails
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path)
      }

      return res.status(500).json({
        success: false,
        message: error.message
      })
    }
  })
})

/**
 * @desc    Clean up old export files
 * @route   POST /api/v1/export-import/cleanup
 * @access  Admin
 */
export const cleanupExportFiles = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const userRole = req.user?.role as string
  const { maxAge } = req.body
  
  const maxAgeMs = maxAge ? Number(maxAge) * 24 * 60 * 60 * 1000 : undefined
  
  const result = await dataImportExportService.cleanupExportFiles(maxAgeMs, { 
    userId, 
    userRole,
    timestamp: new Date() 
  })

  successResponse(res, 200, result, `Cleaned up ${result.deleted} export files`)
})
