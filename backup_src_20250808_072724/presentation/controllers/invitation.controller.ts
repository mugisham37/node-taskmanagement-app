import type { Response, NextFunction } from "express"
import { asyncHandler } from "../utils/async-handler"
import { successResponse } from "../utils/response-formatter"
import { invitationService } from "../services"
import type { AuthRequest } from "../middleware/auth"

/**
 * @desc    Create a new invitation
 * @route   POST /api/v1/invitations
 * @access  Private
 */
export const createInvitation = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const invitation = await invitationService.createInvitation(req.body, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 201, invitation, "Invitation sent successfully")
})

/**
 * @desc    Get invitations for a team
 * @route   GET /api/v1/teams/:teamId/invitations
 * @access  Private
 */
export const getTeamInvitations = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const teamId = req.params.teamId
  const filters = { ...req.query, teamId }
  const result = await invitationService.getInvitations(filters, req.query, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, result.data, "Team invitations retrieved successfully", {
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
  })
})

/**
 * @desc    Get invitations for the authenticated user
 * @route   GET /api/v1/invitations/me
 * @access  Private
 */
export const getUserInvitations = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const email = req.user?.email as string
  const filters = { ...req.query, email }
  const result = await invitationService.getInvitations(filters, req.query, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, result.data, "User invitations retrieved successfully", {
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
  })
})

/**
 * @desc    Get invitation by token
 * @route   GET /api/v1/invitations/:token
 * @access  Public
 */
export const getInvitationByToken = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.params.token
  const invitation = await invitationService.getInvitationByToken(token, {
    timestamp: new Date()
  })

  successResponse(res, 200, invitation, "Invitation retrieved successfully")
})

/**
 * @desc    Accept an invitation
 * @route   POST /api/v1/invitations/:token/accept
 * @access  Private
 */
export const acceptInvitation = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const token = req.params.token
  const result = await invitationService.acceptInvitation(token, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, { teamId: result.teamId }, result.message)
})

/**
 * @desc    Decline an invitation
 * @route   POST /api/v1/invitations/:token/decline
 * @access  Private
 */
export const declineInvitation = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const token = req.params.token
  const result = await invitationService.declineInvitation(token, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, {}, result.message)
})

/**
 * @desc    Cancel an invitation
 * @route   DELETE /api/v1/invitations/:id
 * @access  Private
 */
export const cancelInvitation = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const invitationId = req.params.id
  await invitationService.cancelInvitation(invitationId, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, {}, "Invitation cancelled successfully")
})

/**
 * @desc    Resend an invitation
 * @route   POST /api/v1/invitations/:id/resend
 * @access  Private
 */
export const resendInvitation = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const invitationId = req.params.id
  const invitation = await invitationService.resendInvitation(invitationId, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, invitation, "Invitation resent successfully")
})

/**
 * @desc    Get invitation statistics
 * @route   GET /api/v1/invitations/stats
 * @access  Private
 */
export const getInvitationStats = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const userRole = req.user?.role as string
  const stats = await invitationService.getInvitationStats(req.query, {
    userId,
    userRole,
    timestamp: new Date()
  })

  successResponse(res, 200, stats, "Invitation statistics retrieved successfully")
})

/**
 * @desc    Get all invitations (Admin only)
 * @route   GET /api/v1/invitations
 * @access  Private (Admin)
 */
export const getAllInvitations = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const userRole = req.user?.role as string
  const result = await invitationService.getInvitations(req.query, req.query, {
    userId,
    userRole,
    timestamp: new Date()
  })

  successResponse(res, 200, result.data, "Invitations retrieved successfully", {
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
  })
})

/**
 * @desc    Cleanup expired invitations (Admin only)
 * @route   POST /api/v1/invitations/cleanup
 * @access  Private (Admin)
 */
export const cleanupExpiredInvitations = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const userRole = req.user?.role as string
  
  if (userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: "Only administrators can cleanup expired invitations"
    })
  }

  const result = await invitationService.cleanupExpiredInvitations({
    userId,
    userRole,
    timestamp: new Date()
  })

  successResponse(res, 200, result, `Successfully cleaned up ${result.updated} expired invitations`)
})
