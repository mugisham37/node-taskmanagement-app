import type { Response, NextFunction } from "express"
import { asyncHandler } from "../utils/async-handler"
import { successResponse } from "../utils/response-formatter"
import { calendarEventService, calendarService } from "../services"
import type { AuthRequest } from "../middleware/auth"
import { validate } from "../middleware/validate.middleware"
import { calendarValidators } from "../validators"

// Validation middleware exports for use in routes
export const validateCreateCalendarEvent = validate(calendarValidators.createCalendarEvent)
export const validateUpdateCalendarEvent = validate(calendarValidators.updateCalendarEvent)
export const validateGetCalendarEvent = validate(calendarValidators.getCalendarEvent)
export const validateDeleteCalendarEvent = validate(calendarValidators.deleteCalendarEvent)
export const validateGetCalendarEvents = validate(calendarValidators.getCalendarEvents)
export const validateGetCalendarEventStats = validate(calendarValidators.getCalendarEventStats)
export const validateProcessEventReminders = validate(calendarValidators.processEventReminders)

/**
 * @desc    Create a new calendar event
 * @route   POST /api/v1/calendar/events
 * @access  Private
 */
export const createCalendarEvent = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const calendarEvent = await calendarEventService.createCalendarEvent(req.body, { 
    userId, 
    timestamp: new Date() 
  })

  successResponse(res, 201, calendarEvent, "Calendar event created successfully")
})

/**
 * @desc    Get all calendar events for the authenticated user
 * @route   GET /api/v1/calendar/events
 * @access  Private
 */
export const getCalendarEvents = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const result = await calendarEventService.getCalendarEvents(req.query, req.query, { 
    userId, 
    timestamp: new Date() 
  })

  successResponse(res, 200, result.data, "Calendar events retrieved successfully", {
    total: result.pagination.total,
    page: result.pagination.page,
    limit: result.pagination.limit,
    totalPages: result.pagination.totalPages,
    hasNext: result.pagination.hasNext,
    hasPrev: result.pagination.hasPrev,
  })
})

/**
 * @desc    Get a calendar event by ID
 * @route   GET /api/v1/calendar/events/:id
 * @access  Private
 */
export const getCalendarEventById = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const eventId = req.params.id
  const calendarEvent = await calendarEventService.getCalendarEventById(eventId, { 
    userId, 
    timestamp: new Date() 
  })

  successResponse(res, 200, calendarEvent, "Calendar event retrieved successfully")
})

/**
 * @desc    Update a calendar event
 * @route   PUT /api/v1/calendar/events/:id
 * @access  Private
 */
export const updateCalendarEvent = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const eventId = req.params.id
  const calendarEvent = await calendarEventService.updateCalendarEvent(eventId, req.body, { 
    userId, 
    timestamp: new Date() 
  })

  successResponse(res, 200, calendarEvent, "Calendar event updated successfully")
})

/**
 * @desc    Delete a calendar event
 * @route   DELETE /api/v1/calendar/events/:id
 * @access  Private
 */
export const deleteCalendarEvent = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const eventId = req.params.id
  await calendarEventService.deleteCalendarEvent(eventId, { 
    userId, 
    timestamp: new Date() 
  })

  successResponse(res, 200, {}, "Calendar event deleted successfully")
})

/**
 * @desc    Get calendar event statistics
 * @route   GET /api/v1/calendar/events/stats
 * @access  Private
 */
export const getCalendarEventStats = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
  const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined
  
  const dateRange = startDate && endDate ? { startDate, endDate } : undefined
  
  const stats = await calendarEventService.getCalendarEventStats(userId, dateRange, { 
    userId, 
    timestamp: new Date() 
  })

  successResponse(res, 200, stats, "Calendar event statistics retrieved successfully")
})

/**
 * @desc    Process event reminders manually
 * @route   POST /api/v1/calendar/reminders/process
 * @access  Private (Admin only)
 */
export const processEventReminders = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id as string
  
  // Process event reminders using the calendar service
  const remindersSent = await calendarService.processEventReminders({ 
    userId, 
    timestamp: new Date() 
  })

  successResponse(res, 200, { remindersSent }, "Event reminders processed successfully")
})
