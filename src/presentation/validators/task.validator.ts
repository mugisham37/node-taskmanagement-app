import { body, param, query } from "express-validator"
import { validateUuidParam, validatePagination, validateSort, validateTextContent, validateUuidArray } from "./common.validator"

// Task status enum values
const taskStatusValues = ["todo", "in_progress", "review", "done", "cancelled"] as const

// Task priority enum values
const taskPriorityValues = ["low", "medium", "high", "urgent"] as const

/**
 * Validation rules for creating a task
 */
export const createTask = [
  validateTextContent("title", 1, 200, true),
  validateTextContent("description", 0, 2000, false),

  body("projectId")
    .optional()
    .isUUID()
    .withMessage("Project ID must be a valid UUID"),

  body("workspaceId")
    .optional()
    .isUUID()
    .withMessage("Workspace ID must be a valid UUID"),

  body("teamId")
    .optional()
    .isUUID()
    .withMessage("Team ID must be a valid UUID"),

  body("assignedTo")
    .optional()
    .isUUID()
    .withMessage("Assigned to must be a valid UUID"),

  body("status")
    .optional()
    .isIn(taskStatusValues)
    .withMessage(`Status must be one of: ${taskStatusValues.join(", ")}`),

  body("priority")
    .optional()
    .isIn(taskPriorityValues)
    .withMessage(`Priority must be one of: ${taskPriorityValues.join(", ")}`),

  body("dueDate")
    .optional()
    .isISO8601()
    .withMessage("Due date must be a valid ISO 8601 date")
    .toDate()
    .custom((value) => {
      const now = new Date()
      if (value < now) {
        throw new Error("Due date cannot be in the past")
      }
      return true
    }),

  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date")
    .toDate(),

  body("estimatedHours")
    .optional()
    .isFloat({ min: 0, max: 1000 })
    .withMessage("Estimated hours must be between 0 and 1000")
    .toFloat(),

  body("actualHours")
    .optional()
    .isFloat({ min: 0, max: 1000 })
    .withMessage("Actual hours must be between 0 and 1000")
    .toFloat(),

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

  body("dependencies")
    .optional()
    .isArray()
    .withMessage("Dependencies must be an array")
    .custom((dependencies) => {
      if (Array.isArray(dependencies)) {
        if (dependencies.length > 20) {
          throw new Error("Maximum 20 dependencies allowed")
        }
        for (const dep of dependencies) {
          if (typeof dep !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(dep)) {
            throw new Error("Each dependency must be a valid UUID")
          }
        }
      }
      return true
    }),

  body("checklist")
    .optional()
    .isArray()
    .withMessage("Checklist must be an array")
    .custom((checklist) => {
      if (Array.isArray(checklist)) {
        if (checklist.length > 50) {
          throw new Error("Maximum 50 checklist items allowed")
        }
        for (const item of checklist) {
          if (!item.title || typeof item.title !== "string" || item.title.trim().length === 0) {
            throw new Error("Each checklist item must have a non-empty title")
          }
          if (item.title.length > 200) {
            throw new Error("Checklist item title must be 200 characters or less")
          }
          if (item.completed !== undefined && typeof item.completed !== "boolean") {
            throw new Error("Checklist item completed must be a boolean")
          }
        }
      }
      return true
    }),

  body("attachments")
    .optional()
    .isArray()
    .withMessage("Attachments must be an array")
    .custom((attachments) => {
      if (Array.isArray(attachments)) {
        if (attachments.length > 10) {
          throw new Error("Maximum 10 attachments allowed")
        }
        for (const attachment of attachments) {
          if (!attachment.filename || typeof attachment.filename !== "string") {
            throw new Error("Each attachment must have a valid filename")
          }
          if (!attachment.path || typeof attachment.path !== "string") {
            throw new Error("Each attachment must have a valid path")
          }
          if (!attachment.mimetype || typeof attachment.mimetype !== "string") {
            throw new Error("Each attachment must have a valid mimetype")
          }
          if (typeof attachment.size !== "number" || attachment.size <= 0) {
            throw new Error("Each attachment must have a valid size")
          }
          // Validate file size (max 50MB)
          if (attachment.size > 50 * 1024 * 1024) {
            throw new Error("Attachment size cannot exceed 50MB")
          }
        }
      }
      return true
    }),

  body("customFields")
    .optional()
    .isObject()
    .withMessage("Custom fields must be an object"),

  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),

  body("parentTaskId")
    .optional()
    .isUUID()
    .withMessage("Parent task ID must be a valid UUID"),

  body("isTemplate")
    .optional()
    .isBoolean()
    .withMessage("isTemplate must be a boolean"),

  body("templateId")
    .optional()
    .isUUID()
    .withMessage("Template ID must be a valid UUID"),

  body("recurringTaskId")
    .optional()
    .isUUID()
    .withMessage("Recurring task ID must be a valid UUID"),
]

/**
 * Validation rules for updating a task
 */
export const updateTask = [
  validateUuidParam("id", "Invalid task ID"),

  validateTextContent("title", 1, 200, false),
  validateTextContent("description", 0, 2000, false),

  body("projectId")
    .optional()
    .isUUID()
    .withMessage("Project ID must be a valid UUID"),

  body("workspaceId")
    .optional()
    .isUUID()
    .withMessage("Workspace ID must be a valid UUID"),

  body("teamId")
    .optional()
    .isUUID()
    .withMessage("Team ID must be a valid UUID"),

  body("assignedTo")
    .optional()
    .isUUID()
    .withMessage("Assigned to must be a valid UUID"),

  body("status")
    .optional()
    .isIn(taskStatusValues)
    .withMessage(`Status must be one of: ${taskStatusValues.join(", ")}`),

  body("priority")
    .optional()
    .isIn(taskPriorityValues)
    .withMessage(`Priority must be one of: ${taskPriorityValues.join(", ")}`),

  body("dueDate")
    .optional()
    .isISO8601()
    .withMessage("Due date must be a valid ISO 8601 date")
    .toDate(),

  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date")
    .toDate(),

  body("estimatedHours")
    .optional()
    .isFloat({ min: 0, max: 1000 })
    .withMessage("Estimated hours must be between 0 and 1000")
    .toFloat(),

  body("actualHours")
    .optional()
    .isFloat({ min: 0, max: 1000 })
    .withMessage("Actual hours must be between 0 and 1000")
    .toFloat(),

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

  body("dependencies")
    .optional()
    .isArray()
    .withMessage("Dependencies must be an array")
    .custom((dependencies) => {
      if (Array.isArray(dependencies)) {
        if (dependencies.length > 20) {
          throw new Error("Maximum 20 dependencies allowed")
        }
        for (const dep of dependencies) {
          if (typeof dep !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(dep)) {
            throw new Error("Each dependency must be a valid UUID")
          }
        }
      }
      return true
    }),

  body("checklist")
    .optional()
    .isArray()
    .withMessage("Checklist must be an array")
    .custom((checklist) => {
      if (Array.isArray(checklist)) {
        if (checklist.length > 50) {
          throw new Error("Maximum 50 checklist items allowed")
        }
        for (const item of checklist) {
          if (!item.title || typeof item.title !== "string" || item.title.trim().length === 0) {
            throw new Error("Each checklist item must have a non-empty title")
          }
          if (item.title.length > 200) {
            throw new Error("Checklist item title must be 200 characters or less")
          }
          if (item.completed !== undefined && typeof item.completed !== "boolean") {
            throw new Error("Checklist item completed must be a boolean")
          }
        }
      }
      return true
    }),

  body("attachments")
    .optional()
    .isArray()
    .withMessage("Attachments must be an array")
    .custom((attachments) => {
      if (Array.isArray(attachments)) {
        if (attachments.length > 10) {
          throw new Error("Maximum 10 attachments allowed")
        }
        for (const attachment of attachments) {
          if (!attachment.filename || typeof attachment.filename !== "string") {
            throw new Error("Each attachment must have a valid filename")
          }
          if (!attachment.path || typeof attachment.path !== "string") {
            throw new Error("Each attachment must have a valid path")
          }
          if (!attachment.mimetype || typeof attachment.mimetype !== "string") {
            throw new Error("Each attachment must have a valid mimetype")
          }
          if (typeof attachment.size !== "number" || attachment.size <= 0) {
            throw new Error("Each attachment must have a valid size")
          }
          if (attachment.size > 50 * 1024 * 1024) {
            throw new Error("Attachment size cannot exceed 50MB")
          }
        }
      }
      return true
    }),

  body("customFields")
    .optional()
    .isObject()
    .withMessage("Custom fields must be an object"),

  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),

  body("parentTaskId")
    .optional()
    .isUUID()
    .withMessage("Parent task ID must be a valid UUID"),

  body("completedAt")
    .optional()
    .isISO8601()
    .withMessage("Completed at must be a valid ISO 8601 date")
    .toDate(),
]

/**
 * Validation rules for getting a task by ID
 */
export const getTask = [
  validateUuidParam("id", "Invalid task ID"),

  query("includeComments")
    .optional()
    .isBoolean()
    .withMessage("Include comments must be a boolean")
    .toBoolean(),

  query("includeAttachments")
    .optional()
    .isBoolean()
    .withMessage("Include attachments must be a boolean")
    .toBoolean(),

  query("includeSubtasks")
    .optional()
    .isBoolean()
    .withMessage("Include subtasks must be a boolean")
    .toBoolean(),

  query("includeActivities")
    .optional()
    .isBoolean()
    .withMessage("Include activities must be a boolean")
    .toBoolean(),
]

/**
 * Validation rules for deleting a task
 */
export const deleteTask = [
  validateUuidParam("id", "Invalid task ID"),

  body("deleteSubtasks")
    .optional()
    .isBoolean()
    .withMessage("Delete subtasks must be a boolean"),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),
]

/**
 * Validation rules for getting tasks with filtering and pagination
 */
export const getTasks = [
  ...validatePagination,
  validateSort(["title", "createdAt", "updatedAt", "dueDate", "startDate", "status", "priority", "assignedTo"]),

  query("projectId")
    .optional()
    .isUUID()
    .withMessage("Project ID must be a valid UUID"),

  query("workspaceId")
    .optional()
    .isUUID()
    .withMessage("Workspace ID must be a valid UUID"),

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

  query("status")
    .optional()
    .isIn(taskStatusValues)
    .withMessage(`Status must be one of: ${taskStatusValues.join(", ")}`),

  query("priority")
    .optional()
    .isIn(taskPriorityValues)
    .withMessage(`Priority must be one of: ${taskPriorityValues.join(", ")}`),

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

  query("createdFrom")
    .optional()
    .isISO8601()
    .withMessage("Created from must be a valid ISO 8601 date")
    .toDate(),

  query("createdTo")
    .optional()
    .isISO8601()
    .withMessage("Created to must be a valid ISO 8601 date")
    .toDate(),

  query("isOverdue")
    .optional()
    .isBoolean()
    .withMessage("Is overdue must be a boolean")
    .toBoolean(),

  query("hasAttachments")
    .optional()
    .isBoolean()
    .withMessage("Has attachments must be a boolean")
    .toBoolean(),

  query("hasComments")
    .optional()
    .isBoolean()
    .withMessage("Has comments must be a boolean")
    .toBoolean(),

  query("hasSubtasks")
    .optional()
    .isBoolean()
    .withMessage("Has subtasks must be a boolean")
    .toBoolean(),

  query("parentTaskId")
    .optional()
    .isUUID()
    .withMessage("Parent task ID must be a valid UUID"),

  query("includeSubtasks")
    .optional()
    .isBoolean()
    .withMessage("Include subtasks must be a boolean")
    .toBoolean(),

  query("isTemplate")
    .optional()
    .isBoolean()
    .withMessage("Is template must be a boolean")
    .toBoolean(),

  query("templateId")
    .optional()
    .isUUID()
    .withMessage("Template ID must be a valid UUID"),

  query("recurringTaskId")
    .optional()
    .isUUID()
    .withMessage("Recurring task ID must be a valid UUID"),
]

/**
 * Validation rules for getting task statistics
 */
export const getTaskStats = [
  query("projectId")
    .optional()
    .isUUID()
    .withMessage("Project ID must be a valid UUID"),

  query("workspaceId")
    .optional()
    .isUUID()
    .withMessage("Workspace ID must be a valid UUID"),

  query("teamId")
    .optional()
    .isUUID()
    .withMessage("Team ID must be a valid UUID"),

  query("assignedTo")
    .optional()
    .isUUID()
    .withMessage("Assigned to must be a valid UUID"),

  query("period")
    .optional()
    .isIn(["week", "month", "quarter", "year", "all"])
    .withMessage("Period must be one of: week, month, quarter, year, all"),

  query("groupBy")
    .optional()
    .isIn(["day", "week", "month", "status", "priority", "assignee", "project"])
    .withMessage("Group by must be one of: day, week, month, status, priority, assignee, project"),

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
 * Validation rules for updating task status
 */
export const updateTaskStatus = [
  validateUuidParam("id", "Invalid task ID"),

  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .isIn(taskStatusValues)
    .withMessage(`Status must be one of: ${taskStatusValues.join(", ")}`),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),

  body("notifyAssignee")
    .optional()
    .isBoolean()
    .withMessage("Notify assignee must be a boolean"),
]

/**
 * Validation rules for updating task priority
 */
export const updateTaskPriority = [
  validateUuidParam("id", "Invalid task ID"),

  body("priority")
    .notEmpty()
    .withMessage("Priority is required")
    .isIn(taskPriorityValues)
    .withMessage(`Priority must be one of: ${taskPriorityValues.join(", ")}`),

  body("reason")
    .optional()
    .isString()
    .withMessage("Reason must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Reason cannot exceed 500 characters"),

  body("notifyAssignee")
    .optional()
    .isBoolean()
    .withMessage("Notify assignee must be a boolean"),
]

/**
 * Validation rules for assigning a task
 */
export const assignTask = [
  validateUuidParam("id", "Invalid task ID"),

  body("assignedTo")
    .notEmpty()
    .withMessage("Assigned to is required")
    .isUUID()
    .withMessage("Assigned to must be a valid UUID"),

  body("notifyAssignee")
    .optional()
    .isBoolean()
    .withMessage("Notify assignee must be a boolean"),

  body("message")
    .optional()
    .isString()
    .withMessage("Message must be a string")
    .trim()
    .isLength({ max: 500 })
    .withMessage("Message cannot exceed 500 characters"),
]

/**
 * Validation rules for bulk operations on tasks
 */
export const bulkUpdateTasks = [
  body("taskIds")
    .notEmpty()
    .withMessage("Task IDs are required")
    .isArray({ min: 1, max: 100 })
    .withMessage("Task IDs must be an array with 1-100 items")
    .custom((taskIds) => {
      for (const id of taskIds) {
        if (typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
          throw new Error("Each task ID must be a valid UUID")
        }
      }
      return true
    }),

  body("operation")
    .notEmpty()
    .withMessage("Operation is required")
    .isIn(["update_status", "assign", "move_project", "add_tags", "remove_tags", "delete"])
    .withMessage("Operation must be one of: update_status, assign, move_project, add_tags, remove_tags, delete"),

  body("data")
    .notEmpty()
    .withMessage("Data is required")
    .isObject()
    .withMessage("Data must be an object")
    .custom((data, { req }) => {
      const operation = req.body.operation

      switch (operation) {
        case "update_status":
          if (!data.status || !taskStatusValues.includes(data.status)) {
            throw new Error(`Status must be one of: ${taskStatusValues.join(", ")}`)
          }
          break
        case "assign":
          if (!data.assignedTo || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.assignedTo)) {
            throw new Error("Assigned to must be a valid UUID")
          }
          break
        case "move_project":
          if (data.projectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.projectId)) {
            throw new Error("Project ID must be a valid UUID")
          }
          break
        case "add_tags":
        case "remove_tags":
          if (!Array.isArray(data.tags) || data.tags.length === 0) {
            throw new Error("Tags must be a non-empty array")
          }
          for (const tag of data.tags) {
            if (typeof tag !== "string" || tag.trim().length === 0) {
              throw new Error("Each tag must be a non-empty string")
            }
          }
          break
        case "delete":
          // No additional validation needed for delete
          break
      }

      return true
    }),
]

/**
 * Validation rules for duplicating a task
 */
export const duplicateTask = [
  validateUuidParam("id", "Invalid task ID"),

  body("title")
    .optional()
    .isString()
    .withMessage("Title must be a string")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Title must be between 1 and 200 characters"),

  body("projectId")
    .optional()
    .isUUID()
    .withMessage("Project ID must be a valid UUID"),

  body("includeSubtasks")
    .optional()
    .isBoolean()
    .withMessage("Include subtasks must be a boolean"),

  body("includeAttachments")
    .optional()
    .isBoolean()
    .withMessage("Include attachments must be a boolean"),

  body("includeComments")
    .optional()
    .isBoolean()
    .withMessage("Include comments must be a boolean"),

  body("resetDates")
    .optional()
    .isBoolean()
    .withMessage("Reset dates must be a boolean"),

  body("resetAssignee")
    .optional()
    .isBoolean()
    .withMessage("Reset assignee must be a boolean"),
]

/**
 * Validation rules for adding task attachments
 */
export const addTaskAttachment = [
  validateUuidParam("id", "Invalid task ID"),
  // File validation will be handled by multer middleware
]

/**
 * Validation rules for removing task attachments
 */
export const removeTaskAttachment = [
  validateUuidParam("id", "Invalid task ID"),
  validateUuidParam("attachmentId", "Invalid attachment ID"),
]

/**
 * Validation rules for updating task checklist
 */
export const updateTaskChecklist = [
  validateUuidParam("id", "Invalid task ID"),

  body("checklist")
    .notEmpty()
    .withMessage("Checklist is required")
    .isArray()
    .withMessage("Checklist must be an array")
    .custom((checklist) => {
      if (checklist.length > 50) {
        throw new Error("Maximum 50 checklist items allowed")
      }
      for (const item of checklist) {
        if (!item.title || typeof item.title !== "string" || item.title.trim().length === 0) {
          throw new Error("Each checklist item must have a non-empty title")
        }
        if (item.title.length > 200) {
          throw new Error("Checklist item title must be 200 characters or less")
        }
        if (item.completed !== undefined && typeof item.completed !== "boolean") {
          throw new Error("Checklist item completed must be a boolean")
        }
      }
      return true
    }),
]

/**
 * Validation rules for adding task dependencies
 */
export const addTaskDependencies = [
  validateUuidParam("id", "Invalid task ID"),

  body("dependencies")
    .notEmpty()
    .withMessage("Dependencies are required")
    .isArray({ min: 1 })
    .withMessage("Dependencies must be a non-empty array")
    .custom((dependencies) => {
      if (dependencies.length > 20) {
        throw new Error("Maximum 20 dependencies allowed")
      }
      for (const dep of dependencies) {
        if (typeof dep !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(dep)) {
          throw new Error("Each dependency must be a valid UUID")
        }
      }
      return true
    }),
]

/**
 * Validation rules for removing task dependencies
 */
export const removeTaskDependencies = [
  validateUuidParam("id", "Invalid task ID"),

  body("dependencies")
    .notEmpty()
    .withMessage("Dependencies are required")
    .isArray({ min: 1 })
    .withMessage("Dependencies must be a non-empty array")
    .custom((dependencies) => {
      for (const dep of dependencies) {
        if (typeof dep !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(dep)) {
          throw new Error("Each dependency must be a valid UUID")
        }
      }
      return true
    }),
]
