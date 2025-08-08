import type { Request, Response } from "express"
import { asyncHandler } from "../utils/async-handler"
import { responseFormatter } from "../utils/response-formatter"
import { taskTemplateService } from "../services"
import type { AuthRequest } from "../middleware/auth"

/**
 * Create a new task template
 * @route POST /api/v1/task-templates
 * @access Private
 */
export const createTaskTemplate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const taskTemplate = await taskTemplateService.createTaskTemplate(req.body, {
    userId,
    timestamp: new Date()
  })
  return responseFormatter(res, 201, "Task template created successfully", taskTemplate)
})

/**
 * Get all task templates for the authenticated user
 * @route GET /api/v1/task-templates
 * @access Private
 */
export const getTaskTemplates = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const result = await taskTemplateService.getTaskTemplates(req.query, req.query, {
    userId,
    timestamp: new Date()
  })
  return responseFormatter(res, 200, "Task templates retrieved successfully", result.data, {
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
  })
})

/**
 * Get a task template by ID
 * @route GET /api/v1/task-templates/:id
 * @access Private
 */
export const getTaskTemplateById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const templateId = req.params.id
  const taskTemplate = await taskTemplateService.getTaskTemplateById(templateId, {
    userId,
    timestamp: new Date()
  })
  return responseFormatter(res, 200, "Task template retrieved successfully", taskTemplate)
})

/**
 * Update a task template
 * @route PUT /api/v1/task-templates/:id
 * @access Private
 */
export const updateTaskTemplate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const templateId = req.params.id
  const taskTemplate = await taskTemplateService.updateTaskTemplate(templateId, req.body, {
    userId,
    timestamp: new Date()
  })
  return responseFormatter(res, 200, "Task template updated successfully", taskTemplate)
})

/**
 * Delete a task template
 * @route DELETE /api/v1/task-templates/:id
 * @access Private
 */
export const deleteTaskTemplate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const templateId = req.params.id
  await taskTemplateService.deleteTaskTemplate(templateId, {
    userId,
    timestamp: new Date()
  })
  return responseFormatter(res, 200, "Task template deleted successfully", null)
})

/**
 * Create a task from a template
 * @route POST /api/v1/task-templates/:id/create-task
 * @access Private
 */
export const createTaskFromTemplate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const templateId = req.params.id
  const task = await taskTemplateService.createTaskFromTemplate(templateId, req.body, {
    userId,
    timestamp: new Date()
  })
  return responseFormatter(res, 201, "Task created from template successfully", task)
})

/**
 * Duplicate a task template
 * @route POST /api/v1/task-templates/:id/duplicate
 * @access Private
 */
export const duplicateTaskTemplate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const templateId = req.params.id
  const duplicatedTemplate = await taskTemplateService.duplicateTemplate(templateId, {
    userId,
    timestamp: new Date()
  })
  return responseFormatter(res, 201, "Task template duplicated successfully", duplicatedTemplate)
})

/**
 * Get task template categories
 * @route GET /api/v1/task-templates/categories
 * @access Private
 */
export const getTaskTemplateCategories = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const categories = await taskTemplateService.getTemplateCategories({
    userId,
    timestamp: new Date()
  })
  return responseFormatter(res, 200, "Task template categories retrieved successfully", categories)
})

/**
 * Get public task templates
 * @route GET /api/v1/task-templates/public
 * @access Private
 */
export const getPublicTaskTemplates = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const result = await taskTemplateService.getPublicTemplates(req.query, {
    userId,
    timestamp: new Date()
  })
  return responseFormatter(res, 200, "Public task templates retrieved successfully", result.data, {
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
  })
})

/**
 * Get task template statistics
 * @route GET /api/v1/task-templates/stats
 * @access Private
 */
export const getTaskTemplateStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const stats = await taskTemplateService.getTaskTemplateStats(req.query, {
    userId,
    timestamp: new Date()
  })
  return responseFormatter(res, 200, "Task template statistics retrieved successfully", stats)
})
