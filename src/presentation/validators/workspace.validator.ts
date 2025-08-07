import { body, param, query } from "express-validator"
import { validateUuidParam, validatePagination, validateSort, validateTextContent, validateHexColor } from "./common.validator"

// Workspace visibility enum values
const workspaceVisibilityValues = ["private", "public", "team_only"] as const

// Workspace type enum values
const workspaceTypeValues = ["personal", "team", "organization"] as const

/**
 * Validation rules for creating a workspace
 */
export const createWorkspace = [
  validateTextContent("name", 1, 100, true),
  validateTextContent("description", 0, 500, false),

  body("type")
    .optional()
    .isIn(workspaceTypeValues)
    .withMessage(`Type must be one of: ${workspaceTypeValues.join(", ")}`),

  body("visibility")
    .optional()
    .isIn(workspaceVisibilityValues)
    .withMessage(`Visibility must be one of: ${workspaceVisibilityValues.join(", ")}`),

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
        const allowedKeys = ["allowPublicProjects", "requireApproval", "defaultProjectVisibility", "notifications", "integrations", "features"]
        const providedKeys = Object.keys(settings)
        const invalidKeys = providedKeys.filter(key => !allowedKeys.includes(key))
        
        if (invalidKeys.length > 0) {
          throw new Error(`Invalid settings keys: ${invalidKeys.join(", ")}`)
        }

        // Validate boolean settings
        const booleanFields = ["allowPublicProjects", "requireApproval"]
        for (const field of booleanFields) {
          if (settings[field] !== undefined && typeof settings[field] !== "boolean") {
            throw new Error(`${field} must be a boolean`)
          }
        }

        // Validate default project visibility
        if (settings.defaultProjectVisibility && !["private", "public", "team"].includes(settings.defaultProjectVisibility)) {
          throw new Error("Default project visibility must be one of: private, public, team")
        }

        // Validate notifications settings
        if (settings.notifications && typeof settings.notifications !== "object") {
          throw new Error("Notifications settings must be an object")
        }

        // Validate integrations settings
        if (settings.integrations && typeof settings.integrations !== "object") {
          throw new Error("Integrations settings must be an object")
        }

        // Validate features settings
        if (settings.features && typeof settings.features !== "object") {
          throw new Error("Features settings must be an object")
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
        if (tags.length > 15) {
          throw new Error("Maximum 15 tags allowed")
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

  body("maxMembers")
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage("Max members must be between 1 and 10000")
    .toInt(),

  body("maxProjects")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("Max projects must be between 1 and 1000")
    .toInt(),

  body("maxStorage")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Max storage must be a positive integer (in MB)")
    .toInt(),
]

/**
 * Validation rules for updating a workspace
 */
export const updateWorkspace = [
  validateUuidParam("id", "Invalid workspace ID"),

  validateTextContent("name", 1, 100, false),
  validateTextContent("description", 0, 500, false),

  body("type")
    .optional()
    .isIn(workspaceTypeValues)
    .withMessage(`Type must be one of: ${workspaceTypeValues.join(", ")}`),

  body("visibility")
    .optional()
    .isIn(workspaceVisibilityValues)
    .withMessage(`Visibility must be one of: ${workspaceVisibilityValues.join(", ")}`),

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
        const allowedKeys = ["allowPublicProjects", "requireApproval", "defaultProjectVisibility", "notifications", "integrations", "features"]
        const providedKeys = Object.keys(settings)
        const invalidKeys = providedKeys.filter(key => !allowedKeys.includes(key))
        
        if (invalidKeys.length > 0) {
          throw new Error(`Invalid settings keys: ${invalidKeys.join(", ")}`)
        }

        const booleanFields = ["allowPublicProjects", "requireApproval"]
        for (const field of booleanFields) {
          if (settings[field] !== undefined && typeof settings[field] !== "boolean") {
            throw new Error(`${field} must be a boolean`)
          }
        }

        if (settings.defaultProjectVisibility && !["private", "public", "team"].includes(settings.defaultProjectVisibility)) {
          throw new Error("Default project visibility must be one of: private, public, team")
        }

        if (settings.notifications && typeof settings.notifications !== "object") {
          throw new Error("Notifications settings must be an object")
        }

        if (settings.integrations && typeof settings.integrations !== "object") {
          throw new Error("Integrations settings must be an object")
        }

        if (settings.features && typeof settings.features !== "object") {
          throw new Error("Features settings must be an object")
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
        if (tags.length > 15) {
          throw new Error("Maximum 15 tags allowed")
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

  body("maxMembers")
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage("Max members must be between 1 and 10000")
    .toInt(),

  body("maxProjects")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("Max projects must be between 1 and 1000")
    .toInt(),

  body("maxStorage")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Max storage must be a positive integer (in MB)")
    .toInt(),
]

/**
 * Validation rules for getting a workspace by ID
 */
export const getWorkspace = [
  validateUuidParam("id", "Invalid workspace ID"),

  query("includeTeams")
    .optional()
    .isBoolean()
    .withMessage("Include teams must be a boolean")
    .toBoolean(),

  query("includeProjects")
    .optional()
    .isBoolean()
    .withMessage("Include projects must be a boolean")
    .toBoolean(),

  query("includeMembers")
    .optional()
    .isBoolean()
    .withMessage("Include members must be a boolean")
    .toBoolean(),

  query("includeStats")
    .optional()
    .isBoolean()
    .withMessage("Include stats must be a boolean")
    .toBoolean(),
]

/**
 * Validation rules for deleting a workspace
 */
export const deleteWorkspace = [
  validateUuidParam("id", "Invalid workspace ID"),

  body("transferDataTo")
    .optional()
    .isUUID()
    .withMessage("Transfer data to must be a valid workspace UUID"),

  body("deleteAllData")
    .optional()
    .isBoolean()
    .withMessage("Delete all data must be a boolean"),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),

  body("confirmationText")
    .optional()
    .isString()
    .withMessage("Confirmation text must be a string")
    .custom((value, { req }) => {
      // For high-impact operations, require confirmation
      if (req.body.deleteAllData && value !== "DELETE") {
        throw new Error("Must type 'DELETE' to confirm deletion of all data")
      }
      return true
    }),
]

/**
 * Validation rules for getting workspaces with filtering and pagination
 */
export const getWorkspaces = [
  ...validatePagination,
  validateSort(["name", "createdAt", "updatedAt", "memberCount", "projectCount", "type"]),

  query("type")
    .optional()
    .isIn(workspaceTypeValues)
    .withMessage(`Type must be one of: ${workspaceTypeValues.join(", ")}`),

  query("visibility")
    .optional()
    .isIn(workspaceVisibilityValues)
    .withMessage(`Visibility must be one of: ${workspaceVisibilityValues.join(", ")}`),

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

  query("minProjects")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Min projects must be a non-negative integer")
    .toInt(),

  query("maxProjects")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Max projects must be a non-negative integer")
    .toInt()
    .custom((maxProjects, { req }) => {
      if (req.query?.minProjects && maxProjects < parseInt(req.query.minProjects as string)) {
        throw new Error("Max projects must be greater than min projects")
      }
      return true
    }),
]

/**
 * Validation rules for getting workspace projects
 */
export const getWorkspaceProjects = [
  validateUuidParam("id", "Invalid workspace ID"),
  ...validatePagination,
  validateSort(["name", "createdAt", "updatedAt", "status", "priority"]),

  query("status")
    .optional()
    .isIn(["planning", "active", "on_hold", "completed", "cancelled"])
    .withMessage("Status must be one of: planning, active, on_hold, completed, cancelled"),

  query("visibility")
    .optional()
    .isIn(["private", "public", "team"])
    .withMessage("Visibility must be one of: private, public, team"),

  query("teamId")
    .optional()
    .isUUID()
    .withMessage("Team ID must be a valid UUID"),

  query("ownerId")
    .optional()
    .isUUID()
    .withMessage("Owner ID must be a valid UUID"),

  query("search")
    .optional()
    .isString()
    .withMessage("Search must be a string")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search term must be between 1 and 100 characters"),

  query("includeArchived")
    .optional()
    .isBoolean()
    .withMessage("Include archived must be a boolean")
    .toBoolean(),
]

/**
 * Validation rules for getting workspace tasks
 */
export const getWorkspaceTasks = [
  validateUuidParam("id", "Invalid workspace ID"),
  ...validatePagination,
  validateSort(["title", "createdAt", "updatedAt", "dueDate", "status", "priority"]),

  query("status")
    .optional()
    .isIn(["todo", "in_progress", "review", "done", "cancelled"])
    .withMessage("Status must be one of: todo, in_progress, review, done, cancelled"),

  query("priority")
    .optional()
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("Priority must be one of: low, medium, high, urgent"),

  query("projectId")
    .optional()
    .isUUID()
    .withMessage("Project ID must be a valid UUID"),

  query("teamId")
    .optional()
    .isUUID()
    .withMessage("Team ID must be a valid UUID"),

  query("assignedTo")
    .optional()
    .isUUID()
    .withMessage("Assigned to must be a valid UUID"),

  query("createdBy")
    .optional()
    .isUUID()
    .withMessage("Created by must be a valid UUID"),

  query("search")
    .optional()
    .isString()
    .withMessage("Search must be a string")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search term must be between 1 and 100 characters"),

  query("dueDateFrom")
    .optional()
    .isISO8601()
    .withMessage("Due date from must be a valid ISO 8601 date")
    .toDate(),

  query("dueDateTo")
    .optional()
    .isISO8601()
    .withMessage("Due date to must be a valid ISO 8601 date")
    .toDate(),

  query("isOverdue")
    .optional()
    .isBoolean()
    .withMessage("Is overdue must be a boolean")
    .toBoolean(),
]

/**
 * Validation rules for creating a personal workspace
 */
export const createPersonalWorkspace = [
  // No additional validation needed - uses authenticated user context
]

/**
 * Validation rules for getting personal workspace
 */
export const getPersonalWorkspace = [
  // No additional validation needed - uses authenticated user context
]

/**
 * Validation rules for getting workspace statistics
 */
export const getWorkspaceStats = [
  validateUuidParam("id", "Invalid workspace ID"),

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

  query("includeTeams")
    .optional()
    .isBoolean()
    .withMessage("Include teams must be a boolean")
    .toBoolean(),

  query("includeMembers")
    .optional()
    .isBoolean()
    .withMessage("Include members must be a boolean")
    .toBoolean(),

  query("groupBy")
    .optional()
    .isIn(["day", "week", "month", "team", "project", "member", "status"])
    .withMessage("Group by must be one of: day, week, month, team, project, member, status"),
]

/**
 * Validation rules for archiving a workspace
 */
export const archiveWorkspace = [
  validateUuidParam("id", "Invalid workspace ID"),

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

  body("archiveTeams")
    .optional()
    .isBoolean()
    .withMessage("Archive teams must be a boolean"),
]

/**
 * Validation rules for restoring an archived workspace
 */
export const restoreWorkspace = [
  validateUuidParam("id", "Invalid workspace ID"),

  body("restoreProjects")
    .optional()
    .isBoolean()
    .withMessage("Restore projects must be a boolean"),

  body("restoreTeams")
    .optional()
    .isBoolean()
    .withMessage("Restore teams must be a boolean"),
]

/**
 * Validation rules for transferring workspace ownership
 */
export const transferWorkspaceOwnership = [
  validateUuidParam("id", "Invalid workspace ID"),

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

  body("transferAllData")
    .optional()
    .isBoolean()
    .withMessage("Transfer all data must be a boolean"),
]

/**
 * Validation rules for bulk operations on workspaces
 */
export const bulkUpdateWorkspaces = [
  body("workspaceIds")
    .notEmpty()
    .withMessage("Workspace IDs are required")
    .isArray({ min: 1, max: 25 })
    .withMessage("Workspace IDs must be an array with 1-25 items")
    .custom((workspaceIds) => {
      for (const id of workspaceIds) {
        if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
          throw new Error("Each workspace ID must be a valid UUID")
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
      const allowedFields = ["visibility", "tags", "isArchived", "type"]
      const providedFields = Object.keys(updates)
      const invalidFields = providedFields.filter(field => !allowedFields.includes(field))
      
      if (invalidFields.length > 0) {
        throw new Error(`Invalid update fields: ${invalidFields.join(", ")}`)
      }

      if (updates.visibility && !workspaceVisibilityValues.includes(updates.visibility)) {
        throw new Error(`Visibility must be one of: ${workspaceVisibilityValues.join(", ")}`)
      }

      if (updates.type && !workspaceTypeValues.includes(updates.type)) {
        throw new Error(`Type must be one of: ${workspaceTypeValues.join(", ")}`)
      }

      if (updates.tags && (!Array.isArray(updates.tags) || updates.tags.length > 15)) {
        throw new Error("Tags must be an array with maximum 15 items")
      }

      if (updates.isArchived !== undefined && typeof updates.isArchived !== "boolean") {
        throw new Error("isArchived must be a boolean")
      }

      return true
    }),
]

/**
 * Validation rules for duplicating a workspace
 */
export const duplicateWorkspace = [
  validateUuidParam("id", "Invalid workspace ID"),

  body("name")
    .notEmpty()
    .withMessage("New workspace name is required")
    .isString()
    .withMessage("Workspace name must be a string")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Workspace name must be between 1 and 100 characters"),

  body("includeTeams")
    .optional()
    .isBoolean()
    .withMessage("Include teams must be a boolean"),

  body("includeProjects")
    .optional()
    .isBoolean()
    .withMessage("Include projects must be a boolean"),

  body("includeMembers")
    .optional()
    .isBoolean()
    .withMessage("Include members must be a boolean"),

  body("includeSettings")
    .optional()
    .isBoolean()
    .withMessage("Include settings must be a boolean"),

  body("type")
    .optional()
    .isIn(workspaceTypeValues)
    .withMessage(`Type must be one of: ${workspaceTypeValues.join(", ")}`),
]

/**
 * Validation rules for workspace member management
 */
export const addWorkspaceMember = [
  validateUuidParam("id", "Invalid workspace ID"),

  body("userId")
    .notEmpty()
    .withMessage("User ID is required")
    .isUUID()
    .withMessage("User ID must be a valid UUID"),

  body("role")
    .optional()
    .isIn(["admin", "member", "viewer"])
    .withMessage("Role must be one of: admin, member, viewer"),

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
 * Validation rules for removing workspace member
 */
export const removeWorkspaceMember = [
  validateUuidParam("id", "Invalid workspace ID"),
  validateUuidParam("memberId", "Invalid member ID"),

  body("transferDataTo")
    .optional()
    .isUUID()
    .withMessage("Transfer data to must be a valid UUID"),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),
]

/**
 * Validation rules for updating workspace member role
 */
export const updateWorkspaceMemberRole = [
  validateUuidParam("id", "Invalid workspace ID"),
  validateUuidParam("memberId", "Invalid member ID"),

  body("role")
    .notEmpty()
    .withMessage("Role is required")
    .isIn(["admin", "member", "viewer"])
    .withMessage("Role must be one of: admin, member, viewer"),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),
]
