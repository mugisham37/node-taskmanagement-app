import { body, param, query } from "express-validator"
import { validateUuidParam, validatePagination, validateSort, validateHexColor, validateTextContent } from "./common.validator"

// Project status enum values
const projectStatusValues = ["planning", "active", "on_hold", "completed", "cancelled"] as const

/**
 * Validation rules for creating a project
 */
export const createProject = [
  body("name")
    .notEmpty()
    .withMessage("Project name is required")
    .isString()
    .withMessage("Project name must be a string")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Project name must be between 1 and 100 characters")
    .matches(/^[a-zA-Z0-9\s\-_\.]+$/)
    .withMessage("Project name can only contain letters, numbers, spaces, hyphens, underscores, and periods"),

  validateTextContent("description", 0, 1000, false),

  validateHexColor("color", false),

  body("workspaceId")
    .optional()
    .isUUID()
    .withMessage("Workspace ID must be a valid UUID"),

  body("teamId")
    .optional()
    .isUUID()
    .withMessage("Team ID must be a valid UUID"),

  body("status")
    .optional()
    .isIn(projectStatusValues)
    .withMessage(`Status must be one of: ${projectStatusValues.join(", ")}`),

  body("priority")
    .optional()
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("Priority must be one of: low, medium, high, urgent"),

  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date")
    .toDate(),

  body("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date")
    .toDate()
    .custom((endDate, { req }) => {
      if (endDate && req.body.startDate) {
        const startDate = new Date(req.body.startDate)
        if (endDate <= startDate) {
          throw new Error("End date must be after start date")
        }
      }
      return true
    }),

  body("budget")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Budget must be a positive number")
    .toFloat(),

  body("currency")
    .optional()
    .isString()
    .withMessage("Currency must be a string")
    .isLength({ min: 3, max: 3 })
    .withMessage("Currency must be a 3-character code")
    .matches(/^[A-Z]{3}$/)
    .withMessage("Currency must be a valid 3-letter uppercase code (e.g., USD, EUR)"),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array")
    .custom((tags) => {
      if (Array.isArray(tags)) {
        if (tags.length > 20) {
          throw new Error("Maximum 20 tags allowed")
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

  body("isTemplate")
    .optional()
    .isBoolean()
    .withMessage("isTemplate must be a boolean"),

  body("isArchived")
    .optional()
    .isBoolean()
    .withMessage("isArchived must be a boolean"),

  body("visibility")
    .optional()
    .isIn(["private", "team", "public"])
    .withMessage("Visibility must be one of: private, team, public"),

  body("settings")
    .optional()
    .isObject()
    .withMessage("Settings must be an object")
    .custom((settings) => {
      if (settings) {
        const allowedKeys = ["allowComments", "allowAttachments", "autoAssign", "notifications", "timeTracking"]
        const providedKeys = Object.keys(settings)
        const invalidKeys = providedKeys.filter(key => !allowedKeys.includes(key))
        
        if (invalidKeys.length > 0) {
          throw new Error(`Invalid settings keys: ${invalidKeys.join(", ")}`)
        }

        // Validate boolean settings
        const booleanFields = ["allowComments", "allowAttachments", "autoAssign", "timeTracking"]
        for (const field of booleanFields) {
          if (settings[field] !== undefined && typeof settings[field] !== "boolean") {
            throw new Error(`${field} must be a boolean`)
          }
        }

        // Validate notifications settings
        if (settings.notifications && typeof settings.notifications !== "object") {
          throw new Error("Notifications settings must be an object")
        }
      }
      return true
    }),

  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),
]

/**
 * Validation rules for updating a project
 */
export const updateProject = [
  validateUuidParam("id", "Invalid project ID"),

  body("name")
    .optional()
    .isString()
    .withMessage("Project name must be a string")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Project name must be between 1 and 100 characters")
    .matches(/^[a-zA-Z0-9\s\-_\.]+$/)
    .withMessage("Project name can only contain letters, numbers, spaces, hyphens, underscores, and periods"),

  validateTextContent("description", 0, 1000, false),

  validateHexColor("color", false),

  body("workspaceId")
    .optional()
    .isUUID()
    .withMessage("Workspace ID must be a valid UUID"),

  body("teamId")
    .optional()
    .isUUID()
    .withMessage("Team ID must be a valid UUID"),

  body("status")
    .optional()
    .isIn(projectStatusValues)
    .withMessage(`Status must be one of: ${projectStatusValues.join(", ")}`),

  body("priority")
    .optional()
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("Priority must be one of: low, medium, high, urgent"),

  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date")
    .toDate(),

  body("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date")
    .toDate()
    .custom((endDate, { req }) => {
      if (endDate && req.body.startDate) {
        const startDate = new Date(req.body.startDate)
        if (endDate <= startDate) {
          throw new Error("End date must be after start date")
        }
      }
      return true
    }),

  body("budget")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Budget must be a positive number")
    .toFloat(),

  body("currency")
    .optional()
    .isString()
    .withMessage("Currency must be a string")
    .isLength({ min: 3, max: 3 })
    .withMessage("Currency must be a 3-character code")
    .matches(/^[A-Z]{3}$/)
    .withMessage("Currency must be a valid 3-letter uppercase code (e.g., USD, EUR)"),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array")
    .custom((tags) => {
      if (Array.isArray(tags)) {
        if (tags.length > 20) {
          throw new Error("Maximum 20 tags allowed")
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

  body("isTemplate")
    .optional()
    .isBoolean()
    .withMessage("isTemplate must be a boolean"),

  body("isArchived")
    .optional()
    .isBoolean()
    .withMessage("isArchived must be a boolean"),

  body("visibility")
    .optional()
    .isIn(["private", "team", "public"])
    .withMessage("Visibility must be one of: private, team, public"),

  body("settings")
    .optional()
    .isObject()
    .withMessage("Settings must be an object")
    .custom((settings) => {
      if (settings) {
        const allowedKeys = ["allowComments", "allowAttachments", "autoAssign", "notifications", "timeTracking"]
        const providedKeys = Object.keys(settings)
        const invalidKeys = providedKeys.filter(key => !allowedKeys.includes(key))
        
        if (invalidKeys.length > 0) {
          throw new Error(`Invalid settings keys: ${invalidKeys.join(", ")}`)
        }

        const booleanFields = ["allowComments", "allowAttachments", "autoAssign", "timeTracking"]
        for (const field of booleanFields) {
          if (settings[field] !== undefined && typeof settings[field] !== "boolean") {
            throw new Error(`${field} must be a boolean`)
          }
        }

        if (settings.notifications && typeof settings.notifications !== "object") {
          throw new Error("Notifications settings must be an object")
        }
      }
      return true
    }),

  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),
]

/**
 * Validation rules for getting a project by ID
 */
export const getProject = [
  validateUuidParam("id", "Invalid project ID"),

  query("includeStats")
    .optional()
    .isBoolean()
    .withMessage("Include stats must be a boolean")
    .toBoolean(),

  query("includeTasks")
    .optional()
    .isBoolean()
    .withMessage("Include tasks must be a boolean")
    .toBoolean(),

  query("includeMembers")
    .optional()
    .isBoolean()
    .withMessage("Include members must be a boolean")
    .toBoolean(),
]

/**
 * Validation rules for deleting a project
 */
export const deleteProject = [
  validateUuidParam("id", "Invalid project ID"),

  body("transferTasksTo")
    .optional()
    .isUUID()
    .withMessage("Transfer tasks to must be a valid project UUID"),

  body("deleteAllTasks")
    .optional()
    .isBoolean()
    .withMessage("Delete all tasks must be a boolean"),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),
]

/**
 * Validation rules for getting projects with filtering and pagination
 */
export const getProjects = [
  ...validatePagination,
  validateSort(["name", "createdAt", "updatedAt", "startDate", "endDate", "status", "priority"]),

  query("workspaceId")
    .optional()
    .isUUID()
    .withMessage("Workspace ID must be a valid UUID"),

  query("teamId")
    .optional()
    .isUUID()
    .withMessage("Team ID must be a valid UUID"),

  query("status")
    .optional()
    .isIn(projectStatusValues)
    .withMessage(`Status must be one of: ${projectStatusValues.join(", ")}`),

  query("priority")
    .optional()
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("Priority must be one of: low, medium, high, urgent"),

  query("visibility")
    .optional()
    .isIn(["private", "team", "public"])
    .withMessage("Visibility must be one of: private, team, public"),

  query("includeArchived")
    .optional()
    .isBoolean()
    .withMessage("Include archived must be a boolean")
    .toBoolean(),

  query("includeTemplates")
    .optional()
    .isBoolean()
    .withMessage("Include templates must be a boolean")
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

  query("startDateFrom")
    .optional()
    .isISO8601()
    .withMessage("Start date from must be a valid ISO 8601 date")
    .toDate(),

  query("startDateTo")
    .optional()
    .isISO8601()
    .withMessage("Start date to must be a valid ISO 8601 date")
    .toDate(),

  query("endDateFrom")
    .optional()
    .isISO8601()
    .withMessage("End date from must be a valid ISO 8601 date")
    .toDate(),

  query("endDateTo")
    .optional()
    .isISO8601()
    .withMessage("End date to must be a valid ISO 8601 date")
    .toDate(),

  query("budgetMin")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Budget min must be a positive number")
    .toFloat(),

  query("budgetMax")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Budget max must be a positive number")
    .toFloat()
    .custom((budgetMax, { req }) => {
      if (req.query?.budgetMin && budgetMax < parseFloat(req.query.budgetMin as string)) {
        throw new Error("Budget max must be greater than budget min")
      }
      return true
    }),

  query("currency")
    .optional()
    .isString()
    .withMessage("Currency must be a string")
    .isLength({ min: 3, max: 3 })
    .withMessage("Currency must be a 3-character code")
    .matches(/^[A-Z]{3}$/)
    .withMessage("Currency must be a valid 3-letter uppercase code"),
]

/**
 * Validation rules for getting project tasks
 */
export const getProjectTasks = [
  validateUuidParam("id", "Invalid project ID"),
  ...validatePagination,
  validateSort(["title", "createdAt", "updatedAt", "dueDate", "startDate", "status", "priority", "assignedTo"]),

  query("status")
    .optional()
    .isIn(["todo", "in_progress", "review", "done", "cancelled"])
    .withMessage("Status must be one of: todo, in_progress, review, done, cancelled"),

  query("priority")
    .optional()
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("Priority must be one of: low, medium, high, urgent"),

  query("assignedTo")
    .optional()
    .isUUID()
    .withMessage("Assigned to must be a valid UUID"),

  query("search")
    .optional()
    .isString()
    .withMessage("Search must be a string")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search term must be between 1 and 100 characters"),
]

/**
 * Validation rules for getting project statistics
 */
export const getProjectStats = [
  validateUuidParam("id", "Invalid project ID"),

  query("period")
    .optional()
    .isIn(["week", "month", "quarter", "year", "all"])
    .withMessage("Period must be one of: week, month, quarter, year, all"),

  query("includeSubProjects")
    .optional()
    .isBoolean()
    .withMessage("Include sub projects must be a boolean")
    .toBoolean(),

  query("groupBy")
    .optional()
    .isIn(["day", "week", "month", "status", "priority", "assignee"])
    .withMessage("Group by must be one of: day, week, month, status, priority, assignee"),
]

/**
 * Validation rules for archiving a project
 */
export const archiveProject = [
  validateUuidParam("id", "Invalid project ID"),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),

  body("archiveTasks")
    .optional()
    .isBoolean()
    .withMessage("Archive tasks must be a boolean"),
]

/**
 * Validation rules for restoring an archived project
 */
export const restoreProject = [
  validateUuidParam("id", "Invalid project ID"),

  body("restoreTasks")
    .optional()
    .isBoolean()
    .withMessage("Restore tasks must be a boolean"),
]

/**
 * Validation rules for project status updates
 */
export const updateProjectStatus = [
  validateUuidParam("id", "Invalid project ID"),

  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(projectStatusValues)
    .withMessage(`Status must be one of: ${projectStatusValues.join(", ")}`),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),

  body("notifyMembers")
    .optional()
    .isBoolean()
    .withMessage("Notify members must be a boolean"),
]

/**
 * Validation rules for adding project members
 */
export const addProjectMembers = [
  validateUuidParam("id", "Invalid project ID"),

  body("members")
    .notEmpty()
    .withMessage("Members are required")
    .isArray({ min: 1 })
    .withMessage("Members must be a non-empty array")
    .custom((members) => {
      for (const member of members) {
        if (!member.userId || typeof member.userId !== "string") {
          throw new Error("Each member must have a valid userId")
        }
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(member.userId)) {
          throw new Error("Each member userId must be a valid UUID")
        }
        if (member.role && !["viewer", "member", "admin", "owner"].includes(member.role)) {
          throw new Error("Member role must be one of: viewer, member, admin, owner")
        }
      }
      return true
    }),

  body("sendInvitations")
    .optional()
    .isBoolean()
    .withMessage("Send invitations must be a boolean"),
]

/**
 * Validation rules for removing project members
 */
export const removeProjectMembers = [
  validateUuidParam("id", "Invalid project ID"),

  body("memberIds")
    .notEmpty()
    .withMessage("Member IDs are required")
    .isArray({ min: 1 })
    .withMessage("Member IDs must be a non-empty array")
    .custom((memberIds) => {
      for (const id of memberIds) {
        if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
          throw new Error("Each member ID must be a valid UUID")
        }
      }
      return true
    }),

  body("transferTasks")
    .optional()
    .isBoolean()
    .withMessage("Transfer tasks must be a boolean"),

  body("transferTo")
    .optional()
    .isUUID()
    .withMessage("Transfer to must be a valid UUID"),
]

/**
 * Validation rules for updating project member roles
 */
export const updateProjectMemberRole = [
  validateUuidParam("id", "Invalid project ID"),
  validateUuidParam("memberId", "Invalid member ID"),

  body("role")
    .notEmpty()
    .withMessage("Role is required")
    .isIn(["viewer", "member", "admin", "owner"])
    .withMessage("Role must be one of: viewer, member, admin, owner"),
]

/**
 * Validation rules for duplicating a project
 */
export const duplicateProject = [
  validateUuidParam("id", "Invalid project ID"),

  body("name")
    .notEmpty()
    .withMessage("New project name is required")
    .isString()
    .withMessage("Project name must be a string")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Project name must be between 1 and 100 characters"),

  body("includeTasks")
    .optional()
    .isBoolean()
    .withMessage("Include tasks must be a boolean"),

  body("includeMembers")
    .optional()
    .isBoolean()
    .withMessage("Include members must be a boolean"),

  body("includeSettings")
    .optional()
    .isBoolean()
    .withMessage("Include settings must be a boolean"),

  body("workspaceId")
    .optional()
    .isUUID()
    .withMessage("Workspace ID must be a valid UUID"),

  body("teamId")
    .optional()
    .isUUID()
    .withMessage("Team ID must be a valid UUID"),
]

/**
 * Validation rules for bulk operations on projects
 */
export const bulkUpdateProjects = [
  body("projectIds")
    .notEmpty()
    .withMessage("Project IDs are required")
    .isArray({ min: 1, max: 50 })
    .withMessage("Project IDs must be an array with 1-50 items")
    .custom((projectIds) => {
      for (const id of projectIds) {
        if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
          throw new Error("Each project ID must be a valid UUID")
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
      const allowedFields = ["status", "priority", "tags", "workspaceId", "teamId", "isArchived"]
      const providedFields = Object.keys(updates)
      const invalidFields = providedFields.filter(field => !allowedFields.includes(field))
      
      if (invalidFields.length > 0) {
        throw new Error(`Invalid update fields: ${invalidFields.join(", ")}`)
      }

      if (updates.status && !projectStatusValues.includes(updates.status)) {
        throw new Error(`Status must be one of: ${projectStatusValues.join(", ")}`)
      }

      if (updates.priority && !["low", "medium", "high", "urgent"].includes(updates.priority)) {
        throw new Error("Priority must be one of: low, medium, high, urgent")
      }

      if (updates.tags && (!Array.isArray(updates.tags) || updates.tags.length > 20)) {
        throw new Error("Tags must be an array with maximum 20 items")
      }

      if (updates.workspaceId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(updates.workspaceId)) {
        throw new Error("Workspace ID must be a valid UUID")
      }

      if (updates.teamId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(updates.teamId)) {
        throw new Error("Team ID must be a valid UUID")
      }

      if (updates.isArchived !== undefined && typeof updates.isArchived !== "boolean") {
        throw new Error("isArchived must be a boolean")
      }

      return true
    }),
]
