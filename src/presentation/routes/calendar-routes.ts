import { FastifyInstance } from 'fastify';
import { CalendarController } from '../controllers/calendar-controller';
import { AuthMiddleware, RateLimitMiddleware } from '../middleware';

export async function calendarRoutes(
  fastify: FastifyInstance,
  container: any
): Promise<void> {
  const calendarController = container.resolve('CALENDAR_CONTROLLER');
  const authMiddleware = container.resolve('AUTH_MIDDLEWARE');
  const rateLimitMiddleware = container.resolve('RATE_LIMIT_MIDDLEWARE');
  // All calendar routes require authentication
  const commonPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.MODERATE),
  ];

  const readPreHandlers = [
    authMiddleware.authenticate,
    rateLimitMiddleware.createRateLimit(RateLimitMiddleware.LENIENT),
  ];

  // Calendar event CRUD operations
  fastify.post('/events', {
    preHandler: commonPreHandlers,
    handler: calendarController.createEvent,
  });

  fastify.get('/events', {
    preHandler: readPreHandlers,
    handler: calendarController.getEvents,
  });

  fastify.get('/events/upcoming', {
    preHandler: readPreHandlers,
    handler: calendarController.getUpcomingEvents,
  });

  fastify.get('/events/today', {
    preHandler: readPreHandlers,
    handler: calendarController.getTodayEvents,
  });

  fastify.get('/events/:id', {
    preHandler: readPreHandlers,
    handler: calendarController.getEvent,
  });

  fastify.put('/events/:id', {
    preHandler: commonPreHandlers,
    handler: calendarController.updateEvent,
  });

  fastify.delete('/events/:id', {
    preHandler: commonPreHandlers,
    handler: calendarController.deleteEvent,
  });

  // Event attendees management
  fastify.post('/events/:id/attendees', {
    preHandler: commonPreHandlers,
    handler: calendarController.addEventAttendee,
  });

  fastify.delete('/events/:id/attendees/:attendeeId', {
    preHandler: commonPreHandlers,
    handler: calendarController.removeEventAttendee,
  });

  fastify.patch('/events/:id/attendees/:attendeeId/response', {
    preHandler: commonPreHandlers,
    handler: calendarController.respondToEvent,
  });

  // Recurring events
  fastify.post('/events/:id/recurrence', {
    preHandler: commonPreHandlers,
    handler: calendarController.createRecurringEvent,
  });

  fastify.put('/events/:id/recurrence', {
    preHandler: commonPreHandlers,
    handler: calendarController.updateRecurringEvent,
  });

  fastify.delete('/events/:id/recurrence', {
    preHandler: commonPreHandlers,
    handler: calendarController.deleteRecurringEvent,
  });

  // Calendar views
  fastify.get('/view/month', {
    preHandler: readPreHandlers,
    handler: calendarController.getMonthView,
  });

  fastify.get('/view/week', {
    preHandler: readPreHandlers,
    handler: calendarController.getWeekView,
  });

  fastify.get('/view/day', {
    preHandler: readPreHandlers,
    handler: calendarController.getDayView,
  });

  // Calendar integration
  fastify.get('/export', {
    preHandler: readPreHandlers,
    handler: calendarController.exportCalendar,
  });

  fastify.post('/import', {
    preHandler: commonPreHandlers,
    handler: calendarController.importCalendar,
  });

  // Reminders
  fastify.post('/events/:id/reminders', {
    preHandler: commonPreHandlers,
    handler: calendarController.addReminder,
  });

  fastify.delete('/events/:id/reminders/:reminderId', {
    preHandler: commonPreHandlers,
    handler: calendarController.removeReminder,
  });
}
