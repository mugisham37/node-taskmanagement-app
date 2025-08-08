import express from "express"
import { validate } from "../middleware/validate.middleware"
import { authenticate } from "../middleware/auth"
import { taskValidators, commentValidators, activityValidators } from "../validators"
import * as taskController from "../controllers/task.controller"
import * as commentController from "../controllers/comment.controller"
import * as activityController from "../controllers/activity.controller"
import { upload } from "../middleware/upload.middleware"

const router = express.Router()

// All routes require authentication
router.use(authenticate())

// Get all tasks for the authenticated user
router.get("/", validate(taskValidators.getTasks), taskController.getTasks)

// Create a new task
router.post("/", validate(taskValidators.createTask), taskController.createTask)

// Get task analytics
router.get("/analytics", taskController.getTaskAnalytics)

// Get a task by ID
router.get("/:id", validate(taskValidators.getTask), taskController.getTask)

// Update a task
router.put("/:id", validate(taskValidators.updateTask), taskController.updateTask)

// Delete a task
router.delete("/:id", validate(taskValidators.deleteTask), taskController.deleteTask)

// Update task status
router.patch("/:id/status", validate(taskValidators.updateTaskStatus), taskController.updateTaskStatus)

// Update task priority
router.patch("/:id/priority", validate(taskValidators.updateTaskPriority), taskController.updateTaskPriority)

// Add attachment to a task
router.post(
  "/:id/attachments",
  validate(taskValidators.addTaskAttachment),
  upload.single("attachment"),
  taskController.addTaskAttachment,
)

// Remove attachment from a task
router.delete(
  "/:id/attachments/:attachmentId",
  validate(taskValidators.removeTaskAttachment),
  taskController.removeTaskAttachment,
)

// Get task comments
router.get("/:taskId/comments", validate(commentValidators.getTaskComments), commentController.getTaskComments)

// Create a comment on a task
router.post("/:taskId/comments", validate(commentValidators.createComment), commentController.createComment)

// Get task activities
router.get("/:taskId/activities", validate(activityValidators.getTaskActivities), activityController.getTaskActivities)

export default router
