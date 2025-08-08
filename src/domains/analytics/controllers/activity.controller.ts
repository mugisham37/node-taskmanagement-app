import type { Response, NextFunction } from "express";
import { asyncHandler } from "../utils/async-handler";
import { successResponse } from "../utils/response-formatter";
import { activityService } from "../services";
import type { AuthRequest } from "../middleware/auth";

/**
 * @desc    Get activities for the authenticated user
 * @route   GET /api/v1/activities
 * @access  Private
 */
export const getUserActivities = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const result = await activityService.getUserActivities(userId, req.query, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, result.data, "Activities retrieved successfully", {
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
  });
});

/**
 * @desc    Get activities for a team
 * @route   GET /api/v1/teams/:teamId/activities
 * @access  Private
 */
export const getTeamActivities = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const teamId = req.params.teamId;
  const filters = { ...req.query, teamId };
  const result = await activityService.getActivities(filters, req.query, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, result.data, "Team activities retrieved successfully", {
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
  });
});

/**
 * @desc    Get activities for a workspace
 * @route   GET /api/v1/workspaces/:workspaceId/activities
 * @access  Private
 */
export const getWorkspaceActivities = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const workspaceId = req.params.workspaceId;
  const filters = { ...req.query, workspaceId };
  const result = await activityService.getActivities(filters, req.query, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, result.data, "Workspace activities retrieved successfully", {
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
  });
});

/**
 * @desc    Get activities for a project
 * @route   GET /api/v1/projects/:projectId/activities
 * @access  Private
 */
export const getProjectActivities = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const projectId = req.params.projectId;
  const result = await activityService.getProjectActivities(projectId, req.query, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, result.data, "Project activities retrieved successfully", {
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
  });
});

/**
 * @desc    Get activities for a task
 * @route   GET /api/v1/tasks/:taskId/activities
 * @access  Private
 */
export const getTaskActivities = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const taskId = req.params.taskId;
  const result = await activityService.getTaskActivities(taskId, req.query, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, result.data, "Task activities retrieved successfully", {
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
  });
});

/**
 * @desc    Get activity by ID
 * @route   GET /api/v1/activities/:id
 * @access  Private
 */
export const getActivityById = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const activityId = req.params.id;
  const activity = await activityService.getActivityById(activityId, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, activity, "Activity retrieved successfully");
});

/**
 * @desc    Get activity statistics
 * @route   GET /api/v1/activities/stats
 * @access  Private
 */
export const getActivityStats = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const userRole = req.user?.role as string;
  const stats = await activityService.getActivityStats(req.query, { 
    userId, 
    userRole,
    timestamp: new Date() 
  });

  successResponse(res, 200, stats, "Activity statistics retrieved successfully");
});

/**
 * @desc    Create a new activity (for system use)
 * @route   POST /api/v1/activities
 * @access  Private (Admin only)
 */
export const createActivity = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const userRole = req.user?.role as string;
  
  // Only allow admins to manually create activities
  if (userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: "Only administrators can manually create activities"
    });
  }

  const activity = await activityService.createActivity(req.body, { 
    userId, 
    userRole,
    timestamp: new Date() 
  });

  successResponse(res, 201, activity, "Activity created successfully");
});

/**
 * @desc    Cleanup old activities (Admin only)
 * @route   DELETE /api/v1/activities/cleanup
 * @access  Private (Admin only)
 */
export const cleanupOldActivities = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const userRole = req.user?.role as string;
  
  // Only allow admins to cleanup activities
  if (userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: "Only administrators can cleanup old activities"
    });
  }

  const daysToKeep = parseInt(req.query.days as string) || 90;
  const result = await activityService.cleanupOldActivities(daysToKeep, { 
    userId, 
    userRole,
    timestamp: new Date() 
  });

  successResponse(res, 200, result, `Successfully cleaned up old activities (${result.deleted} deleted)`);
});
