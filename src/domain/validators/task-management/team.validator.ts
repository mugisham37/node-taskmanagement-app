import { body, param, query } from "express-validator"
import { validateUuidParam, validatePagination, validateSort, validateTextContent, validateHexColor } from "./common.validator"

// Team role enum values
const teamRoleValues = ["owner", "admin", "member", "viewer"] as const

// Team visibility enum values
const teamVisibilityValues = ["private", "public", "invite_only"] as const

/**
 * Validation rules for creating a team
 */
export const createTeam = [
  validateTextContent("name", 1, 100, true),
  validateTextContent("description", 0, 500, false),

  body("workspaceId")
    .optional()
    .isUUID()
    .withMessage("Workspace ID must be a valid UUID"),

  body("visibility")
    .optional()
    .isIn(teamVisibilityValues)
    .withMessage(`Visibility must be one of: ${teamVisibilityValues.join(", ")}`),

  validateHexColor("color", false),

  body("avatar")
    .optional()
    .isURL({
      protocols: ["http", "https"],
      require_protocol: true,
    })
    .withMessage("Avatar must be a valid URL"),

  body("settings")
    .optional()
    .isObject()
    .withMessage("Settings must be an object")
    .custom((settings) => {
      if (settings) {
        const allowedKeys = ["allowInvitations", "requireApproval", "defaultRole", "notifications", "autoAssign"]
        const providedKeys = Object.keys(settings)
        const invalidKeys = providedKeys.filter(key => !allowedKeys.includes(key))
        
        if (invalidKeys.length > 0) {
          throw new Error(`Invalid settings keys: ${invalidKeys.join(", ")}`)
        }

        // Validate boolean settings
        const booleanFields = ["allowInvitations", "requireApproval", "autoAssign"]
        for (const field of booleanFields) {
          if (settings[field] !== undefined && typeof settings[field] !== "boolean") {
            throw new Error(`${field} must be a boolean`)
          }
        }

        // Validate default role
        if (settings.defaultRole && !teamRoleValues.includes(settings.defaultRole)) {
          throw new Error(`Default role must be one of: ${teamRoleValues.join(", ")}`)
        }

        // Validate notifications settings
        if (settings.notifications && typeof settings.notifications !== "object") {
          throw new Error("Notifications settings must be an object")
        }
      }
      return true
    }),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array")
    .custom((tags) => {
      if (Array.isArray(tags)) {
        if (tags.length > 10) {
          throw new Error("Maximum 10 tags allowed")
        }
        for (const tag of tags) {
          if (typeof tag !== "string" || tag.trim().length === 0) {
            throw new Error("Each tag must be a non-empty string")
          }
          if (tag.length > 30) {
            throw new Error("Each tag must be 30 characters or less")
          }
          if (!/^[a-zA-Z0-9\s\-_]+$/.test(tag)) {
            throw new Error("Tags can only contain letters, numbers, spaces, hyphens, and underscores")
          }
        }
      }
      return true
    }),

  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),

  body("isArchived")
    .optional()
    .isBoolean()
    .withMessage("isArchived must be a boolean"),
]

/**
 * Validation rules for updating a team
 */
export const updateTeam = [
  validateUuidParam("id", "Invalid team ID"),

  validateTextContent("name", 1, 100, false),
  validateTextContent("description", 0, 500, false),

  body("workspaceId")
    .optional()
    .isUUID()
    .withMessage("Workspace ID must be a valid UUID"),

  body("visibility")
    .optional()
    .isIn(teamVisibilityValues)
    .withMessage(`Visibility must be one of: ${teamVisibilityValues.join(", ")}`),

  validateHexColor("color", false),

  body("avatar")
    .optional()
    .isURL({
      protocols: ["http", "https"],
      require_protocol: true,
    })
    .withMessage("Avatar must be a valid URL"),

  body("settings")
    .optional()
    .isObject()
    .withMessage("Settings must be an object")
    .custom((settings) => {
      if (settings) {
        const allowedKeys = ["allowInvitations", "requireApproval", "defaultRole", "notifications", "autoAssign"]
        const providedKeys = Object.keys(settings)
        const invalidKeys = providedKeys.filter(key => !allowedKeys.includes(key))
        
        if (invalidKeys.length > 0) {
          throw new Error(`Invalid settings keys: ${invalidKeys.join(", ")}`)
        }

        const booleanFields = ["allowInvitations", "requireApproval", "autoAssign"]
        for (const field of booleanFields) {
          if (settings[field] !== undefined && typeof settings[field] !== "boolean") {
            throw new Error(`${field} must be a boolean`)
          }
        }

        if (settings.defaultRole && !teamRoleValues.includes(settings.defaultRole)) {
          throw new Error(`Default role must be one of: ${teamRoleValues.join(", ")}`)
        }

        if (settings.notifications && typeof settings.notifications !== "object") {
          throw new Error("Notifications settings must be an object")
        }
      }
      return true
    }),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array")
    .custom((tags) => {
      if (Array.isArray(tags)) {
        if (tags.length > 10) {
          throw new Error("Maximum 10 tags allowed")
        }
        for (const tag of tags) {
          if (typeof tag !== "string" || tag.trim().length === 0) {
            throw new Error("Each tag must be a non-empty string")
          }
          if (tag.length > 30) {
            throw new Error("Each tag must be 30 characters or less")
          }
          if (!/^[a-zA-Z0-9\s\-_]+$/.test(tag)) {
            throw new Error("Tags can only contain letters, numbers, spaces, hyphens, and underscores")
          }
        }
      }
      return true
    }),

  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),

  body("isArchived")
    .optional()
    .isBoolean()
    .withMessage("isArchived must be a boolean"),
]

/**
 * Validation rules for getting a team by ID
 */
export const getTeam = [
  validateUuidParam("id", "Invalid team ID"),

  query("includeMembers")
    .optional()
    .isBoolean()
    .withMessage("Include members must be a boolean")
    .toBoolean(),

  query("includeProjects")
    .optional()
    .isBoolean()
    .withMessage("Include projects must be a boolean")
    .toBoolean(),

  query("includeStats")
    .optional()
    .isBoolean()
    .withMessage("Include stats must be a boolean")
    .toBoolean(),
]

/**
 * Validation rules for deleting a team
 */
export const deleteTeam = [
  validateUuidParam("id", "Invalid team ID"),

  body("transferProjectsTo")
    .optional()
    .isUUID()
    .withMessage("Transfer projects to must be a valid team UUID"),

  body("deleteAllProjects")
    .optional()
    .isBoolean()
    .withMessage("Delete all projects must be a boolean"),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),
]

/**
 * Validation rules for getting teams with filtering and pagination
 */
export const getTeams = [
  ...validatePagination,
  validateSort(["name", "createdAt", "updatedAt", "memberCount", "projectCount"]),

  query("workspaceId")
    .optional()
    .isUUID()
    .withMessage("Workspace ID must be a valid UUID"),

  query("visibility")
    .optional()
    .isIn(teamVisibilityValues)
    .withMessage(`Visibility must be one of: ${teamVisibilityValues.join(", ")}`),

  query("includeArchived")
    .optional()
    .isBoolean()
    .withMessage("Include archived must be a boolean")
    .toBoolean(),

  query("search")
    .optional()
    .isString()
    .withMessage("Search must be a string")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search term must be between 1 and 100 characters"),

  query("tags")
    .optional()
    .isString()
    .withMessage("Tags filter must be a string")
    .custom((value) => {
      // Allow comma-separated tags
      const tags = value.split(',').map((tag: string) => tag.trim())
      for (const tag of tags) {
        if (tag.length === 0 || tag.length > 30) {
          throw new Error("Each tag must be between 1 and 30 characters")
        }
      }
      return true
    }),

  query("ownerId")
    .optional()
    .isUUID()
    .withMessage("Owner ID must be a valid UUID"),

  query("memberId")
    .optional()
    .isUUID()
    .withMessage("Member ID must be a valid UUID"),

  query("role")
    .optional()
    .isIn(teamRoleValues)
    .withMessage(`Role must be one of: ${teamRoleValues.join(", ")}`),

  query("minMembers")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Min members must be a non-negative integer")
    .toInt(),

  query("maxMembers")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Max members must be a non-negative integer")
    .toInt()
    .custom((maxMembers, { req }) => {
      if (req.query?.minMembers && maxMembers < parseInt(req.query.minMembers as string)) {
        throw new Error("Max members must be greater than min members")
      }
      return true
    }),
]

/**
 * Validation rules for adding team members
 */
export const addTeamMember = [
  validateUuidParam("id", "Invalid team ID"),

  body("userId")
    .notEmpty()
    .withMessage("User ID is required")
    .isUUID()
    .withMessage("User ID must be a valid UUID"),

  body("role")
    .optional()
    .isIn(teamRoleValues)
    .withMessage(`Role must be one of: ${teamRoleValues.join(", ")}`),

  body("sendInvitation")
    .optional()
    .isBoolean()
    .withMessage("Send invitation must be a boolean"),

  body("message")
    .optional()
    .isString()
    .withMessage("Message must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Message cannot exceed 500 characters"),
]

/**
 * Validation rules for removing team members
 */
export const removeTeamMember = [
  validateUuidParam("id", "Invalid team ID"),
  validateUuidParam("memberId", "Invalid member ID"),

  body("transferTasksTo")
    .optional()
    .isUUID()
    .withMessage("Transfer tasks to must be a valid UUID"),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),
]

/**
 * Validation rules for updating team member role
 */
export const updateTeamMemberRole = [
  validateUuidParam("id", "Invalid team ID"),
  validateUuidParam("memberId", "Invalid member ID"),

  body("role")
    .notEmpty()
    .withMessage("Role is required")
    .isIn(teamRoleValues)
    .withMessage(`Role must be one of: ${teamRoleValues.join(", ")}`),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),
]

/**
 * Validation rules for leaving a team
 */
export const leaveTeam = [
  validateUuidParam("id", "Invalid team ID"),

  body("transferTasksTo")
    .optional()
    .isUUID()
    .withMessage("Transfer tasks to must be a valid UUID"),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),
]

/**
 * Validation rules for transferring team ownership
 */
export const transferTeamOwnership = [
  validateUuidParam("id", "Invalid team ID"),

  body("newOwnerId")
    .notEmpty()
    .withMessage("New owner ID is required")
    .isUUID()
    .withMessage("New owner ID must be a valid UUID"),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),
]

/**
 * Validation rules for getting team statistics
 */
export const getTeamStats = [
  validateUuidParam("id", "Invalid team ID"),

  query("period")
    .optional()
    .isIn(["week", "month", "quarter", "year", "all"])
    .withMessage("Period must be one of: week, month, quarter, year, all"),

  query("includeProjects")
    .optional()
    .isBoolean()
    .withMessage("Include projects must be a boolean")
    .toBoolean(),

  query("includeTasks")
    .optional()
    .isBoolean()
    .withMessage("Include tasks must be a boolean")
    .toBoolean(),

  query("groupBy")
    .optional()
    .isIn(["day", "week", "month", "member", "project", "status"])
    .withMessage("Group by must be one of: day, week, month, member, project, status"),
]

/**
 * Validation rules for getting team members
 */
export const getTeamMembers = [
  validateUuidParam("id", "Invalid team ID"),
  ...validatePagination,
  validateSort(["joinedAt", "role", "name", "email"]),

  query("role")
    .optional()
    .isIn(teamRoleValues)
    .withMessage(`Role must be one of: ${teamRoleValues.join(", ")}`),

  query("search")
    .optional()
    .isString()
    .withMessage("Search must be a string")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search term must be between 1 and 100 characters"),

  query("includeInactive")
    .optional()
    .isBoolean()
    .withMessage("Include inactive must be a boolean")
    .toBoolean(),
]

/**
 * Validation rules for archiving a team
 */
export const archiveTeam = [
  validateUuidParam("id", "Invalid team ID"),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),

  body("archiveProjects")
    .optional()
    .isBoolean()
    .withMessage("Archive projects must be a boolean"),
]

/**
 * Validation rules for restoring an archived team
 */
export const restoreTeam = [
  validateUuidParam("id", "Invalid team ID"),

  body("restoreProjects")
    .optional()
    .isBoolean()
    .withMessage("Restore projects must be a boolean"),
]

/**
 * Validation rules for bulk operations on teams
 */
export const bulkUpdateTeams = [
  body("teamIds")
    .notEmpty()
    .withMessage("Team IDs are required")
    .isArray({ min: 1, max: 50 })
    .withMessage("Team IDs must be an array with 1-50 items")
    .custom((teamIds) => {
      for (const id of teamIds) {
        if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
          throw new Error("Each team ID must be a valid UUID")
        }
      }
      return true
    }),

  body("updates")
    .notEmpty()
    .withMessage("Updates are required")
    .isObject()
    .withMessage("Updates must be an object")
    .custom((updates) => {
      const allowedFields = ["visibility", "tags", "workspaceId", "isArchived"]
      const providedFields = Object.keys(updates)
      const invalidFields = providedFields.filter(field => !allowedFields.includes(field))
      
      if (invalidFields.length > 0) {
        throw new Error(`Invalid update fields: ${invalidFields.join(", ")}`)
      }

      if (updates.visibility && !teamVisibilityValues.includes(updates.visibility)) {
        throw new Error(`Visibility must be one of: ${teamVisibilityValues.join(", ")}`)
      }

      if (updates.tags && (!Array.isArray(updates.tags) || updates.tags.length > 10)) {
        throw new Error("Tags must be an array with maximum 10 items")
      }

      if (updates.workspaceId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(updates.workspaceId)) {
        throw new Error("Workspace ID must be a valid UUID")
      }

      if (updates.isArchived !== undefined && typeof updates.isArchived !== "boolean") {
        throw new Error("isArchived must be a boolean")
      }

      return true
    }),
]

/**
 * Validation rules for duplicating a team
 */
export const duplicateTeam = [
  validateUuidParam("id", "Invalid team ID"),

  body("name")
    .notEmpty()
    .withMessage("New team name is required")
    .isString()
    .withMessage("Team name must be a string")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Team name must be between 1 and 100 characters"),

  body("includeMembers")
    .optional()
    .isBoolean()
    .withMessage("Include members must be a boolean"),

  body("includeProjects")
    .optional()
    .isBoolean()
    .withMessage("Include projects must be a boolean"),

  body("includeSettings")
    .optional()
    .isBoolean()
    .withMessage("Include settings must be a boolean"),

  body("workspaceId")
    .optional()
    .isUUID()
    .withMessage("Workspace ID must be a valid UUID"),
]
