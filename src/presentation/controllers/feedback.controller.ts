import type { Response, NextFunction } from "express"
import { asyncHandler } from "../shared/utils/async-handler"
import { successResponse } from "../shared/utils/response-formatter"
import { feedbackService } from "../services"
import type { AuthRequest } from "../shared/middleware/auth"

/**
 * @desc    Create a new feedback
 * @route   POST /api/v1/feedback
 * @access  Private
 */
export const createFeedback = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  
  const feedback = await feedbackService.createFeedback(req.body, { 
    userId, 
    timestamp: new Date() 
  })

  successResponse(res, 201, feedback, "Feedback created successfully")
})

/**
 * @desc    Get feedback by ID
 * @route   GET /api/v1/feedback/:id
 * @access  Private
 */
export const getFeedbackById = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const feedbackId = req.params.id
  
  const feedback = await feedbackService.getFeedbackById(feedbackId, { 
    userId, 
    timestamp: new Date() 
  })

  successResponse(res, 200, feedback, "Feedback retrieved successfully")
})

/**
 * @desc    Get all feedbacks for a user
 * @route   GET /api/v1/feedback
 * @access  Private
 */
export const getUserFeedbacks = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  
  const result = await feedbackService.getFeedbacks(req.query, req.query, { 
    userId, 
    timestamp: new Date() 
  })

  successResponse(res, 200, result.data, "Feedbacks retrieved successfully", {
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
  })
})

/**
 * @desc    Update feedback
 * @route   PUT /api/v1/feedback/:id
 * @access  Private
 */
export const updateFeedback = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const feedbackId = req.params.id
  
  const feedback = await feedbackService.updateFeedback(feedbackId, req.body, { 
    userId, 
    timestamp: new Date() 
  })

  successResponse(res, 200, feedback, "Feedback updated successfully")
})

/**
 * @desc    Delete feedback
 * @route   DELETE /api/v1/feedback/:id
 * @access  Private
 */
export const deleteFeedback = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const feedbackId = req.params.id
  
  await feedbackService.deleteFeedback(feedbackId, { 
    userId, 
    timestamp: new Date() 
  })

  successResponse(res, 200, {}, "Feedback deleted successfully")
})

/**
 * @desc    Admin: Get all feedbacks
 * @route   GET /api/v1/admin/feedback
 * @access  Admin
 */
export const getAllFeedbacks = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const userRole = req.user?.role as string
  
  const result = await feedbackService.getFeedbacks(req.query, req.query, { 
    userId, 
    userRole,
    timestamp: new Date() 
  })

  successResponse(res, 200, result.data, "Feedbacks retrieved successfully", {
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
  })
})

/**
 * @desc    Admin: Update feedback status
 * @route   PATCH /api/v1/admin/feedback/:id
 * @access  Admin
 */
export const updateFeedbackStatus = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const userRole = req.user?.role as string
  const feedbackId = req.params.id
  
  const feedback = await feedbackService.updateFeedback(feedbackId, req.body, { 
    userId, 
    userRole,
    timestamp: new Date() 
  })

  successResponse(res, 200, feedback, "Feedback status updated successfully")
})

/**
 * @desc    Admin: Get feedback statistics
 * @route   GET /api/v1/admin/feedback/statistics
 * @access  Admin
 */
export const getFeedbackStatistics = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const userRole = req.user?.role as string
  
  const statistics = await feedbackService.getFeedbackStats(req.query, { 
    userId, 
    userRole,
    timestamp: new Date() 
  })

  successResponse(res, 200, statistics, "Feedback statistics retrieved successfully")
})
