import { body, param, query } from "express-validator"
import { validateUuidParam, validatePagination, validateSort, validateTextContent, validateDateRange } from "./common.validator"

// Recurrence frequency enum values
const recurrenceFrequencyValues = ["daily", "weekly", "monthly", "yearly"] as const

// Priority enum values
const priorityValues = ["low", "medium", "high", "urgent"] as const

/**
 * Validation rules for creating a recurring task
 */
export const createRecurringTask = [
  validateTextContent("title", 1, 100, true),
  validateTextContent("description", 0, 1000, false),

  body("project")
    .optional()
    .isUUID()
    .withMessage("Project must be a valid UUID"),

  body("frequency")
    .notEmpty()
    .withMessage("Frequency is required")
    .isIn(recurrenceFrequencyValues)
    .withMessage(`Frequency must be one of: ${recurrenceFrequencyValues.join(", ")}`),

  body("interval")
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage("Interval must be between 1 and 365")
    .toInt(),

  body("daysOfWeek")
    .optional()
    .isArray()
    .withMessage("Days of week must be an array")
    .custom((daysOfWeek, { req }) => {
      if (req.body.frequency === "weekly" && (!daysOfWeek || daysOfWeek.length === 0)) {
        throw new Error("At least one day of week is required for weekly frequency")
      }
      if (Array.isArray(daysOfWeek)) {
        for (const day of daysOfWeek) {
          if (!Number.isInteger(day) || day < 0 || day > 6) {
            throw new Error("Day of week must be between 0 (Sunday) and 6 (Saturday)")
          }
        }
      }
      return true
    }),

  body("daysOfMonth")
    .optional()
    .isArray()
    .withMessage("Days of month must be an array")
    .custom((daysOfMonth, { req }) => {
      if (req.body.frequency === "monthly" && (!daysOfMonth || daysOfMonth.length === 0)) {
        throw new Error("At least one day of month is required for monthly frequency")
      }
      if (Array.isArray(daysOfMonth)) {
        for (const day of daysOfMonth) {
          if (!Number.isInteger(day) || day < 1 || day > 31) {
            throw new Error("Day of month must be between 1 and 31")
          }
        }
      }
      return true
    }),

  body("monthsOfYear")
    .optional()
    .isArray()
    .withMessage("Months of year must be an array")
    .custom((monthsOfYear, { req }) => {
      if (req.body.frequency === "yearly" && (!monthsOfYear || monthsOfYear.length === 0)) {
        throw new Error("At least one month of year is required for yearly frequency")
      }
      if (Array.isArray(monthsOfYear)) {
        for (const month of monthsOfYear) {
          if (!Number.isInteger(month) || month < 0 || month > 11) {
            throw new Error("Month of year must be between 0 (January) and 11 (December)")
          }
        }
      }
      return true
    }),

  body("startDate")
    .notEmpty()
    .withMessage("Start date is required")
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date")
    .toDate()
    .custom((startDate) => {
      const now = new Date()
      if (startDate < now) {
        throw new Error("Start date cannot be in the past")
      }
      return true
    }),

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

  body("active")
    .optional()
    .isBoolean()
    .withMessage("Active must be a boolean"),

  body("taskTemplate")
    .notEmpty()
    .withMessage("Task template is required")
    .isObject()
    .withMessage("Task template must be an object")
    .custom((taskTemplate) => {
      if (!taskTemplate.title || typeof taskTemplate.title !== "string" || taskTemplate.title.trim().length === 0) {
        throw new Error("Task template title is required")
      }
      if (taskTemplate.title.length > 100) {
        throw new Error("Task template title cannot be more than 100 characters long")
      }
      if (taskTemplate.description && typeof taskTemplate.description !== "string") {
        throw new Error("Task template description must be a string")
      }
      if (taskTemplate.description && taskTemplate.description.length > 1000) {
        throw new Error("Task template description cannot be more than 1000 characters long")
      }
      if (taskTemplate.priority && !priorityValues.includes(taskTemplate.priority)) {
        throw new Error(`Task template priority must be one of: ${priorityValues.join(", ")}`)
      }
      if (taskTemplate.tags && !Array.isArray(taskTemplate.tags)) {
        throw new Error("Task template tags must be an array")
      }
      if (taskTemplate.estimatedHours && (typeof taskTemplate.estimatedHours !== "number" || taskTemplate.estimatedHours < 0)) {
        throw new Error("Task template estimated hours must be a non-negative number")
      }
      if (taskTemplate.attachments && !Array.isArray(taskTemplate.attachments)) {
        throw new Error("Task template attachments must be an array")
      }
      if (Array.isArray(taskTemplate.attachments)) {
        for (const attachment of taskTemplate.attachments) {
          if (!attachment.filename || !attachment.path || !attachment.mimetype || typeof attachment.size !== "number") {
            throw new Error("Each attachment must have filename, path, mimetype, and size")
          }
        }
      }
      return true
    }),

  body("workspace")
    .optional()
    .isUUID()
    .withMessage("Workspace must be a valid UUID"),

  body("team")
    .optional()
    .isUUID()
    .withMessage("Team must be a valid UUID"),

  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),
]

/**
 * Validation rules for updating a recurring task
 */
export const updateRecurringTask = [
  validateUuidParam("id", "Invalid recurring task ID"),

  validateTextContent("title", 1, 100, false),
  validateTextContent("description", 0, 1000, false),

  body("project")
    .optional()
    .isUUID()
    .withMessage("Project must be a valid UUID"),

  body("frequency")
    .optional()
    .isIn(recurrenceFrequencyValues)
    .withMessage(`Frequency must be one of: ${recurrenceFrequencyValues.join(", ")}`),

  body("interval")
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage("Interval must be between 1 and 365")
    .toInt(),

  body("daysOfWeek")
    .optional()
    .isArray()
    .withMessage("Days of week must be an array")
    .custom((daysOfWeek) => {
      if (Array.isArray(daysOfWeek)) {
        for (const day of daysOfWeek) {
          if (!Number.isInteger(day) || day < 0 || day > 6) {
            throw new Error("Day of week must be between 0 (Sunday) and 6 (Saturday)")
          }
        }
      }
      return true
    }),

  body("daysOfMonth")
    .optional()
    .isArray()
    .withMessage("Days of month must be an array")
    .custom((daysOfMonth) => {
      if (Array.isArray(daysOfMonth)) {
        for (const day of daysOfMonth) {
          if (!Number.isInteger(day) || day < 1 || day > 31) {
            throw new Error("Day of month must be between 1 and 31")
          }
        }
      }
      return true
    }),

  body("monthsOfYear")
    .optional()
    .isArray()
    .withMessage("Months of year must be an array")
    .custom((monthsOfYear) => {
      if (Array.isArray(monthsOfYear)) {
        for (const month of monthsOfYear) {
          if (!Number.isInteger(month) || month < 0 || month > 11) {
            throw new Error("Month of year must be between 0 (January) and 11 (December)")
          }
        }
      }
      return true
    }),

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

  body("active")
    .optional()
    .isBoolean()
    .withMessage("Active must be a boolean"),

  body("taskTemplate")
    .optional()
    .isObject()
    .withMessage("Task template must be an object")
    .custom((taskTemplate) => {
      if (taskTemplate.title && (typeof taskTemplate.title !== "string" || taskTemplate.title.trim().length === 0)) {
        throw new Error("Task template title must be a non-empty string")
      }
      if (taskTemplate.title && taskTemplate.title.length > 100) {
        throw new Error("Task template title cannot be more than 100 characters long")
      }
      if (taskTemplate.description && typeof taskTemplate.description !== "string") {
        throw new Error("Task template description must be a string")
      }
      if (taskTemplate.description && taskTemplate.description.length > 1000) {
        throw new Error("Task template description cannot be more than 1000 characters long")
      }
      if (taskTemplate.priority && !priorityValues.includes(taskTemplate.priority)) {
        throw new Error(`Task template priority must be one of: ${priorityValues.join(", ")}`)
      }
      if (taskTemplate.tags && !Array.isArray(taskTemplate.tags)) {
        throw new Error("Task template tags must be an array")
      }
      if (taskTemplate.estimatedHours && (typeof taskTemplate.estimatedHours !== "number" || taskTemplate.estimatedHours < 0)) {
        throw new Error("Task template estimated hours must be a non-negative number")
      }
      if (taskTemplate.attachments && !Array.isArray(taskTemplate.attachments)) {
        throw new Error("Task template attachments must be an array")
      }
      return true
    }),

  body("workspace")
    .optional()
    .isUUID()
    .withMessage("Workspace must be a valid UUID"),

  body("team")
    .optional()
    .isUUID()
    .withMessage("Team must be a valid UUID"),

  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),
]

/**
 * Validation rules for getting a recurring task by ID
 */
export const getRecurringTask = [
  validateUuidParam("id", "Invalid recurring task ID"),
]

/**
 * Validation rules for deleting a recurring task
 */
export const deleteRecurringTask = [
  validateUuidParam("id", "Invalid recurring task ID"),

  body("deleteGeneratedTasks")
    .optional()
    .isBoolean()
    .withMessage("Delete generated tasks must be a boolean"),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),
]

/**
 * Validation rules for getting recurring tasks with filtering and pagination
 */
export const getRecurringTasks = [
  ...validatePagination,
  validateSort(["title", "createdAt", "updatedAt", "startDate", "frequency", "active"]),

  query("frequency")
    .optional()
    .isIn(recurrenceFrequencyValues)
    .withMessage(`Frequency must be one of: ${recurrenceFrequencyValues.join(", ")}`),

  query("active")
    .optional()
    .isBoolean()
    .withMessage("Active must be a boolean")
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

  query("search")
    .optional()
    .isString()
    .withMessage("Search must be a string")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search term must be between 1 and 100 characters"),

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

  query("hasEndDate")
    .optional()
    .isBoolean()
    .withMessage("Has end date must be a boolean")
    .toBoolean(),
]

/**
 * Validation rules for toggling recurring task active status
 */
export const toggleRecurringTaskActive = [
  validateUuidParam("id", "Invalid recurring task ID"),

  body("active")
    .notEmpty()
    .withMessage("Active status is required")
    .isBoolean()
    .withMessage("Active must be a boolean"),
]

/**
 * Validation rules for getting recurring task statistics
 */
export const getRecurringTaskStats = [
  query("frequency")
    .optional()
    .isIn(recurrenceFrequencyValues)
    .withMessage(`Frequency must be one of: ${recurrenceFrequencyValues.join(", ")}`),

  query("active")
    .optional()
    .isBoolean()
    .withMessage("Active must be a boolean")
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
    .isIn(["day", "week", "month", "frequency", "project", "workspace", "team"])
    .withMessage("Group by must be one of: day, week, month, frequency, project, workspace, team"),
]

/**
 * Validation rules for processing recurring tasks (Admin only)
 */
export const processRecurringTasks = [
  body("dryRun")
    .optional()
    .isBoolean()
    .withMessage("Dry run must be a boolean"),

  body("maxTasks")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("Max tasks must be between 1 and 1000")
    .toInt(),

  body("recurringTaskIds")
    .optional()
    .isArray()
    .withMessage("Recurring task IDs must be an array")
    .custom((recurringTaskIds) => {
      if (Array.isArray(recurringTaskIds)) {
        for (const id of recurringTaskIds) {
          if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
            throw new Error("Each recurring task ID must be a valid UUID")
          }
        }
      }
      return true
    }),

  body("processUntil")
    .optional()
    .isISO8601()
    .withMessage("Process until must be a valid ISO 8601 date")
    .toDate()
    .custom((processUntil) => {
      const now = new Date()
      const maxFuture = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
      if (processUntil > maxFuture) {
        throw new Error("Process until date cannot be more than 1 year in the future")
      }
      return true
    }),
]

/**
 * Validation rules for duplicating a recurring task
 */
export const duplicateRecurringTask = [
  validateUuidParam("id", "Invalid recurring task ID"),

  body("title")
    .optional()
    .isString()
    .withMessage("Title must be a string")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Title must be between 1 and 100 characters"),

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

  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date")
    .toDate(),

  body("active")
    .optional()
    .isBoolean()
    .withMessage("Active must be a boolean"),
]

/**
 * Validation rules for bulk operations on recurring tasks
 */
export const bulkUpdateRecurringTasks = [
  body("recurringTaskIds")
    .notEmpty()
    .withMessage("Recurring task IDs are required")
    .isArray({ min: 1, max: 50 })
    .withMessage("Recurring task IDs must be an array with 1-50 items")
    .custom((recurringTaskIds) => {
      for (const id of recurringTaskIds) {
        if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
          throw new Error("Each recurring task ID must be a valid UUID")
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
      const allowedFields = ["active", "project", "workspace", "team", "frequency", "interval"]
      const providedFields = Object.keys(updates)
      const invalidFields = providedFields.filter(field => !allowedFields.includes(field))
      
      if (invalidFields.length > 0) {
        throw new Error(`Invalid update fields: ${invalidFields.join(", ")}`)
      }

      if (updates.active !== undefined && typeof updates.active !== "boolean") {
        throw new Error("Active must be a boolean")
      }

      if (updates.frequency && !recurrenceFrequencyValues.includes(updates.frequency)) {
        throw new Error(`Frequency must be one of: ${recurrenceFrequencyValues.join(", ")}`)
      }

      if (updates.interval && (typeof updates.interval !== "number" || updates.interval < 1 || updates.interval > 365)) {
        throw new Error("Interval must be between 1 and 365")
      }

      return true
    }),
]

/**
 * Validation rules for getting next occurrence dates
 */
export const getNextOccurrences = [
  validateUuidParam("id", "Invalid recurring task ID"),

  query("count")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Count must be between 1 and 100")
    .toInt(),

  query("fromDate")
    .optional()
    .isISO8601()
    .withMessage("From date must be a valid ISO 8601 date")
    .toDate(),

  query("toDate")
    .optional()
    .isISO8601()
    .withMessage("To date must be a valid ISO 8601 date")
    .toDate()
    .custom((toDate, { req }) => {
      if (req.query?.fromDate && toDate < new Date(req.query.fromDate as string)) {
        throw new Error("To date must be after from date")
      }
      return true
    }),
]

/**
 * Validation rules for pausing/resuming a recurring task
 */
export const pauseRecurringTask = [
  validateUuidParam("id", "Invalid recurring task ID"),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),

  body("pauseUntil")
    .optional()
    .isISO8601()
    .withMessage("Pause until must be a valid ISO 8601 date")
    .toDate()
    .custom((pauseUntil) => {
      const now = new Date()
      if (pauseUntil <= now) {
        throw new Error("Pause until date must be in the future")
      }
      return true
    }),
]

/**
 * Validation rules for resuming a recurring task
 */
export const resumeRecurringTask = [
  validateUuidParam("id", "Invalid recurring task ID"),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),
]
