import { body, param, query } from "express-validator"
import { validateUuidParam, validatePagination, validateSort, validateTextContent } from "./common.validator"

// Priority enum values
const priorityValues = ["low", "medium", "high", "urgent"] as const

/**
 * Validation rules for creating a task template
 */
export const createTaskTemplate = [
  validateTextContent("name", 1, 100, true),
  validateTextContent("description", 0, 500, false),

  body("project")
    .optional()
    .isUUID()
    .withMessage("Project must be a valid UUID"),

  body("workspace")
    .optional()
    .isUUID()
    .withMessage("Workspace must be a valid UUID"),

  body("team")
    .optional()
    .isUUID()
    .withMessage("Team must be a valid UUID"),

  body("isPublic")
    .optional()
    .isBoolean()
    .withMessage("Is public must be a boolean"),

  body("category")
    .optional()
    .isString()
    .withMessage("Category must be a string")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Category must be between 1 and 50 characters")
    .matches(/^[a-zA-Z0-9\s\-_]+$/)
    .withMessage("Category can only contain letters, numbers, spaces, hyphens, and underscores"),

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
        }
      }
      return true
    }),

  body("taskData")
    .notEmpty()
    .withMessage("Task data is required")
    .isObject()
    .withMessage("Task data must be an object")
    .custom((taskData) => {
      // Validate task title
      if (!taskData.title || typeof taskData.title !== "string" || taskData.title.trim().length === 0) {
        throw new Error("Task title is required")
      }
      if (taskData.title.length > 100) {
        throw new Error("Task title cannot be more than 100 characters long")
      }

      // Validate task description
      if (taskData.description && typeof taskData.description !== "string") {
        throw new Error("Task description must be a string")
      }
      if (taskData.description && taskData.description.length > 1000) {
        throw new Error("Task description cannot be more than 1000 characters long")
      }

      // Validate priority
      if (taskData.priority && !priorityValues.includes(taskData.priority)) {
        throw new Error(`Task priority must be one of: ${priorityValues.join(", ")}`)
      }

      // Validate tags
      if (taskData.tags && !Array.isArray(taskData.tags)) {
        throw new Error("Task tags must be an array")
      }
      if (Array.isArray(taskData.tags)) {
        if (taskData.tags.length > 20) {
          throw new Error("Maximum 20 task tags allowed")
        }
        for (const tag of taskData.tags) {
          if (typeof tag !== "string" || tag.trim().length === 0) {
            throw new Error("Each task tag must be a non-empty string")
          }
          if (tag.length > 30) {
            throw new Error("Each task tag must be 30 characters or less")
          }
        }
      }

      // Validate estimated hours
      if (taskData.estimatedHours && (typeof taskData.estimatedHours !== "number" || taskData.estimatedHours < 0)) {
        throw new Error("Task estimated hours must be a non-negative number")
      }
      if (taskData.estimatedHours && taskData.estimatedHours > 1000) {
        throw new Error("Task estimated hours cannot exceed 1000")
      }

      // Validate checklist
      if (taskData.checklist && !Array.isArray(taskData.checklist)) {
        throw new Error("Task checklist must be an array")
      }
      if (Array.isArray(taskData.checklist)) {
        if (taskData.checklist.length > 50) {
          throw new Error("Maximum 50 checklist items allowed")
        }
        for (const item of taskData.checklist) {
          if (!item.title || typeof item.title !== "string" || item.title.trim().length === 0) {
            throw new Error("Each checklist item must have a title")
          }
          if (item.title.length > 100) {
            throw new Error("Checklist item title cannot be more than 100 characters long")
          }
          if (item.completed !== undefined && typeof item.completed !== "boolean") {
            throw new Error("Checklist item completed must be a boolean")
          }
        }
      }

      // Validate attachments
      if (taskData.attachments && !Array.isArray(taskData.attachments)) {
        throw new Error("Task attachments must be an array")
      }
      if (Array.isArray(taskData.attachments)) {
        if (taskData.attachments.length > 10) {
          throw new Error("Maximum 10 task attachments allowed")
        }
        for (const attachment of taskData.attachments) {
          if (!attachment.filename || !attachment.path || !attachment.mimetype || typeof attachment.size !== "number") {
            throw new Error("Each attachment must have filename, path, mimetype, and size")
          }
          if (attachment.size > 50 * 1024 * 1024) {
            throw new Error("Attachment size cannot exceed 50MB")
          }
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
 * Validation rules for updating a task template
 */
export const updateTaskTemplate = [
  validateUuidParam("id", "Invalid task template ID"),

  validateTextContent("name", 1, 100, false),
  validateTextContent("description", 0, 500, false),

  body("project")
    .optional()
    .isUUID()
    .withMessage("Project must be a valid UUID"),

  body("workspace")
    .optional()
    .isUUID()
    .withMessage("Workspace must be a valid UUID"),

  body("team")
    .optional()
    .isUUID()
    .withMessage("Team must be a valid UUID"),

  body("isPublic")
    .optional()
    .isBoolean()
    .withMessage("Is public must be a boolean"),

  body("category")
    .optional()
    .isString()
    .withMessage("Category must be a string")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Category must be between 1 and 50 characters"),

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
        }
      }
      return true
    }),

  body("taskData")
    .optional()
    .isObject()
    .withMessage("Task data must be an object")
    .custom((taskData) => {
      if (taskData.title && (typeof taskData.title !== "string" || taskData.title.trim().length === 0)) {
        throw new Error("Task title must be a non-empty string")
      }
      if (taskData.title && taskData.title.length > 100) {
        throw new Error("Task title cannot be more than 100 characters long")
      }
      if (taskData.description && typeof taskData.description !== "string") {
        throw new Error("Task description must be a string")
      }
      if (taskData.description && taskData.description.length > 1000) {
        throw new Error("Task description cannot be more than 1000 characters long")
      }
      if (taskData.priority && !priorityValues.includes(taskData.priority)) {
        throw new Error(`Task priority must be one of: ${priorityValues.join(", ")}`)
      }
      if (taskData.tags && !Array.isArray(taskData.tags)) {
        throw new Error("Task tags must be an array")
      }
      if (taskData.estimatedHours && (typeof taskData.estimatedHours !== "number" || taskData.estimatedHours < 0)) {
        throw new Error("Task estimated hours must be a non-negative number")
      }
      if (taskData.checklist && !Array.isArray(taskData.checklist)) {
        throw new Error("Task checklist must be an array")
      }
      if (taskData.attachments && !Array.isArray(taskData.attachments)) {
        throw new Error("Task attachments must be an array")
      }
      return true
    }),

  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),
]

/**
 * Validation rules for getting a task template by ID
 */
export const getTaskTemplate = [
  validateUuidParam("id", "Invalid task template ID"),
]

/**
 * Validation rules for deleting a task template
 */
export const deleteTaskTemplate = [
  validateUuidParam("id", "Invalid task template ID"),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),
]

/**
 * Validation rules for getting task templates with filtering and pagination
 */
export const getTaskTemplates = [
  ...validatePagination,
  validateSort(["name", "createdAt", "updatedAt", "category", "isPublic"]),

  query("category")
    .optional()
    .isString()
    .withMessage("Category must be a string")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Category must be between 1 and 50 characters"),

  query("isPublic")
    .optional()
    .isBoolean()
    .withMessage("Is public must be a boolean")
    .toBoolean(),

  query("project")
    .optional()
    .isUUID()
    .withMessage("Project must be a valid UUID"),

  query("workspace")
    .optional()
    .isUUID()
    .withMessage("Workspace must be a valid UUID"),

  query("team")
    .optional()
    .isUUID()
    .withMessage("Team must be a valid UUID"),

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

  query("priority")
    .optional()
    .isIn(priorityValues)
    .withMessage(`Priority must be one of: ${priorityValues.join(", ")}`),

  query("hasChecklist")
    .optional()
    .isBoolean()
    .withMessage("Has checklist must be a boolean")
    .toBoolean(),

  query("hasAttachments")
    .optional()
    .isBoolean()
    .withMessage("Has attachments must be a boolean")
    .toBoolean(),

  query("estimatedHoursMin")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Estimated hours min must be a non-negative number")
    .toFloat(),

  query("estimatedHoursMax")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Estimated hours max must be a non-negative number")
    .toFloat()
    .custom((max, { req }) => {
      if (req.query?.estimatedHoursMin && max < parseFloat(req.query.estimatedHoursMin as string)) {
        throw new Error("Estimated hours max must be greater than or equal to min")
      }
      return true
    }),
]

/**
 * Validation rules for creating a task from template
 */
export const createTaskFromTemplate = [
  validateUuidParam("id", "Invalid task template ID"),

  body("project")
    .optional()
    .isUUID()
    .withMessage("Project must be a valid UUID"),

  body("assignedTo")
    .optional()
    .isUUID()
    .withMessage("Assigned to must be a valid UUID"),

  body("dueDate")
    .optional()
    .isISO8601()
    .withMessage("Due date must be a valid ISO 8601 date")
    .toDate()
    .custom((dueDate) => {
      const now = new Date()
      if (dueDate < now) {
        throw new Error("Due date cannot be in the past")
      }
      return true
    }),

  body("priority")
    .optional()
    .isIn(priorityValues)
    .withMessage(`Priority must be one of: ${priorityValues.join(", ")}`),

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
        }
      }
      return true
    }),

  body("customFields")
    .optional()
    .isObject()
    .withMessage("Custom fields must be an object"),

  body("overrides")
    .optional()
    .isObject()
    .withMessage("Overrides must be an object")
    .custom((overrides) => {
      if (overrides.title && (typeof overrides.title !== "string" || overrides.title.trim().length === 0)) {
        throw new Error("Override title must be a non-empty string")
      }
      if (overrides.title && overrides.title.length > 100) {
        throw new Error("Override title cannot be more than 100 characters long")
      }
      if (overrides.description && typeof overrides.description !== "string") {
        throw new Error("Override description must be a string")
      }
      if (overrides.description && overrides.description.length > 1000) {
        throw new Error("Override description cannot be more than 1000 characters long")
      }
      if (overrides.estimatedHours && (typeof overrides.estimatedHours !== "number" || overrides.estimatedHours < 0)) {
        throw new Error("Override estimated hours must be a non-negative number")
      }
      return true
    }),
]

/**
 * Validation rules for duplicating a task template
 */
export const duplicateTaskTemplate = [
  validateUuidParam("id", "Invalid task template ID"),

  body("name")
    .optional()
    .isString()
    .withMessage("Name must be a string")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Name must be between 1 and 100 characters"),

  body("project")
    .optional()
    .isUUID()
    .withMessage("Project must be a valid UUID"),

  body("workspace")
    .optional()
    .isUUID()
    .withMessage("Workspace must be a valid UUID"),

  body("team")
    .optional()
    .isUUID()
    .withMessage("Team must be a valid UUID"),

  body("isPublic")
    .optional()
    .isBoolean()
    .withMessage("Is public must be a boolean"),

  body("category")
    .optional()
    .isString()
    .withMessage("Category must be a string")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Category must be between 1 and 50 characters"),
]

/**
 * Validation rules for getting task template categories
 */
export const getTaskTemplateCategories = [
  query("workspace")
    .optional()
    .isUUID()
    .withMessage("Workspace must be a valid UUID"),

  query("team")
    .optional()
    .isUUID()
    .withMessage("Team must be a valid UUID"),

  query("includePublic")
    .optional()
    .isBoolean()
    .withMessage("Include public must be a boolean")
    .toBoolean(),
]

/**
 * Validation rules for getting public task templates
 */
export const getPublicTaskTemplates = [
  ...validatePagination,
  validateSort(["name", "createdAt", "category", "usageCount"]),

  query("category")
    .optional()
    .isString()
    .withMessage("Category must be a string")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Category must be between 1 and 50 characters"),

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
    .withMessage("Tags filter must be a string"),

  query("priority")
    .optional()
    .isIn(priorityValues)
    .withMessage(`Priority must be one of: ${priorityValues.join(", ")}`),

  query("featured")
    .optional()
    .isBoolean()
    .withMessage("Featured must be a boolean")
    .toBoolean(),
]

/**
 * Validation rules for getting task template statistics
 */
export const getTaskTemplateStats = [
  query("category")
    .optional()
    .isString()
    .withMessage("Category must be a string")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Category must be between 1 and 50 characters"),

  query("isPublic")
    .optional()
    .isBoolean()
    .withMessage("Is public must be a boolean")
    .toBoolean(),

  query("project")
    .optional()
    .isUUID()
    .withMessage("Project must be a valid UUID"),

  query("workspace")
    .optional()
    .isUUID()
    .withMessage("Workspace must be a valid UUID"),

  query("team")
    .optional()
    .isUUID()
    .withMessage("Team must be a valid UUID"),

  query("createdBy")
    .optional()
    .isUUID()
    .withMessage("Created by must be a valid UUID"),

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
    .isIn(["day", "week", "month", "category", "creator", "project", "workspace", "team"])
    .withMessage("Group by must be one of: day, week, month, category, creator, project, workspace, team"),
]

/**
 * Validation rules for bulk operations on task templates
 */
export const bulkUpdateTaskTemplates = [
  body("templateIds")
    .notEmpty()
    .withMessage("Template IDs are required")
    .isArray({ min: 1, max: 50 })
    .withMessage("Template IDs must be an array with 1-50 items")
    .custom((templateIds) => {
      for (const id of templateIds) {
        if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
          throw new Error("Each template ID must be a valid UUID")
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
      const allowedFields = ["category", "isPublic", "tags", "project", "workspace", "team"]
      const providedFields = Object.keys(updates)
      const invalidFields = providedFields.filter(field => !allowedFields.includes(field))
      
      if (invalidFields.length > 0) {
        throw new Error(`Invalid update fields: ${invalidFields.join(", ")}`)
      }

      if (updates.isPublic !== undefined && typeof updates.isPublic !== "boolean") {
        throw new Error("Is public must be a boolean")
      }

      if (updates.category && (typeof updates.category !== "string" || updates.category.length > 50)) {
        throw new Error("Category must be a string with maximum 50 characters")
      }

      if (updates.tags && (!Array.isArray(updates.tags) || updates.tags.length > 20)) {
        throw new Error("Tags must be an array with maximum 20 items")
      }

      return true
    }),
]

/**
 * Validation rules for importing task templates
 */
export const importTaskTemplates = [
  body("templates")
    .notEmpty()
    .withMessage("Templates are required")
    .isArray({ min: 1, max: 100 })
    .withMessage("Templates must be an array with 1-100 items"),

  body("workspace")
    .optional()
    .isUUID()
    .withMessage("Workspace must be a valid UUID"),

  body("team")
    .optional()
    .isUUID()
    .withMessage("Team must be a valid UUID"),

  body("overrideExisting")
    .optional()
    .isBoolean()
    .withMessage("Override existing must be a boolean"),

  body("validateOnly")
    .optional()
    .isBoolean()
    .withMessage("Validate only must be a boolean"),
]

/**
 * Validation rules for exporting task templates
 */
export const exportTaskTemplates = [
  body("templateIds")
    .optional()
    .isArray()
    .withMessage("Template IDs must be an array")
    .custom((templateIds) => {
      if (Array.isArray(templateIds)) {
        for (const id of templateIds) {
          if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
            throw new Error("Each template ID must be a valid UUID")
          }
        }
      }
      return true
    }),

  body("format")
    .optional()
    .isIn(["json", "csv"])
    .withMessage("Format must be json or csv"),

  body("includeTaskData")
    .optional()
    .isBoolean()
    .withMessage("Include task data must be a boolean"),

  body("filters")
    .optional()
    .isObject()
    .withMessage("Filters must be an object"),
]
