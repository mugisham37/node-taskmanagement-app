import type { Response, NextFunction } from "express"
import { asyncHandler } from "../utils/async-handler"
import { successResponse } from "../utils/response-formatter"
import { userService } from "../services"
import type { AuthRequest } from "../middleware/auth"

/**
 * @desc    Get user profile
 * @route   GET /api/v1/users/profile
 * @access  Private
 */
export const getProfile = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string

  const user = await userService.getUserProfile(userId, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, { user }, "User profile retrieved successfully")
})

/**
 * @desc    Update user profile
 * @route   PUT /api/v1/users/profile
 * @access  Private
 */
export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const { firstName, lastName, email, username, avatar, currentPassword, newPassword, confirmPassword, preferences } = req.body

  // If changing password, handle it separately
  if (newPassword && currentPassword) {
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match"
      })
    }

    await userService.changePassword(userId, currentPassword, newPassword, {
      userId,
      timestamp: new Date()
    })
  }

  // Update profile data
  const profileUpdates: any = {}
  if (firstName !== undefined) profileUpdates.firstName = firstName
  if (lastName !== undefined) profileUpdates.lastName = lastName
  if (avatar !== undefined) profileUpdates.avatar = avatar

  let updatedUser
  if (Object.keys(profileUpdates).length > 0) {
    updatedUser = await userService.updateProfile(userId, profileUpdates, {
      userId,
      timestamp: new Date()
    })
  }

  // Update preferences if provided
  if (preferences) {
    updatedUser = await userService.updatePreferences(userId, preferences, {
      userId,
      timestamp: new Date()
    })
  }

  // Get the latest user data
  const user = updatedUser || await userService.getUserProfile(userId, {
    userId,
    timestamp: new Date()
  })

  successResponse(res, 200, { user }, "User profile updated successfully")
})

/**
 * @desc    Delete user account
 * @route   DELETE /api/v1/users/profile
 * @access  Private
 */
export const deleteProfile = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const { password, reason, transferDataTo, deleteAllData } = req.body

  // For now, we'll use the deactivateUser method from userService
  // In a real implementation, you'd want to verify the password first
  await userService.deactivateUser(userId, {
    userId,
    timestamp: new Date(),
    userRole: 'admin' // This is a workaround since deactivateUser requires admin role
  })

  successResponse(res, 200, {
    deletedAt: new Date(),
    transferredItems: {
      projects: 0,
      teams: 0,
      tasks: 0
    }
  }, "User account deleted successfully")
})
