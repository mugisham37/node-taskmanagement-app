import type { Response, NextFunction } from "express"
import { asyncHandler } from "../utils/async-handler"
import { successResponse } from "../utils/response-formatter"
import { userService } from "../services"
import type { AuthRequest } from "../middleware/auth"
import { AppError } from "../utils/app-error"

/**
 * @desc    Register a new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
export const register = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { firstName, lastName, email, password } = req.body

  // Create user data
  const userData = {
    firstName,
    lastName,
    email,
    password,
    username: email.split('@')[0] // Generate username from email
  }

  const result = await userService.register(userData, {
    userId: 'system',
    timestamp: new Date()
  })

  successResponse(res, 201, result, "User registered successfully")
})

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { email, password } = req.body

  const result = await userService.login({ email, password }, {
    userId: 'system',
    timestamp: new Date()
  })

  successResponse(res, 200, result, "Login successful")
})

/**
 * @desc    Refresh access token
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public
 */
export const refreshToken = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { refreshToken: token } = req.body

  if (!token) {
    throw new AppError("Refresh token is required", 400)
  }

  const tokens = await userService.refreshToken(token, {
    userId: 'system',
    timestamp: new Date()
  })

  successResponse(res, 200, { tokens }, "Token refreshed successfully")
})

/**
 * @desc    Forgot password
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { email } = req.body

  await userService.requestPasswordReset(email, {
    userId: 'system',
    timestamp: new Date()
  })

  successResponse(res, 200, {}, "If the email exists, a password reset link has been sent")
})

/**
 * @desc    Reset password
 * @route   POST /api/v1/auth/reset-password
 * @access  Public
 */
export const resetPassword = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { token, password } = req.body

  await userService.resetPassword(token, password, {
    userId: 'system',
    timestamp: new Date()
  })

  successResponse(res, 200, {}, "Password reset successful")
})

/**
 * @desc    Verify email
 * @route   POST /api/v1/auth/verify-email
 * @access  Public
 */
export const verifyEmail = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { token } = req.body

  const user = await userService.verifyEmail(token, {
    userId: 'system',
    timestamp: new Date()
  })

  successResponse(res, 200, { user }, "Email verified successfully")
})

/**
 * @desc    Get current user profile
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
export const getCurrentUser = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string

  const user = await userService.getUserProfile(userId, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, { user }, "User profile retrieved successfully")
})
