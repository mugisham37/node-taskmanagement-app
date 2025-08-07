import { body, param, query } from "express-validator"
import { validateUuidParam, validatePagination, validateSort, validateEmail } from "./common.validator"
import { teamRoleEnum } from "../db/schema/teams"

/**
 * Validation rules for creating an invitation
 */
export const createInvitation = [
  validateEmail("email", true),

  body("teamId")
    .notEmpty()
    .withMessage("Team ID is required")
    .isUUID()
    .withMessage("Team ID must be a valid UUID"),

  body("role")
    .optional()
    .isIn(teamRoleEnum)
    .withMessage(`Role must be one of: ${teamRoleEnum.join(", ")}`),

  body("message")
    .optional()
    .isString()
    .withMessage("Message must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Message cannot exceed 500 characters"),

  body("expiresAt")
    .optional()
    .isISO8601()
    .withMessage("Expiration date must be a valid ISO 8601 date")
    .toDate()
    .custom((value) => {
      const now = new Date()
      const maxExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days
      if (value <= now) {
        throw new Error("Expiration date must be in the future")
      }
      if (value > maxExpiry) {
        throw new Error("Expiration date cannot be more than 30 days from now")
      }
      return true
    }),
]

/**
 * Validation rules for getting team invitations
 */
export const getTeamInvitations = [
  validateUuidParam("teamId", "Invalid team ID"),
  ...validatePagination,
  validateSort(["createdAt", "updatedAt", "email", "role", "status"]),

  query("status")
    .optional()
    .isIn(["pending", "accepted", "declined", "expired", "cancelled"])
    .withMessage("Status must be one of: pending, accepted, declined, expired, cancelled"),

  query("role")
    .optional()
    .isIn(teamRoleEnum)
    .withMessage(`Role must be one of: ${teamRoleEnum.join(", ")}`),

  query("email")
    .optional()
    .isEmail()
    .withMessage("Email must be valid")
    .normalizeEmail(),

  query("search")
    .optional()
    .isString()
    .withMessage("Search must be a string")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search term must be between 1 and 100 characters"),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date")
    .toDate(),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date")
    .toDate()
    .custom((endDate, { req }) => {
      if (req.query?.startDate && endDate < new Date(req.query.startDate as string)) {
        throw new Error("End date must be after start date")
      }
      return true
    }),
]

/**
 * Validation rules for getting invitation by token
 */
export const getInvitationByToken = [
  param("token")
    .notEmpty()
    .withMessage("Token is required")
    .isString()
    .withMessage("Token must be a string")
    .isLength({ min: 32, max: 128 })
    .withMessage("Token must be between 32 and 128 characters")
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage("Token contains invalid characters"),
]

/**
 * Validation rules for accepting an invitation
 */
export const acceptInvitation = [
  param("token")
    .notEmpty()
    .withMessage("Token is required")
    .isString()
    .withMessage("Token must be a string")
    .isLength({ min: 32, max: 128 })
    .withMessage("Token must be between 32 and 128 characters")
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage("Token contains invalid characters"),

  body("acceptTerms")
    .optional()
    .isBoolean()
    .withMessage("Accept terms must be a boolean"),

  body("preferences")
    .optional()
    .isObject()
    .withMessage("Preferences must be an object")
    .custom((preferences) => {
      if (preferences) {
        const allowedKeys = ["notifications", "emailUpdates", "role"]
        const providedKeys = Object.keys(preferences)
        const invalidKeys = providedKeys.filter(key => !allowedKeys.includes(key))
        
        if (invalidKeys.length > 0) {
          throw new Error(`Invalid preference keys: ${invalidKeys.join(", ")}`)
        }

        if (preferences.notifications !== undefined && typeof preferences.notifications !== "boolean") {
          throw new Error("Notifications preference must be a boolean")
        }

        if (preferences.emailUpdates !== undefined && typeof preferences.emailUpdates !== "boolean") {
          throw new Error("Email updates preference must be a boolean")
        }

        if (preferences.role && !teamRoleEnum.includes(preferences.role)) {
          throw new Error(`Role preference must be one of: ${teamRoleEnum.join(", ")}`)
        }
      }
      return true
    }),
]

/**
 * Validation rules for declining an invitation
 */
export const declineInvitation = [
  param("token")
    .notEmpty()
    .withMessage("Token is required")
    .isString()
    .withMessage("Token must be a string")
    .isLength({ min: 32, max: 128 })
    .withMessage("Token must be between 32 and 128 characters")
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage("Token contains invalid characters"),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),
]

/**
 * Validation rules for canceling an invitation
 */
export const cancelInvitation = [
  validateUuidParam("id", "Invalid invitation ID"),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),
]

/**
 * Validation rules for resending an invitation
 */
export const resendInvitation = [
  validateUuidParam("id", "Invalid invitation ID"),

  body("message")
    .optional()
    .isString()
    .withMessage("Message must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Message cannot exceed 500 characters"),

  body("expiresAt")
    .optional()
    .isISO8601()
    .withMessage("Expiration date must be a valid ISO 8601 date")
    .toDate()
    .custom((value) => {
      const now = new Date()
      const maxExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days
      if (value <= now) {
        throw new Error("Expiration date must be in the future")
      }
      if (value > maxExpiry) {
        throw new Error("Expiration date cannot be more than 30 days from now")
      }
      return true
    }),
]

/**
 * Validation rules for getting invitation statistics
 */
export const getInvitationStats = [
  query("teamId")
    .optional()
    .isUUID()
    .withMessage("Team ID must be a valid UUID"),

  query("status")
    .optional()
    .isIn(["pending", "accepted", "declined", "expired", "cancelled"])
    .withMessage("Status must be one of: pending, accepted, declined, expired, cancelled"),

  query("role")
    .optional()
    .isIn(teamRoleEnum)
    .withMessage(`Role must be one of: ${teamRoleEnum.join(", ")}`),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date")
    .toDate(),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date")
    .toDate()
    .custom((endDate, { req }) => {
      if (req.query?.startDate && endDate < new Date(req.query.startDate as string)) {
        throw new Error("End date must be after start date")
      }
      return true
    }),

  query("groupBy")
    .optional()
    .isIn(["day", "week", "month", "status", "role", "team"])
    .withMessage("Group by must be one of: day, week, month, status, role, team"),
]

/**
 * Validation rules for getting all invitations (Admin only)
 */
export const getAllInvitations = [
  ...validatePagination,
  validateSort(["createdAt", "updatedAt", "email", "role", "status", "teamId"]),

  query("teamId")
    .optional()
    .isUUID()
    .withMessage("Team ID must be a valid UUID"),

  query("status")
    .optional()
    .isIn(["pending", "accepted", "declined", "expired", "cancelled"])
    .withMessage("Status must be one of: pending, accepted, declined, expired, cancelled"),

  query("role")
    .optional()
    .isIn(teamRoleEnum)
    .withMessage(`Role must be one of: ${teamRoleEnum.join(", ")}`),

  query("email")
    .optional()
    .isEmail()
    .withMessage("Email must be valid")
    .normalizeEmail(),

  query("invitedById")
    .optional()
    .isUUID()
    .withMessage("Invited by ID must be a valid UUID"),

  query("search")
    .optional()
    .isString()
    .withMessage("Search must be a string")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search term must be between 1 and 100 characters"),

  query("isExpired")
    .optional()
    .isBoolean()
    .withMessage("Is expired must be a boolean")
    .toBoolean(),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date")
    .toDate(),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date")
    .toDate()
    .custom((endDate, { req }) => {
      if (req.query?.startDate && endDate < new Date(req.query.startDate as string)) {
        throw new Error("End date must be after start date")
      }
      return true
    }),
]

/**
 * Validation rules for cleanup expired invitations (Admin only)
 */
export const cleanupExpiredInvitations = [
  body("daysOld")
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage("Days old must be between 1 and 365")
    .toInt(),

  body("status")
    .optional()
    .isArray()
    .withMessage("Status must be an array")
    .custom((statuses) => {
      const validStatuses = ["expired", "declined", "cancelled"]
      if (Array.isArray(statuses)) {
        for (const status of statuses) {
          if (!validStatuses.includes(status)) {
            throw new Error(`Each status must be one of: ${validStatuses.join(", ")}`)
          }
        }
      }
      return true
    }),

  body("dryRun")
    .optional()
    .isBoolean()
    .withMessage("Dry run must be a boolean"),
]

/**
 * Validation rules for bulk operations on invitations
 */
export const bulkUpdateInvitations = [
  body("invitationIds")
    .notEmpty()
    .withMessage("Invitation IDs are required")
    .isArray({ min: 1, max: 50 })
    .withMessage("Invitation IDs must be an array with 1-50 items")
    .custom((invitationIds) => {
      for (const id of invitationIds) {
        if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
          throw new Error("Each invitation ID must be a valid UUID")
        }
      }
      return true
    }),

  body("action")
    .notEmpty()
    .withMessage("Action is required")
    .isIn(["cancel", "resend", "update_role"])
    .withMessage("Action must be one of: cancel, resend, update_role"),

  body("data")
    .optional()
    .isObject()
    .withMessage("Data must be an object")
    .custom((data, { req }) => {
      const action = req.body.action
      if (action === "update_role") {
        if (!data.role || !teamRoleEnum.includes(data.role)) {
          throw new Error(`Role must be one of: ${teamRoleEnum.join(", ")}`)
        }
      }
      if (action === "resend") {
        if (data.message && (typeof data.message !== "string" || data.message.length > 500)) {
          throw new Error("Message must be a string with maximum 500 characters")
        }
        if (data.expiresAt) {
          const expiryDate = new Date(data.expiresAt)
          const now = new Date()
          const maxExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          if (expiryDate <= now || expiryDate > maxExpiry) {
            throw new Error("Expiration date must be between now and 30 days from now")
          }
        }
      }
      return true
    }),
]
