import type { Request, Response } from "express"
import { asyncHandler } from "../utils/async-handler"
import { responseFormatter } from "../utils/response-formatter"
import { recurringTaskService } from "../services"
import type { AuthRequest } from "../middleware/auth"

/**
 * Create a new recurring task
 * @route POST /api/v1/recurring-tasks
 * @access Private
 */
export const createRecurringTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const recurringTask = await recurringTaskService.createRecurringTask(req.body, {
    userId,
    timestamp: new Date()
  })
  return responseFormatter(res, 201, "Recurring task created successfully", recurringTask)
})

/**
 * Get all recurring tasks for the authenticated user
 * @route GET /api/v1/recurring-tasks
 * @access Private
 */
export const getRecurringTasks = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const result = await recurringTaskService.getRecurringTasks(req.query, req.query, {
    userId,
    timestamp: new Date()
  })
  return responseFormatter(res, 200, "Recurring tasks retrieved successfully", result.data, {
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
  })
})

/**
 * Get a recurring task by ID
 * @route GET /api/v1/recurring-tasks/:id
 * @access Private
 */
export const getRecurringTaskById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const recurringTaskId = req.params.id
  const recurringTask = await recurringTaskService.getRecurringTaskById(recurringTaskId, {
    userId,
    timestamp: new Date()
  })
  return responseFormatter(res, 200, "Recurring task retrieved successfully", recurringTask)
})

/**
 * Update a recurring task
 * @route PUT /api/v1/recurring-tasks/:id
 * @access Private
 */
export const updateRecurringTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const recurringTaskId = req.params.id
  const recurringTask = await recurringTaskService.updateRecurringTask(recurringTaskId, req.body, {
    userId,
    timestamp: new Date()
  })
  return responseFormatter(res, 200, "Recurring task updated successfully", recurringTask)
})

/**
 * Delete a recurring task
 * @route DELETE /api/v1/recurring-tasks/:id
 * @access Private
 */
export const deleteRecurringTask = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const recurringTaskId = req.params.id
  await recurringTaskService.deleteRecurringTask(recurringTaskId, {
    userId,
    timestamp: new Date()
  })
  return responseFormatter(res, 200, "Recurring task deleted successfully", null)
})

/**
 * Toggle recurring task active status
 * @route PATCH /api/v1/recurring-tasks/:id/toggle-active
 * @access Private
 */
export const toggleRecurringTaskActive = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const recurringTaskId = req.params.id
  const recurringTask = await recurringTaskService.toggleRecurringTaskActive(recurringTaskId, {
    userId,
    timestamp: new Date()
  })
  return responseFormatter(res, 200, "Recurring task status toggled successfully", recurringTask)
})

/**
 * Get recurring task statistics
 * @route GET /api/v1/recurring-tasks/stats
 * @access Private
 */
export const getRecurringTaskStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const stats = await recurringTaskService.getRecurringTaskStats(req.query, {
    userId,
    timestamp: new Date()
  })
  return responseFormatter(res, 200, "Recurring task statistics retrieved successfully", stats)
})

/**
 * Process recurring tasks (Admin only)
 * @route POST /api/v1/recurring-tasks/process
 * @access Private (Admin)
 */
export const processRecurringTasks = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id
  const userRole = req.user!.role
  
  if (userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: "Only administrators can process recurring tasks"
    })
  }

  const result = await recurringTaskService.processRecurringTasks({
    userId,
    userRole,
    timestamp: new Date()
  })
  return responseFormatter(res, 200, "Recurring tasks processed successfully", result)
})
