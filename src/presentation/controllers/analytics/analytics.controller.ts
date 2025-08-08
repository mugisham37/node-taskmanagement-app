import type { Request, Response } from "express"
import { asyncHandler } from "../utils/async-handler"
import { responseFormatter } from "../utils/response-formatter"
import { analyticsService } from "../services/analytics.service"
import type { AuthRequest } from "../middleware/auth"

/**
 * Get task analytics
 * @route GET /api/v1/analytics/tasks
 * @access Private
 */
export const getTaskAnalytics = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id as string
  const projectId = req.query.projectId as string | undefined
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined

  const dateRange = startDate && endDate ? { startDate, endDate } : undefined

  const analytics = await analyticsService.getTaskAnalytics(userId, projectId, dateRange, {
    userId,
    timestamp: new Date()
  })
  return responseFormatter(res, 200, "Task analytics retrieved successfully", analytics)
})

/**
 * Get project analytics
 * @route GET /api/v1/analytics/projects
 * @access Private
 */
export const getProjectAnalytics = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id as string
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined

  const dateRange = startDate && endDate ? { startDate, endDate } : undefined

  const analytics = await analyticsService.getProjectAnalytics(userId, dateRange, {
    userId,
    timestamp: new Date()
  })
  return responseFormatter(res, 200, "Project analytics retrieved successfully", analytics)
})

/**
 * Get user productivity analytics
 * @route GET /api/v1/analytics/productivity
 * @access Private
 */
export const getUserProductivityAnalytics = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id as string
  const targetUserId = req.query.userId as string || userId
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined

  const dateRange = startDate && endDate ? { startDate, endDate } : undefined

  const analytics = await analyticsService.getUserProductivityAnalytics(targetUserId, dateRange, {
    userId,
    timestamp: new Date()
  })
  return responseFormatter(res, 200, "User productivity analytics retrieved successfully", analytics)
})

/**
 * Get dashboard analytics
 * @route GET /api/v1/analytics/dashboard
 * @access Private
 */
export const getDashboardAnalytics = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id as string

  const analytics = await analyticsService.getDashboardAnalytics({
    userId,
    timestamp: new Date()
  })
  return responseFormatter(res, 200, "Dashboard analytics retrieved successfully", analytics)
})
