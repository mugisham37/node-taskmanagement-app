import type { Response, NextFunction } from "express";
import { asyncHandler } from "../utils/async-handler";
import { successResponse } from "../utils/response-formatter";
import { projectService } from "../services";
import type { AuthRequest } from "../middleware/auth";

/**
 * @desc    Get all projects for the authenticated user
 * @route   GET /api/v1/projects
 * @access  Private
 */
export const getProjects = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const result = await projectService.getProjects(req.query, req.query, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, result.data, "Projects retrieved successfully", {
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
  });
});

/**
 * @desc    Create a new project
 * @route   POST /api/v1/projects
 * @access  Private
 */
export const createProject = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const project = await projectService.createProject(req.body, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 201, project, "Project created successfully");
});

/**
 * @desc    Get a project by ID
 * @route   GET /api/v1/projects/:id
 * @access  Private
 */
export const getProject = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const projectId = req.params.id;
  const project = await projectService.getProjectById(projectId, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, project, "Project retrieved successfully");
});

/**
 * @desc    Update a project
 * @route   PUT /api/v1/projects/:id
 * @access  Private
 */
export const updateProject = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const projectId = req.params.id;
  const project = await projectService.updateProject(projectId, req.body, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, project, "Project updated successfully");
});

/**
 * @desc    Delete a project
 * @route   DELETE /api/v1/projects/:id
 * @access  Private
 */
export const deleteProject = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const projectId = req.params.id;
  await projectService.deleteProject(projectId, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, {}, "Project deleted successfully");
});

/**
 * @desc    Get project statistics
 * @route   GET /api/v1/projects/:id/stats
 * @access  Private
 */
export const getProjectStats = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const projectId = req.params.id;
  const stats = await projectService.getProjectStats(projectId, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, stats, "Project statistics retrieved successfully");
});

/**
 * @desc    Archive a project
 * @route   PATCH /api/v1/projects/:id/archive
 * @access  Private
 */
export const archiveProject = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const projectId = req.params.id;
  const project = await projectService.archiveProject(projectId, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, project, "Project archived successfully");
});

/**
 * @desc    Restore an archived project
 * @route   PATCH /api/v1/projects/:id/restore
 * @access  Private
 */
export const restoreProject = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const projectId = req.params.id;
  const project = await projectService.unarchiveProject(projectId, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, project, "Project restored successfully");
});

/**
 * @desc    Start a project
 * @route   PATCH /api/v1/projects/:id/start
 * @access  Private
 */
export const startProject = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const projectId = req.params.id;
  const project = await projectService.startProject(projectId, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, project, "Project started successfully");
});

/**
 * @desc    Pause a project
 * @route   PATCH /api/v1/projects/:id/pause
 * @access  Private
 */
export const pauseProject = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const projectId = req.params.id;
  const project = await projectService.pauseProject(projectId, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, project, "Project paused successfully");
});

/**
 * @desc    Complete a project
 * @route   PATCH /api/v1/projects/:id/complete
 * @access  Private
 */
export const completeProject = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const projectId = req.params.id;
  const project = await projectService.completeProject(projectId, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, project, "Project completed successfully");
});

/**
 * @desc    Cancel a project
 * @route   PATCH /api/v1/projects/:id/cancel
 * @access  Private
 */
export const cancelProject = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const projectId = req.params.id;
  const project = await projectService.cancelProject(projectId, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, project, "Project cancelled successfully");
});

/**
 * @desc    Get project tasks
 * @route   GET /api/v1/projects/:id/tasks
 * @access  Private
 */
export const getProjectTasks = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const projectId = req.params.id;
  
  // Add projectId to query filters
  const queryWithProject = {
    ...req.query,
    projectId
  };
  
  const result = await projectService.getProjectTasks(projectId, queryWithProject, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, result.data, "Project tasks retrieved successfully", {
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
  });
});
