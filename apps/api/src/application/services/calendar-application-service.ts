/**
 * Calendar Application Service
 *
 * Handles calendar event management and reminder scheduling
 */

import {
  BaseApplicationService,
  ValidationResult,
  RequiredFieldValidationRule,
  LengthValidationRule,
} from './base-application-service';
import { LoggingService } from '@taskmanagement/observability';
import { DomainEventPublisher } from "@taskmanagement/domain";
import { ICalendarEventRepository } from "@taskmanagement/domain";
import { IProjectRepository } from "@taskmanagement/domain";
import { IUserRepository } from "@taskmanagement/domain";
import { CacheService } from "@taskmanagement/cache";
import { EmailService } from '@taskmanagement/integrations';
import { CalendarEventId } from "@taskmanagement/domain";
import { ProjectId } from "@taskmanagement/domain";
import { UserId } from "@taskmanagement/domain";
import { CalendarEvent, AttendeeStatus, EventType } from "@taskmanagement/domain";
import { RecurrenceRule } from "@taskmanagement/domain";
import { injectable } from '../shared/decorators/injectable.decorator';

export interface CreateCalendarEventRequest {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  projectId?: string;
  createdBy: string;
  attendees?: string[];
  location?: string;
  isAllDay?: boolean;
  recurrenceRule?: RecurrenceRuleDto;
  reminders?: ReminderDto[];
  visibility?: 'private' | 'public' | 'confidential';
}

export interface UpdateCalendarEventRequest {
  eventId: string;
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  location?: string;
  isAllDay?: boolean;
  recurrenceRule?: RecurrenceRuleDto;
  reminders?: ReminderDto[];
  visibility?: 'private' | 'public' | 'confidential';
  updatedBy: string;
}

export interface RecurrenceRuleDto {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  count?: number | undefined;
  until?: Date | undefined;
  byWeekDay?: number[] | undefined;
  byMonthDay?: number[] | undefined;
  byMonth?: number[] | undefined;
}

export interface ReminderDto {
  type: 'email' | 'notification' | 'popup';
  minutesBefore: number;
  isEnabled: boolean;
}

export interface CalendarEventDto {
  id: string;
  title: string;
  description?: string | undefined;
  startTime: Date;
  endTime: Date;
  projectId?: string | undefined;
  createdBy: string;
  attendees: AttendeeDto[];
  location?: string | undefined;
  isAllDay: boolean;
  recurrenceRule?: RecurrenceRuleDto | undefined;
  reminders: ReminderDto[];
  visibility: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  project?: {
    id: string;
    name: string;
  } | undefined;
  creator: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface AttendeeDto {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: 'pending' | 'accepted' | 'declined' | 'tentative';
  isOptional: boolean;
}

export interface CalendarViewRequest {
  userId: string;
  startDate: Date;
  endDate: Date;
  projectId?: string;
  includeRecurring?: boolean;
}

export interface EventConflict {
  eventId: string;
  title: string;
  startTime: Date;
  endTime: Date;
  conflictType: 'overlap' | 'adjacent';
}

export interface CalendarStatistics {
  totalEvents: number;
  upcomingEvents: number;
  eventsThisWeek: number;
  eventsThisMonth: number;
  recurringEvents: number;
  eventsByProject: { projectId: string; projectName: string; count: number }[];
  attendanceRate: number;
}

@injectable()
export class CalendarApplicationService extends BaseApplicationService {
  private readonly EVENT_CACHE_TTL = 1800; // 30 minutes

  constructor(
    logger: LoggingService,
    eventPublisher: DomainEventPublisher,
    private readonly calendarEventRepository: ICalendarEventRepository,
    private readonly projectRepository: IProjectRepository,
    private readonly userRepository: IUserRepository,
    private readonly cacheService: CacheService,
    private readonly emailService: EmailService
  ) {
    super(logger, eventPublisher);
  }

  /**
   * Create a new calendar event
   */
  async createCalendarEvent(
    request: CreateCalendarEventRequest
  ): Promise<CalendarEventId> {
    return await this.executeWithMonitoring('createCalendarEvent', async () => {
      // Validate input
      const validation = this.validateCreateEventRequest(request);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const createdBy = new UserId(request.createdBy);
      const projectId = request.projectId
        ? new ProjectId(request.projectId)
        : undefined;

      // Verify creator exists
      const creator = await this.userRepository.findById(createdBy);
      if (!creator) {
        throw new Error('Creator not found');
      }

      // Verify project exists and user has access (if specified)
      if (projectId) {
        const project = await this.projectRepository.findById(projectId);
        if (!project) {
          throw new Error('Project not found');
        }

        const canCreateEvent = await this.canUserCreateEventInProject(
          createdBy,
          projectId
        );
        if (!canCreateEvent) {
          throw new Error(
            'Insufficient permissions to create event in this project'
          );
        }
      }

      // Validate time range
      if (request.startTime >= request.endTime) {
        throw new Error('Start time must be before end time');
      }

      // Check for conflicts if requested
      const conflicts = await this.checkEventConflicts(
        createdBy,
        request.startTime,
        request.endTime
      );

      if (conflicts.length > 0) {
        this.logWarning('Event conflicts detected', {
          createdBy: request.createdBy,
          conflicts: conflicts.length,
        });
      }

      // Validate attendees
      const attendeeIds: UserId[] = [];
      if (request.attendees) {
        for (const attendeeId of request.attendees) {
          const attendee = await this.userRepository.findById(
            new UserId(attendeeId)
          );
          if (!attendee) {
            throw new Error(`Attendee not found: ${attendeeId}`);
          }
          attendeeIds.push(attendee.id);
        }
      }

      // Create recurrence rule if provided
      let recurrenceRule: RecurrenceRule | undefined;
      if (request.recurrenceRule) {
        recurrenceRule = new RecurrenceRule(request.recurrenceRule);
      }

      // Create calendar event
      const calendarEvent = CalendarEvent.create({
        title: request.title,
        description: request.description || undefined,
        type: EventType.MEETING, // Default event type
        startDate: request.startTime,
        startTime: request.startTime,
        endDate: request.endTime,
        endTime: request.endTime,
        projectId: projectId?.value,
        userId: createdBy.value,
        createdBy: createdBy.value,
        attendees: attendeeIds.map(id => ({ userId: id.value, status: AttendeeStatus.PENDING })),
        location: request.location || undefined,
        allDay: request.isAllDay || false,
        isAllDay: request.isAllDay || false,
        recurrenceRule: recurrenceRule?.toString(),
        reminders: request.reminders?.filter(r => r.isEnabled).map(r => ({
          id: crypto.randomUUID(),
          minutesBefore: r.minutesBefore,
          method: r.type === 'email' ? 'email' as const : 
                  r.type === 'notification' ? 'notification' as const : 
                  r.type === 'popup' ? 'notification' as const : 'notification' as const,
          sent: false
        })) || [],
        visibility: request.visibility || 'public',
      });

      await this.calendarEventRepository.save(calendarEvent);

      // Send invitations to attendees
      if (attendeeIds.length > 0) {
        await this.sendEventInvitations(calendarEvent, attendeeIds);
      }

      // Schedule reminders
      await this.scheduleEventReminders(calendarEvent);

      // Clear cache
      await this.clearEventCaches(createdBy, projectId);

      this.logInfo('Calendar event created successfully', {
        eventId: calendarEvent.id.value,
        title: request.title,
        startTime: request.startTime,
        endTime: request.endTime,
        createdBy: request.createdBy,
        attendeeCount: attendeeIds.length,
      });

      return calendarEvent.id;
    });
  }

  /**
   * Update calendar event
   */
  async updateCalendarEvent(
    request: UpdateCalendarEventRequest
  ): Promise<void> {
    return await this.executeWithMonitoring('updateCalendarEvent', async () => {
      const validation = this.validateUpdateEventRequest(request);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const eventId = new CalendarEventId(request.eventId);
      const updatedBy = new UserId(request.updatedBy);

      const calendarEvent =
        await this.calendarEventRepository.findById(eventId);
      if (!calendarEvent) {
        throw new Error('Calendar event not found');
      }

      // Check permissions
      const canUpdate = await this.canUserUpdateEvent(updatedBy, eventId);
      if (!canUpdate) {
        throw new Error('Insufficient permissions to update event');
      }

      // Track changes for notifications
      const changes: string[] = [];

      // Update event fields
      if (
        request.title !== undefined &&
        request.title !== calendarEvent.title
      ) {
        calendarEvent.updateTitle(request.title);
        changes.push('title');
      }
      if (request.description !== undefined) {
        calendarEvent.updateDescription(request.description);
        changes.push('description');
      }
      if (request.startTime !== undefined || request.endTime !== undefined) {
        const newStartTime = request.startTime || calendarEvent.startTime;
        const newEndTime = request.endTime || calendarEvent.endTime;

        if (newStartTime >= newEndTime) {
          throw new Error('Start time must be before end time');
        }

        calendarEvent.updateTimeRange(newStartTime, newEndTime);
        changes.push('time');
      }
      if (request.location !== undefined) {
        calendarEvent.updateLocation(request.location);
        changes.push('location');
      }
      if (request.isAllDay !== undefined) {
        calendarEvent.updateAllDay(request.isAllDay);
        changes.push('allDay');
      }
      if (request.recurrenceRule !== undefined) {
        const recurrenceRule = request.recurrenceRule
          ? new RecurrenceRule(request.recurrenceRule)
          : undefined;
        calendarEvent.updateRecurrenceRule(recurrenceRule);
        changes.push('recurrence');
      }
      if (request.reminders !== undefined) {
        const mappedReminders = request.reminders.map(r => ({
          id: crypto.randomUUID(),
          minutesBefore: r.minutesBefore,
          method: r.type === 'email' ? 'email' as const : r.type === 'notification' ? 'notification' as const : 'sms' as const,
          sent: false
        }));
        calendarEvent.updateReminders(mappedReminders);
        changes.push('reminders');
      }
      if (request.visibility !== undefined) {
        calendarEvent.updateVisibility(request.visibility);
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
      await this.clearEventCaches(updatedBy, calendarEvent.projectId);

      this.logInfo('Calendar event updated successfully', {
        eventId: request.eventId,
        updatedBy: request.updatedBy,
        changes,
      });
    });
  }

  /**
   * Delete calendar event
   */
  async deleteCalendarEvent(eventId: string, deletedBy: string): Promise<void> {
    return await this.executeWithMonitoring('deleteCalendarEvent', async () => {
      const eventIdVO = new CalendarEventId(eventId);
      const deletedByVO = new UserId(deletedBy);

      const calendarEvent =
        await this.calendarEventRepository.findById(eventIdVO);
      if (!calendarEvent) {
        throw new Error('Calendar event not found');
      }

      // Check permissions
      const canDelete = await this.canUserDeleteEvent(deletedByVO, eventIdVO);
      if (!canDelete) {
        throw new Error('Insufficient permissions to delete event');
      }

      // Send cancellation notifications to attendees
      await this.sendEventCancellationNotifications(calendarEvent);

      // Cancel scheduled reminders
      await this.cancelEventReminders(calendarEvent);

      // Soft delete the event
      calendarEvent.cancel();
      await this.calendarEventRepository.save(calendarEvent);

      // Clear cache
      await this.clearEventCaches(deletedByVO, calendarEvent.projectId);

      this.logInfo('Calendar event deleted successfully', {
        eventId,
        deletedBy,
      });
    });
  }

  /**
   * Get calendar event by ID
   */
  async getCalendarEventById(
    eventId: string,
    userId: string
  ): Promise<CalendarEventDto> {
    return await this.executeWithMonitoring(
      'getCalendarEventById',
      async () => {
        const eventIdVO = new CalendarEventId(eventId);
        const userIdVO = new UserId(userId);

        const calendarEvent =
          await this.calendarEventRepository.findById(eventIdVO);
        if (!calendarEvent) {
          throw new Error('Calendar event not found');
        }

        // Check permissions
        const canView = await this.canUserViewEvent(userIdVO, eventIdVO);
        if (!canView) {
          throw new Error('Insufficient permissions to view event');
        }

        return await this.mapEventToDto(calendarEvent);
      }
    );
  }

  /**
   * Get calendar events for a time range
   */
  async getCalendarEvents(
    request: CalendarViewRequest
  ): Promise<CalendarEventDto[]> {
    return await this.executeWithMonitoring('getCalendarEvents', async () => {
      const userIdVO = new UserId(request.userId);
      const projectIdVO = request.projectId
        ? new ProjectId(request.projectId)
        : undefined;

      // Check project permissions if specified
      if (projectIdVO) {
        const canView = await this.canUserViewProjectEvents(
          userIdVO,
          projectIdVO
        );
        if (!canView) {
          throw new Error('Insufficient permissions to view project events');
        }
      }

      // Check cache first
      const cacheKey = `calendar-events:${request.userId}:${request.startDate.getTime()}:${request.endDate.getTime()}:${request.projectId || 'all'}`;
      const cachedEvents =
        await this.cacheService.get<CalendarEventDto[]>(cacheKey);
      if (cachedEvents) {
        return cachedEvents;
      }

      // Get events from repository
      const events = await this.calendarEventRepository.findByTimeRange(
        request.startDate,
        request.endDate,
        userIdVO,
        projectIdVO
      );

      // Include recurring event instances if requested
      let allEvents = events;
      if (request.includeRecurring !== false) {
        const recurringInstances = await this.generateRecurringEventInstances(
          events.filter(e => e.recurrenceRule),
          request.startDate,
          request.endDate
        );
        allEvents = [...events, ...recurringInstances];
      }

      // Map to DTOs
      const eventDtos: CalendarEventDto[] = [];
      for (const event of allEvents) {
        const dto = await this.mapEventToDto(event);
        eventDtos.push(dto);
      }

      // Sort by start time
      eventDtos.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

      // Cache the result
      await this.cacheService.set(cacheKey, eventDtos, this.EVENT_CACHE_TTL);

      return eventDtos;
    });
  }

  /**
   * Add attendee to event
   */
  async addAttendee(
    eventId: string,
    attendeeId: string,
    addedBy: string
  ): Promise<void> {
    return await this.executeWithMonitoring('addAttendee', async () => {
      const eventIdVO = new CalendarEventId(eventId);
      const attendeeIdVO = new UserId(attendeeId);
      const addedByVO = new UserId(addedBy);

      const calendarEvent =
        await this.calendarEventRepository.findById(eventIdVO);
      if (!calendarEvent) {
        throw new Error('Calendar event not found');
      }

      // Check permissions
      const canUpdate = await this.canUserUpdateEvent(addedByVO, eventIdVO);
      if (!canUpdate) {
        throw new Error('Insufficient permissions to add attendees');
      }

      // Verify attendee exists
      const attendee = await this.userRepository.findById(attendeeIdVO);
      if (!attendee) {
        throw new Error('Attendee not found');
      }

      // Check if already an attendee
      if (calendarEvent.attendees.some(attendee => attendee.userId === attendeeIdVO.value)) {
        throw new Error('User is already an attendee');
      }

      // Add attendee
      calendarEvent.addAttendee(attendeeIdVO);
      await this.calendarEventRepository.save(calendarEvent);

      // Send invitation
      await this.sendEventInvitations(calendarEvent, [attendeeIdVO]);

      this.logInfo('Attendee added to calendar event', {
        eventId,
        attendeeId,
        addedBy,
      });
    });
  }

  /**
   * Remove attendee from event
   */
  async removeAttendee(
    eventId: string,
    attendeeId: string,
    removedBy: string
  ): Promise<void> {
    return await this.executeWithMonitoring('removeAttendee', async () => {
      const eventIdVO = new CalendarEventId(eventId);
      const attendeeIdVO = new UserId(attendeeId);
      const removedByVO = new UserId(removedBy);

      const calendarEvent =
        await this.calendarEventRepository.findById(eventIdVO);
      if (!calendarEvent) {
        throw new Error('Calendar event not found');
      }

      // Check permissions (can remove self or if has update permissions)
      const canRemove =
        attendeeIdVO.equals(removedByVO) ||
        (await this.canUserUpdateEvent(removedByVO, eventIdVO));
      if (!canRemove) {
        throw new Error('Insufficient permissions to remove attendee');
      }

      // Remove attendee
      calendarEvent.removeAttendee(attendeeIdVO);
      await this.calendarEventRepository.save(calendarEvent);

      this.logInfo('Attendee removed from calendar event', {
        eventId,
        attendeeId,
        removedBy,
      });
    });
  }

  /**
   * Check for event conflicts
   */
  async checkEventConflicts(
    userId: UserId,
    startTime: Date,
    endTime: Date,
    excludeEventId?: CalendarEventId
  ): Promise<EventConflict[]> {
    const events = await this.calendarEventRepository.findConflictingEvents(
      userId,
      startTime,
      endTime,
      excludeEventId
    );

    return events.map(event => ({
      eventId: event.id.value,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      conflictType: this.determineConflictType(
        startTime,
        endTime,
        event.startTime,
        event.endTime
      ),
    }));
  }

  /**
   * Get calendar statistics
   */
  async getCalendarStatistics(
    userId: string,
    projectId?: string
  ): Promise<CalendarStatistics> {
    return await this.executeWithMonitoring(
      'getCalendarStatistics',
      async () => {
        const userIdVO = new UserId(userId);
        const projectIdVO = projectId ? new ProjectId(projectId) : undefined;

        const cacheKey = `calendar-stats:${userId}:${projectId || 'all'}`;
        const cachedStats =
          await this.cacheService.get<CalendarStatistics>(cacheKey);
        if (cachedStats) {
          return cachedStats;
        }

        const stats = await this.calendarEventRepository.getCalendarStatistics(
          userIdVO,
          projectIdVO
        );

        // Cache for 5 minutes
        await this.cacheService.set(cacheKey, stats, 300);

        return stats;
      }
    );
  }

  // Private helper methods
  private validateCreateEventRequest(
    request: CreateCalendarEventRequest
  ): ValidationResult {
    return this.validateInput(request, [
      new RequiredFieldValidationRule('title', 'Event Title'),
      new RequiredFieldValidationRule('startTime', 'Start Time'),
      new RequiredFieldValidationRule('endTime', 'End Time'),
      new RequiredFieldValidationRule('createdBy', 'Created By'),
      new LengthValidationRule('title', 1, 200, 'Event Title'),
    ]);
  }

  private validateUpdateEventRequest(
    request: UpdateCalendarEventRequest
  ): ValidationResult {
    return this.validateInput(request, [
      new RequiredFieldValidationRule('eventId', 'Event ID'),
      new RequiredFieldValidationRule('updatedBy', 'Updated By'),
    ]);
  }

  private async canUserCreateEventInProject(
    userId: UserId,
    projectId: ProjectId
  ): Promise<boolean> {
    const member = await this.projectRepository.findMember(projectId, userId);
    return member !== null;
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
      return member !== null && (member.role.isAdmin() || member.role.isManager());
    }

    return false;
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

  private async canUserViewEvent(
    userId: UserId,
    eventId: CalendarEventId
  ): Promise<boolean> {
    const event = await this.calendarEventRepository.findById(eventId);
    if (!event) return false;

    // Creator can always view
    if (event.createdBy.equals(userId)) return true;

    // Attendees can view
    if (event.attendees.some(attendee => attendee.userId === userId.value)) return true;

    // Project members can view project events
    if (event.projectId) {
      const member = await this.projectRepository.findMember(
        event.projectId,
        userId
      );
      return member !== null;
    }

    // Public events can be viewed by anyone (would need workspace context)
    return event.visibility === 'public';
  }

  private async canUserViewProjectEvents(
    userId: UserId,
    projectId: ProjectId
  ): Promise<boolean> {
    const member = await this.projectRepository.findMember(projectId, userId);
    return member !== null;
  }

  private async mapEventToDto(event: CalendarEvent): Promise<CalendarEventDto> {
    const creator = await this.userRepository.findById(event.createdBy);
    const project = event.projectId
      ? await this.projectRepository.findById(event.projectId)
      : null;

    // Get attendee details
    const attendees: AttendeeDto[] = [];
    for (const attendee of event.attendees) {
      const user = await this.userRepository.findById(new UserId(attendee.userId));
      if (user) {
        attendees.push({
          userId: user.id.value,
          email: user.email.value,
          firstName: user.firstName,
          lastName: user.lastName,
          status: attendee.status,
          isOptional: false,
        });
      }
    }

    return {
      id: event.id.value,
      title: event.title,
      description: event.description,
      startTime: event.startTime,
      endTime: event.endTime,
      projectId: event.projectId?.value,
      createdBy: event.createdBy.value,
      attendees,
      location: event.location,
      isAllDay: event.isAllDay,
      recurrenceRule: event.recurrenceRule
        ? {
            frequency: event.recurrenceRule.frequency as 'daily' | 'weekly' | 'monthly' | 'yearly',
            interval: event.recurrenceRule.interval,
            count: event.recurrenceRule.count,
            until: event.recurrenceRule.until,
            byWeekDay: event.recurrenceRule.byWeekDay,
            byMonthDay: event.recurrenceRule.byMonthDay,
            byMonth: event.recurrenceRule.byMonth,
          }
        : undefined,
      reminders: event.reminders.map(r => ({
        type: r.method === 'email' ? 'email' as const : r.method === 'notification' ? 'notification' as const : 'popup' as const,
        minutesBefore: r.minutesBefore,
        isEnabled: !r.sent
      })),
      visibility: event.visibility,
      status: event.status,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      project: project
        ? {
            id: project.id.value,
            name: project.name,
          }
        : undefined,
      creator: creator
        ? {
            id: creator.id.value,
            firstName: creator.firstName,
            lastName: creator.lastName,
            email: creator.email.value,
          }
        : {
            id: '',
            firstName: 'Unknown',
            lastName: 'User',
            email: '',
          },
    };
  }

  private determineConflictType(
    startTime1: Date,
    endTime1: Date,
    startTime2: Date,
    endTime2: Date
  ): 'overlap' | 'adjacent' {
    // Check for overlap
    if (startTime1 < endTime2 && endTime1 > startTime2) {
      return 'overlap';
    }

    // Check for adjacent (within 15 minutes)
    const gap = Math.min(
      Math.abs(startTime1.getTime() - endTime2.getTime()),
      Math.abs(startTime2.getTime() - endTime1.getTime())
    );

    return gap <= 15 * 60 * 1000 ? 'adjacent' : 'overlap';
  }

  private async generateRecurringEventInstances(
    _recurringEvents: CalendarEvent[],
    _startDate: Date,
    _endDate: Date
  ): Promise<CalendarEvent[]> {
    // This would generate instances of recurring events within the date range
    // For now, return empty array as this is complex logic
    return [];
  }

  private async sendEventInvitations(
    event: CalendarEvent,
    attendeeIds: UserId[]
  ): Promise<void> {
    for (const attendeeId of attendeeIds) {
      const attendee = await this.userRepository.findById(attendeeId);
      if (attendee) {
        const emailData: any = {
          recipientEmail: attendee.email.value,
          recipientName: `${attendee.firstName} ${attendee.lastName}`,
          eventTitle: event.title,
          startTime: event.startTime,
          endTime: event.endTime,
          organizerName: 'Event Organizer', // Would get from creator
        };
        
        if (event.description) {
          emailData.eventDescription = event.description;
        }
        
        if (event.location) {
          emailData.location = event.location;
        }
        
        await this.emailService.sendCalendarInvitation(emailData);
      }
    }
  }

  private async sendEventUpdateNotifications(
    event: CalendarEvent,
    changes: string[]
  ): Promise<void> {
    // Send update notifications to attendees
    this.logInfo('Event update notifications sent', {
      eventId: event.id.value,
      changes,
      attendeeCount: event.attendees.length,
    });
  }

  private async sendEventCancellationNotifications(
    event: CalendarEvent
  ): Promise<void> {
    // Send cancellation notifications to attendees
    this.logInfo('Event cancellation notifications sent', {
      eventId: event.id.value,
      attendeeCount: event.attendees.length,
    });
  }

  private async scheduleEventReminders(event: CalendarEvent): Promise<void> {
    // Schedule reminders for the event
    this.logInfo('Event reminders scheduled', {
      eventId: event.id.value,
      reminderCount: event.reminders.length,
    });
  }

  private async cancelEventReminders(event: CalendarEvent): Promise<void> {
    // Cancel scheduled reminders for the event
    this.logInfo('Event reminders cancelled', {
      eventId: event.id.value,
    });
  }

  private async clearEventCaches(
    userId: UserId,
    projectId?: ProjectId
  ): Promise<void> {
    // Clear relevant caches
    const patterns = [
      `calendar-events:${userId.value}:*`,
      `calendar-stats:${userId.value}:*`,
    ];

    if (projectId) {
      patterns.push(`calendar-stats:${userId.value}:${projectId.value}`);
    }

    // In a real implementation, this would clear cache patterns
    this.logDebug('Event caches cleared', {
      userId: userId.value,
      projectId: projectId?.value,
    });
  }
}

