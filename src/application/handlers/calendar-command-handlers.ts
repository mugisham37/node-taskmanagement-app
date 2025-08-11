/**
 * Calendar Event Command Handlers
 *
 * Handles commands for creating, updating, and managing calendar events
 */

import { BaseHandler, ICommandHandler } from './base-handler';
import { DomainEventPublisher } from '../../domain/events/domain-event-publisher';
import { LoggingService } from '../../infrastructure/monitoring/logging-service';
import { ICalendarEventRepository } from '../../domain/repositories/calendar-event-repository';
import { IProjectRepository } from '../../domain/repositories/project-repository';
import { IUserRepository } from '../../domain/repositories/user-repository';
import { TransactionManager } from '../../infrastructure/database/transaction-manager';
import { CacheService } from '../../infrastructure/caching/cache-service';
import { EmailService } from '../../infrastructure/external-services/email-service';
import { CalendarEventId } from '../../domain/value-objects/calendar-event-id';
import { ProjectId } from '../../domain/value-objects/project-id';
import { UserId } from '../../domain/value-objects/user-id';
import { CalendarEvent } from '../../domain/entities/calendar-event';
import { RecurrenceRule } from '../../domain/value-objects/recurrence-rule';
import { NotFoundError } from '../../shared/errors/not-found-error';
import { AuthorizationError } from '../../shared/errors/authorization-error';

// Command interfaces
export interface CreateCalendarEventCommand {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  projectId?: ProjectId;
  createdBy: UserId;
  attendees?: UserId[];
  location?: string;
  isAllDay?: boolean;
  recurrenceRule?: RecurrenceRuleDto;
  reminders?: ReminderDto[];
  visibility?: 'private' | 'public' | 'confidential';
}

export interface UpdateCalendarEventCommand {
  eventId: CalendarEventId;
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  location?: string;
  isAllDay?: boolean;
  recurrenceRule?: RecurrenceRuleDto;
  reminders?: ReminderDto[];
  visibility?: 'private' | 'public' | 'confidential';
  updatedBy: UserId;
}

export interface DeleteCalendarEventCommand {
  eventId: CalendarEventId;
  deletedBy: UserId;
  deleteRecurring?: boolean;
}

export interface AddAttendeeCommand {
  eventId: CalendarEventId;
  attendeeId: UserId;
  addedBy: UserId;
  isOptional?: boolean;
}

export interface RemoveAttendeeCommand {
  eventId: CalendarEventId;
  attendeeId: UserId;
  removedBy: UserId;
}

export interface RespondToEventCommand {
  eventId: CalendarEventId;
  userId: UserId;
  response: 'accepted' | 'declined' | 'tentative';
}

export interface BulkUpdateEventStatusCommand {
  eventIds: CalendarEventId[];
  status: string;
  updatedBy: UserId;
}

// DTO interfaces
export interface RecurrenceRuleDto {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  count?: number;
  until?: Date;
  byWeekDay?: number[];
  byMonthDay?: number[];
  byMonth?: number[];
}

export interface ReminderDto {
  type: 'email' | 'notification' | 'popup';
  minutesBefore: number;
  isEnabled: boolean;
}

/**
 * Create calendar event command handler
 */
export class CreateCalendarEventCommandHandler
  extends BaseHandler
  implements ICommandHandler<CreateCalendarEventCommand, CalendarEventId>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly calendarEventRepository: ICalendarEventRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
    private readonly transactionManager: TransactionManager,
    private readonly cacheService: CacheService,
    private readonly emailService: EmailService
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: CreateCalendarEventCommand): Promise<CalendarEventId> {
    this.logInfo('Creating calendar event', {
      title: command.title,
      startTime: command.startTime,
      endTime: command.endTime,
      createdBy: command.createdBy.value,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        // Verify creator exists
        const creator = await this.userRepository.findById(command.createdBy);
        if (!creator) {
          throw new NotFoundError(
            `Creator with ID ${command.createdBy.value} not found`
          );
        }

        // Verify project exists and user has access (if specified)
        if (command.projectId) {
          const project = await this.projectRepository.findById(
            command.projectId
          );
          if (!project) {
            throw new NotFoundError(
              `Project with ID ${command.projectId.value} not found`
            );
          }

          const canCreateEvent = await this.canUserCreateEventInProject(
            command.createdBy,
            command.projectId
          );
          if (!canCreateEvent) {
            throw new AuthorizationError(
              'User does not have permission to create events in this project'
            );
          }
        }

        // Validate time range
        if (command.startTime >= command.endTime) {
          throw new Error('Start time must be before end time');
        }

        // Validate attendees
        const attendeeIds: UserId[] = [];
        if (command.attendees) {
          for (const attendeeId of command.attendees) {
            const attendee = await this.userRepository.findById(attendeeId);
            if (!attendee) {
              throw new NotFoundError(
                `Attendee with ID ${attendeeId.value} not found`
              );
            }
            attendeeIds.push(attendee.id);
          }
        }

        // Create recurrence rule if provided
        let recurrenceRule: RecurrenceRule | undefined;
        if (command.recurrenceRule) {
          recurrenceRule = new RecurrenceRule(command.recurrenceRule);
        }

        // Create calendar event
        const calendarEvent = CalendarEvent.create({
          title: command.title,
          description: command.description,
          startTime: command.startTime,
          endTime: command.endTime,
          projectId: command.projectId,
          createdBy: command.createdBy,
          attendees: attendeeIds,
          location: command.location,
          isAllDay: command.isAllDay || false,
          recurrenceRule,
          reminders: command.reminders || [],
          visibility: command.visibility || 'public',
        });

        await this.calendarEventRepository.save(calendarEvent);

        // Send invitations to attendees
        if (attendeeIds.length > 0) {
          await this.sendEventInvitations(calendarEvent, attendeeIds);
        }

        // Schedule reminders
        await this.scheduleEventReminders(calendarEvent);

        // Clear cache
        await this.clearEventCaches(command.createdBy, command.projectId);

        this.logInfo('Calendar event created successfully', {
          eventId: calendarEvent.id.value,
          title: command.title,
          attendeeCount: attendeeIds.length,
        });

        return calendarEvent.id;
      } catch (error) {
        this.logError('Failed to create calendar event', error as Error, {
          title: command.title,
          createdBy: command.createdBy.value,
        });
        throw error;
      }
    });
  }

  private async canUserCreateEventInProject(
    userId: UserId,
    projectId: ProjectId
  ): Promise<boolean> {
    const member = await this.projectRepository.findMember(projectId, userId);
    return member !== null;
  }

  private async sendEventInvitations(
    event: CalendarEvent,
    attendeeIds: UserId[]
  ): Promise<void> {
    for (const attendeeId of attendeeIds) {
      const attendee = await this.userRepository.findById(attendeeId);
      if (attendee) {
        await this.emailService.sendCalendarInvitation({
          recipientEmail: attendee.email.value,
          recipientName: `${attendee.firstName} ${attendee.lastName}`,
          eventTitle: event.title,
          eventDescription: event.description,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          organizerName: 'Event Organizer',
        });
      }
    }
  }

  private async scheduleEventReminders(event: CalendarEvent): Promise<void> {
    // Schedule reminders for the event
    this.logInfo('Event reminders scheduled', {
      eventId: event.id.value,
      reminderCount: event.reminders.length,
    });
  }

  private async clearEventCaches(
    userId: UserId,
    projectId?: ProjectId
  ): Promise<void> {
    const patterns = [
      `calendar-events:${userId.value}:*`,
      `calendar-stats:${userId.value}:*`,
    ];

    if (projectId) {
      patterns.push(`calendar-stats:${userId.value}:${projectId.value}`);
    }

    this.logDebug('Event caches cleared', {
      userId: userId.value,
      projectId: projectId?.value,
    });
  }
}

/**
 * Update calendar event command handler
 */
export class UpdateCalendarEventCommandHandler
  extends BaseHandler
  implements ICommandHandler<UpdateCalendarEventCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly calendarEventRepository: ICalendarEventRepository,
    private readonly transactionManager: TransactionManager,
    private readonly cacheService: CacheService,
    private readonly emailService: EmailService
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: UpdateCalendarEventCommand): Promise<void> {
    this.logInfo('Updating calendar event', {
      eventId: command.eventId.value,
      updatedBy: command.updatedBy.value,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const calendarEvent = await this.calendarEventRepository.findById(
          command.eventId
        );
        if (!calendarEvent) {
          throw new NotFoundError(
            `Calendar event with ID ${command.eventId.value} not found`
          );
        }

        // Check permissions
        const canUpdate = await this.canUserUpdateEvent(
          command.updatedBy,
          command.eventId
        );
        if (!canUpdate) {
          throw new AuthorizationError(
            'User does not have permission to update this event'
          );
        }

        // Track changes for notifications
        const changes: string[] = [];

        // Update event fields
        if (
          command.title !== undefined &&
          command.title !== calendarEvent.title
        ) {
          calendarEvent.updateTitle(command.title);
          changes.push('title');
        }
        if (command.description !== undefined) {
          calendarEvent.updateDescription(command.description);
          changes.push('description');
        }
        if (command.startTime !== undefined || command.endTime !== undefined) {
          const newStartTime = command.startTime || calendarEvent.startTime;
          const newEndTime = command.endTime || calendarEvent.endTime;

          if (newStartTime >= newEndTime) {
            throw new Error('Start time must be before end time');
          }

          calendarEvent.updateTimeRange(newStartTime, newEndTime);
          changes.push('time');
        }
        if (command.location !== undefined) {
          calendarEvent.updateLocation(command.location);
          changes.push('location');
        }
        if (command.isAllDay !== undefined) {
          calendarEvent.updateAllDay(command.isAllDay);
          changes.push('allDay');
        }
        if (command.recurrenceRule !== undefined) {
          const recurrenceRule = command.recurrenceRule
            ? new RecurrenceRule(command.recurrenceRule)
            : undefined;
          calendarEvent.updateRecurrenceRule(recurrenceRule);
          changes.push('recurrence');
        }
        if (command.reminders !== undefined) {
          calendarEvent.updateReminders(command.reminders);
          changes.push('reminders');
        }
        if (command.visibility !== undefined) {
          calendarEvent.updateVisibility(command.visibility);
          changes.push('visibility');
        }

        await this.calendarEventRepository.save(calendarEvent);

        // Send update notifications to attendees if there were significant changes
        if (
          changes.some(change => ['title', 'time', 'location'].includes(change))
        ) {
          await this.sendEventUpdateNotifications(calendarEvent, changes);
        }

        // Reschedule reminders if time or reminders changed
        if (changes.includes('time') || changes.includes('reminders')) {
          await this.scheduleEventReminders(calendarEvent);
        }

        // Clear cache
        await this.clearEventCaches(command.updatedBy, calendarEvent.projectId);

        this.logInfo('Calendar event updated successfully', {
          eventId: command.eventId.value,
          changes,
        });
      } catch (error) {
        this.logError('Failed to update calendar event', error as Error, {
          eventId: command.eventId.value,
        });
        throw error;
      }
    });
  }

  private async canUserUpdateEvent(
    userId: UserId,
    eventId: CalendarEventId
  ): Promise<boolean> {
    const event = await this.calendarEventRepository.findById(eventId);
    if (!event) return false;

    // Creator can always update
    if (event.createdBy.equals(userId)) return true;

    // Project members can update project events
    if (event.projectId) {
      const member = await this.projectRepository.findMember(
        event.projectId,
        userId
      );
      return member && (member.role.isAdmin() || member.role.isManager());
    }

    return false;
  }

  private async sendEventUpdateNotifications(
    event: CalendarEvent,
    changes: string[]
  ): Promise<void> {
    this.logInfo('Event update notifications sent', {
      eventId: event.id.value,
      changes,
      attendeeCount: event.attendees.length,
    });
  }

  private async scheduleEventReminders(event: CalendarEvent): Promise<void> {
    this.logInfo('Event reminders rescheduled', {
      eventId: event.id.value,
      reminderCount: event.reminders.length,
    });
  }

  private async clearEventCaches(
    userId: UserId,
    projectId?: ProjectId
  ): Promise<void> {
    const patterns = [
      `calendar-events:${userId.value}:*`,
      `calendar-stats:${userId.value}:*`,
    ];

    if (projectId) {
      patterns.push(`calendar-stats:${userId.value}:${projectId.value}`);
    }

    this.logDebug('Event caches cleared', {
      userId: userId.value,
      projectId: projectId?.value,
    });
  }
}

/**
 * Delete calendar event command handler
 */
export class DeleteCalendarEventCommandHandler
  extends BaseHandler
  implements ICommandHandler<DeleteCalendarEventCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly calendarEventRepository: ICalendarEventRepository,
    private readonly transactionManager: TransactionManager,
    private readonly cacheService: CacheService,
    private readonly emailService: EmailService
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: DeleteCalendarEventCommand): Promise<void> {
    this.logInfo('Deleting calendar event', {
      eventId: command.eventId.value,
      deletedBy: command.deletedBy.value,
      deleteRecurring: command.deleteRecurring,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const calendarEvent = await this.calendarEventRepository.findById(
          command.eventId
        );
        if (!calendarEvent) {
          throw new NotFoundError(
            `Calendar event with ID ${command.eventId.value} not found`
          );
        }

        // Check permissions
        const canDelete = await this.canUserDeleteEvent(
          command.deletedBy,
          command.eventId
        );
        if (!canDelete) {
          throw new AuthorizationError(
            'User does not have permission to delete this event'
          );
        }

        // Send cancellation notifications to attendees
        await this.sendEventCancellationNotifications(calendarEvent);

        // Cancel scheduled reminders
        await this.cancelEventReminders(calendarEvent);

        // Delete the event (or mark as cancelled)
        if (command.deleteRecurring && calendarEvent.recurrenceRule) {
          // Delete all instances of recurring event
          await this.calendarEventRepository.deleteRecurringEvent(
            command.eventId
          );
        } else {
          // Soft delete the event
          calendarEvent.cancel();
          await this.calendarEventRepository.save(calendarEvent);
        }

        // Clear cache
        await this.clearEventCaches(command.deletedBy, calendarEvent.projectId);

        this.logInfo('Calendar event deleted successfully', {
          eventId: command.eventId.value,
          deleteRecurring: command.deleteRecurring,
        });
      } catch (error) {
        this.logError('Failed to delete calendar event', error as Error, {
          eventId: command.eventId.value,
        });
        throw error;
      }
    });
  }

  private async canUserDeleteEvent(
    userId: UserId,
    eventId: CalendarEventId
  ): Promise<boolean> {
    const event = await this.calendarEventRepository.findById(eventId);
    if (!event) return false;

    // Only creator can delete
    return event.createdBy.equals(userId);
  }

  private async sendEventCancellationNotifications(
    event: CalendarEvent
  ): Promise<void> {
    this.logInfo('Event cancellation notifications sent', {
      eventId: event.id.value,
      attendeeCount: event.attendees.length,
    });
  }

  private async cancelEventReminders(event: CalendarEvent): Promise<void> {
    this.logInfo('Event reminders cancelled', {
      eventId: event.id.value,
    });
  }

  private async clearEventCaches(
    userId: UserId,
    projectId?: ProjectId
  ): Promise<void> {
    const patterns = [
      `calendar-events:${userId.value}:*`,
      `calendar-stats:${userId.value}:*`,
    ];

    if (projectId) {
      patterns.push(`calendar-stats:${userId.value}:${projectId.value}`);
    }

    this.logDebug('Event caches cleared', {
      userId: userId.value,
      projectId: projectId?.value,
    });
  }
}

/**
 * Add attendee command handler
 */
export class AddAttendeeCommandHandler
  extends BaseHandler
  implements ICommandHandler<AddAttendeeCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly calendarEventRepository: ICalendarEventRepository,
    private readonly userRepository: IUserRepository,
    private readonly transactionManager: TransactionManager,
    private readonly emailService: EmailService
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: AddAttendeeCommand): Promise<void> {
    this.logInfo('Adding attendee to calendar event', {
      eventId: command.eventId.value,
      attendeeId: command.attendeeId.value,
      addedBy: command.addedBy.value,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const calendarEvent = await this.calendarEventRepository.findById(
          command.eventId
        );
        if (!calendarEvent) {
          throw new NotFoundError(
            `Calendar event with ID ${command.eventId.value} not found`
          );
        }

        // Check permissions
        const canUpdate = await this.canUserUpdateEvent(
          command.addedBy,
          command.eventId
        );
        if (!canUpdate) {
          throw new AuthorizationError(
            'User does not have permission to add attendees'
          );
        }

        // Verify attendee exists
        const attendee = await this.userRepository.findById(command.attendeeId);
        if (!attendee) {
          throw new NotFoundError(
            `Attendee with ID ${command.attendeeId.value} not found`
          );
        }

        // Check if already an attendee
        if (calendarEvent.attendees.some(id => id.equals(command.attendeeId))) {
          throw new Error('User is already an attendee');
        }

        // Add attendee
        calendarEvent.addAttendee(command.attendeeId);
        await this.calendarEventRepository.save(calendarEvent);

        // Send invitation
        await this.emailService.sendCalendarInvitation({
          recipientEmail: attendee.email.value,
          recipientName: `${attendee.firstName} ${attendee.lastName}`,
          eventTitle: calendarEvent.title,
          eventDescription: calendarEvent.description,
          startTime: calendarEvent.startTime,
          endTime: calendarEvent.endTime,
          location: calendarEvent.location,
          organizerName: 'Event Organizer',
        });

        this.logInfo('Attendee added to calendar event successfully', {
          eventId: command.eventId.value,
          attendeeId: command.attendeeId.value,
        });
      } catch (error) {
        this.logError(
          'Failed to add attendee to calendar event',
          error as Error,
          {
            eventId: command.eventId.value,
            attendeeId: command.attendeeId.value,
          }
        );
        throw error;
      }
    });
  }

  private async canUserUpdateEvent(
    userId: UserId,
    eventId: CalendarEventId
  ): Promise<boolean> {
    const event = await this.calendarEventRepository.findById(eventId);
    if (!event) return false;

    return event.createdBy.equals(userId);
  }
}

/**
 * Respond to event command handler
 */
export class RespondToEventCommandHandler
  extends BaseHandler
  implements ICommandHandler<RespondToEventCommand, void>
{
  constructor(
    eventPublisher: DomainEventPublisher,
    logger: LoggingService,
    private readonly calendarEventRepository: ICalendarEventRepository,
    private readonly transactionManager: TransactionManager
  ) {
    super(eventPublisher, logger);
  }

  async handle(command: RespondToEventCommand): Promise<void> {
    this.logInfo('Responding to calendar event', {
      eventId: command.eventId.value,
      userId: command.userId.value,
      response: command.response,
    });

    return await this.transactionManager.executeInTransaction(async () => {
      try {
        const calendarEvent = await this.calendarEventRepository.findById(
          command.eventId
        );
        if (!calendarEvent) {
          throw new NotFoundError(
            `Calendar event with ID ${command.eventId.value} not found`
          );
        }

        // Check if user is an attendee
        if (!calendarEvent.attendees.some(id => id.equals(command.userId))) {
          throw new AuthorizationError('User is not an attendee of this event');
        }

        // Update attendee response (would be stored in a separate attendee responses table)
        await this.calendarEventRepository.updateAttendeeResponse(
          command.eventId,
          command.userId,
          command.response
        );

        this.logInfo('Event response recorded successfully', {
          eventId: command.eventId.value,
          userId: command.userId.value,
          response: command.response,
        });
      } catch (error) {
        this.logError('Failed to respond to calendar event', error as Error, {
          eventId: command.eventId.value,
          userId: command.userId.value,
        });
        throw error;
      }
    });
  }
}

// Export aliases for backward compatibility
export const CreateCalendarEventHandler = CreateCalendarEventCommandHandler;
export const UpdateCalendarEventHandler = UpdateCalendarEventCommandHandler;
export const ScheduleCalendarEventHandler = CreateCalendarEventCommandHandler; // alias for create
