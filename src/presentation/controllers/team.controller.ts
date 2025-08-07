import type { Response, NextFunction } from "express";
import { asyncHandler } from "../utils/async-handler";
import { successResponse } from "../utils/response-formatter";
import { teamService } from "../services";
import type { AuthRequest } from "../middleware/auth";

/**
 * @desc    Get all teams for the authenticated user
 * @route   GET /api/v1/teams
 * @access  Private
 */
export const getTeams = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const result = await teamService.getTeams(req.query, req.query, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, result.data, "Teams retrieved successfully", {
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
  });
});

/**
 * @desc    Create a new team
 * @route   POST /api/v1/teams
 * @access  Private
 */
export const createTeam = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const team = await teamService.createTeam(req.body, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 201, team, "Team created successfully");
});

/**
 * @desc    Get a team by ID
 * @route   GET /api/v1/teams/:id
 * @access  Private
 */
export const getTeam = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const teamId = req.params.id;
  const team = await teamService.getTeamById(teamId, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, team, "Team retrieved successfully");
});

/**
 * @desc    Update a team
 * @route   PUT /api/v1/teams/:id
 * @access  Private
 */
export const updateTeam = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const teamId = req.params.id;
  const team = await teamService.updateTeam(teamId, req.body, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, team, "Team updated successfully");
});

/**
 * @desc    Delete a team
 * @route   DELETE /api/v1/teams/:id
 * @access  Private
 */
export const deleteTeam = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const teamId = req.params.id;
  const result = await teamService.deleteTeam(teamId, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, {}, result.message);
});

/**
 * @desc    Get team members
 * @route   GET /api/v1/teams/:id/members
 * @access  Private
 */
export const getTeamMembers = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const teamId = req.params.id;
  const members = await teamService.getTeamMembers(teamId, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, members, "Team members retrieved successfully");
});

/**
 * @desc    Add a member to a team
 * @route   POST /api/v1/teams/:id/members
 * @access  Private
 */
export const addTeamMember = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const teamId = req.params.id;
  const team = await teamService.addTeamMember(teamId, req.body, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, team, "Member added to team successfully");
});

/**
 * @desc    Remove a member from a team
 * @route   DELETE /api/v1/teams/:id/members/:memberId
 * @access  Private
 */
export const removeTeamMember = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const teamId = req.params.id;
  const memberId = req.params.memberId;
  const team = await teamService.removeTeamMember(teamId, memberId, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, team, "Member removed from team successfully");
});

/**
 * @desc    Update a team member's role
 * @route   PATCH /api/v1/teams/:id/members/:memberId/role
 * @access  Private
 */
export const updateTeamMemberRole = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const teamId = req.params.id;
  const memberId = req.params.memberId;
  const { role } = req.body;
  const team = await teamService.updateTeamMemberRole(teamId, memberId, role, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, team, "Member role updated successfully");
});

/**
 * @desc    Leave a team
 * @route   DELETE /api/v1/teams/:id/leave
 * @access  Private
 */
export const leaveTeam = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const teamId = req.params.id;
  const result = await teamService.leaveTeam(teamId, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, {}, result.message);
});

/**
 * @desc    Transfer team ownership
 * @route   PATCH /api/v1/teams/:id/transfer-ownership
 * @access  Private
 */
export const transferTeamOwnership = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const teamId = req.params.id;
  const { newOwnerId } = req.body;
  const team = await teamService.transferTeamOwnership(teamId, newOwnerId, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, team, "Team ownership transferred successfully");
});

/**
 * @desc    Get team statistics
 * @route   GET /api/v1/teams/:id/stats
 * @access  Private
 */
export const getTeamStats = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string;
  const teamId = req.params.id;
  const stats = await teamService.getTeamStats(teamId, { 
    userId, 
    timestamp: new Date() 
  });

  successResponse(res, 200, stats, "Team statistics retrieved successfully");
});
