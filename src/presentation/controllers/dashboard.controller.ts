import type { Response, NextFunction } from "express"
import { asyncHandler } from "../utils/async-handler"
import { successResponse } from "../utils/response-formatter"
import { dashboardService } from "../services"
import type { AuthRequest } from "../middleware/auth"

/**
 * @desc    Get system overview
 * @route   GET /api/v1/dashboard/system-overview
 * @access  Admin
 */
export const getSystemOverview = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const userRole = req.user?.role as string
  
  const data = await dashboardService.getSystemOverview({ 
    userId, 
    userRole,
    timestamp: new Date() 
  })

  successResponse(res, 200, data, "System overview retrieved successfully")
})

/**
 * @desc    Get user activity
 * @route   GET /api/v1/dashboard/user-activity
 * @access  Admin
 */
export const getUserActivity = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const userRole = req.user?.role as string
  const days = req.query.days ? Number.parseInt(req.query.days as string, 10) : 30
  
  const data = await dashboardService.getUserActivity(days, { 
    userId, 
    userRole,
    timestamp: new Date() 
  })

  successResponse(res, 200, data, "User activity retrieved successfully")
})

/**
 * @desc    Get task statistics
 * @route   GET /api/v1/dashboard/task-statistics
 * @access  Admin
 */
export const getTaskStatistics = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const userRole = req.user?.role as string
  const days = req.query.days ? Number.parseInt(req.query.days as string, 10) : 30
  
  const data = await dashboardService.getTaskStatistics(days, { 
    userId, 
    userRole,
    timestamp: new Date() 
  })

  successResponse(res, 200, data, "Task statistics retrieved successfully")
})

/**
 * @desc    Get project statistics
 * @route   GET /api/v1/dashboard/project-statistics
 * @access  Admin
 */
export const getProjectStatistics = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const userRole = req.user?.role as string
  const days = req.query.days ? Number.parseInt(req.query.days as string, 10) : 30
  
  const data = await dashboardService.getProjectStatistics(days, { 
    userId, 
    userRole,
    timestamp: new Date() 
  })

  successResponse(res, 200, data, "Project statistics retrieved successfully")
})

/**
 * @desc    Get team and workspace statistics
 * @route   GET /api/v1/dashboard/team-workspace-statistics
 * @access  Admin
 */
export const getTeamWorkspaceStatistics = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const userRole = req.user?.role as string
  
  const data = await dashboardService.getTeamWorkspaceStatistics({ 
    userId, 
    userRole,
    timestamp: new Date() 
  })

  successResponse(res, 200, data, "Team and workspace statistics retrieved successfully")
})

/**
 * @desc    Invalidate dashboard cache
 * @route   POST /api/v1/dashboard/invalidate-cache
 * @access  Admin
 */
export const invalidateDashboardCache = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const userRole = req.user?.role as string
  const key = req.body.key
  
  await dashboardService.invalidateDashboardCache(key, { 
    userId, 
    userRole,
    timestamp: new Date() 
  })

  successResponse(res, 200, {}, "Dashboard cache invalidated successfully")
})
