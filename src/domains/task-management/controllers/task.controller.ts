import type { Response, NextFunction } from "express"
import { asyncHandler } from "../utils/async-handler"
import { successResponse } from "../utils/response-formatter"
import { taskService } from "../services"
import type { AuthRequest } from "../middleware/auth"
import { TaskStatus } from "../services/task.service"
import type { Express } from "express"
import { ValidationError } from "../services/base.service"

/**
 * @desc    Get all tasks for the authenticated user
 * @route   GET /api/v1/tasks
 * @access  Private
 */
export const getTasks = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const result = await taskService.getTasks(req.query, req.query, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, result.data, "Tasks retrieved successfully", {
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
  })
})

/**
 * @desc    Create a new task
 * @route   POST /api/v1/tasks
 * @access  Private
 */
export const createTask = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const task = await taskService.createTask(req.body, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 201, task, "Task created successfully")
})

/**
 * @desc    Get a task by ID
 * @route   GET /api/v1/tasks/:id
 * @access  Private
 */
export const getTask = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const taskId = req.params.id
  const task = await taskService.getTaskById(taskId, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, task, "Task retrieved successfully")
})

/**
 * @desc    Update a task
 * @route   PUT /api/v1/tasks/:id
 * @access  Private
 */
export const updateTask = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const taskId = req.params.id
  const task = await taskService.updateTask(taskId, req.body, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, task, "Task updated successfully")
})

/**
 * @desc    Delete a task
 * @route   DELETE /api/v1/tasks/:id
 * @access  Private
 */
export const deleteTask = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const taskId = req.params.id
  await taskService.deleteTask(taskId, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, {}, "Task deleted successfully")
})

/**
 * @desc    Get task analytics
 * @route   GET /api/v1/tasks/analytics
 * @access  Private
 */
export const getTaskAnalytics = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const analytics = await taskService.getTaskStats(req.query, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, analytics, "Task analytics retrieved successfully")
})

/**
 * @desc    Get task statistics
 * @route   GET /api/v1/tasks/stats
 * @access  Private
 */
export const getTaskStats = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const stats = await taskService.getTaskStats(req.query, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, stats, "Task statistics retrieved successfully")
})

/**
 * @desc    Get task overview analytics
 * @route   GET /api/v1/tasks/overview
 * @access  Private
 */
export const getTaskOverview = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const period = (req.query.period as "week" | "month" | "year") || "week"

  // Validate period
  if (!["week", "month", "year"].includes(period)) {
    throw new ValidationError("Period must be one of: week, month, year")
  }

  // For now, we'll use the existing getTaskStats method
  // In a real implementation, you might have a separate analytics method
  const analytics = await taskService.getTaskStats(req.query, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, analytics, "Task overview retrieved successfully")
})

/**
 * @desc    Update task status
 * @route   PATCH /api/v1/tasks/:id/status
 * @access  Private
 */
export const updateTaskStatus = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const taskId = req.params.id
  const { status } = req.body

  if (!status || !Object.values(TaskStatus).includes(status)) {
    throw new ValidationError(`Status must be one of: ${Object.values(TaskStatus).join(", ")}`)
  }

  const task = await taskService.updateTask(taskId, { status }, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, task, "Task status updated successfully")
})

/**
 * @desc    Update task priority
 * @route   PATCH /api/v1/tasks/:id/priority
 * @access  Private
 */
export const updateTaskPriority = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const taskId = req.params.id
  const { priority } = req.body

  if (!priority || !['low', 'medium', 'high', 'urgent'].includes(priority)) {
    throw new ValidationError("Priority must be one of: low, medium, high, urgent")
  }

  const task = await taskService.updateTask(taskId, { priority }, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, task, "Task priority updated successfully")
})

/**
 * @desc    Add attachment to a task
 * @route   POST /api/v1/tasks/:id/attachments
 * @access  Private
 */
export const addTaskAttachment = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const taskId = req.params.id
  const file = req.file as Express.Multer.File

  if (!file) {
    throw new ValidationError("No file uploaded")
  }

  const attachment = {
    filename: file.originalname,
    path: file.path,
    mimetype: file.mimetype,
    size: file.size,
  }

  // For now, we'll update the task with attachment info
  // In a real implementation, you might have a separate attachment service
  const task = await taskService.updateTask(taskId, {
    // Add attachment to task tags or description for now
    tags: [`attachment:${attachment.filename}`]
  }, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, task, "Attachment added successfully")
})

/**
 * @desc    Remove attachment from a task
 * @route   DELETE /api/v1/tasks/:id/attachments/:attachmentId
 * @access  Private
 */
export const removeTaskAttachment = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const taskId = req.params.id
  const attachmentId = req.params.attachmentId

  // For now, we'll update the task to remove attachment
  // In a real implementation, you might have a separate attachment service
  const task = await taskService.updateTask(taskId, {
    // Remove attachment tags for now
    tags: []
  }, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, task, "Attachment removed successfully")
})

/**
 * @desc    Bulk update task status
 * @route   PATCH /api/v1/tasks/bulk-update
 * @access  Private
 */
export const bulkUpdateTaskStatus = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const { taskIds, status } = req.body

  if (!taskIds || !Array.isArray(taskIds) || !taskIds.length) {
    throw new ValidationError("Task IDs are required and must be an array")
  }

  if (!status || !Object.values(TaskStatus).includes(status)) {
    throw new ValidationError(`Status must be one of: ${Object.values(TaskStatus).join(", ")}`)
  }

  const result = await taskService.bulkUpdateTasks({
    taskIds,
    operation: 'update_status',
    data: { status }
  }, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, result, `${result.updated} tasks updated successfully`)
})

/**
 * @desc    Bulk assign tasks
 * @route   PATCH /api/v1/tasks/bulk-assign
 * @access  Private
 */
export const bulkAssignTasks = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const { taskIds, assigneeId } = req.body

  if (!taskIds || !Array.isArray(taskIds) || !taskIds.length) {
    throw new ValidationError("Task IDs are required and must be an array")
  }

  if (!assigneeId) {
    throw new ValidationError("Assignee ID is required")
  }

  const result = await taskService.bulkUpdateTasks({
    taskIds,
    operation: 'assign',
    data: { assigneeId }
  }, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, result, `${result.updated} tasks assigned successfully`)
})

/**
 * @desc    Bulk move tasks to project
 * @route   PATCH /api/v1/tasks/bulk-move
 * @access  Private
 */
export const bulkMoveTasks = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const { taskIds, projectId } = req.body

  if (!taskIds || !Array.isArray(taskIds) || !taskIds.length) {
    throw new ValidationError("Task IDs are required and must be an array")
  }

  const result = await taskService.bulkUpdateTasks({
    taskIds,
    operation: 'move_project',
    data: { projectId }
  }, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, result, `${result.updated} tasks moved successfully`)
})

/**
 * @desc    Bulk delete tasks
 * @route   DELETE /api/v1/tasks/bulk-delete
 * @access  Private
 */
export const bulkDeleteTasks = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const { taskIds } = req.body

  if (!taskIds || !Array.isArray(taskIds) || !taskIds.length) {
    throw new ValidationError("Task IDs are required and must be an array")
  }

  const result = await taskService.bulkUpdateTasks({
    taskIds,
    operation: 'delete',
    data: {}
  }, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, result, `${result.updated} tasks deleted successfully`)
})
