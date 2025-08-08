import type { Response, NextFunction } from "express"
import { asyncHandler } from "../utils/async-handler"
import { successResponse } from "../utils/response-formatter"
import { workspaceService } from "../services"
import type { AuthRequest } from "../middleware/auth"

/**
 * @desc    Get all workspaces for the authenticated user
 * @route   GET /api/v1/workspaces
 * @access  Private
 */
export const getWorkspaces = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const result = await workspaceService.getWorkspaces(req.query, req.query, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, result.data, "Workspaces retrieved successfully", {
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
  })
})

/**
 * @desc    Create a new workspace
 * @route   POST /api/v1/workspaces
 * @access  Private
 */
export const createWorkspace = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const workspace = await workspaceService.createWorkspace(req.body, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 201, workspace, "Workspace created successfully")
})

/**
 * @desc    Get a workspace by ID
 * @route   GET /api/v1/workspaces/:id
 * @access  Private
 */
export const getWorkspace = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const workspaceId = req.params.id
  const workspace = await workspaceService.getWorkspaceById(workspaceId, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, workspace, "Workspace retrieved successfully")
})

/**
 * @desc    Update a workspace
 * @route   PUT /api/v1/workspaces/:id
 * @access  Private
 */
export const updateWorkspace = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const workspaceId = req.params.id
  const workspace = await workspaceService.updateWorkspace(workspaceId, req.body, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, workspace, "Workspace updated successfully")
})

/**
 * @desc    Delete a workspace
 * @route   DELETE /api/v1/workspaces/:id
 * @access  Private
 */
export const deleteWorkspace = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const workspaceId = req.params.id
  const result = await workspaceService.deleteWorkspace(workspaceId, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, {}, result.message)
})

/**
 * @desc    Get workspace projects
 * @route   GET /api/v1/workspaces/:id/projects
 * @access  Private
 */
export const getWorkspaceProjects = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const workspaceId = req.params.id
  const result = await workspaceService.getWorkspaceProjects(workspaceId, req.query, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, result.data, "Workspace projects retrieved successfully", {
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
  })
})

/**
 * @desc    Get workspace tasks
 * @route   GET /api/v1/workspaces/:id/tasks
 * @access  Private
 */
export const getWorkspaceTasks = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const workspaceId = req.params.id
  const result = await workspaceService.getWorkspaceTasks(workspaceId, req.query, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, result.data, "Workspace tasks retrieved successfully", {
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
  })
})

/**
 * @desc    Create a personal workspace
 * @route   POST /api/v1/workspaces/personal
 * @access  Private
 */
export const createPersonalWorkspace = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const workspace = await workspaceService.createPersonalWorkspace({
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, workspace, "Personal workspace created successfully")
})

/**
 * @desc    Get personal workspace
 * @route   GET /api/v1/workspaces/personal
 * @access  Private
 */
export const getPersonalWorkspace = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const workspace = await workspaceService.getPersonalWorkspace({
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, workspace, "Personal workspace retrieved successfully")
})

/**
 * @desc    Get workspace statistics
 * @route   GET /api/v1/workspaces/:id/stats
 * @access  Private
 */
export const getWorkspaceStats = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const workspaceId = req.params.id
  const stats = await workspaceService.getWorkspaceStats(workspaceId, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, stats, "Workspace statistics retrieved successfully")
})
