/**
 * Calendar Event Repository Implementation
 * Prisma-based implementation of ICalendarEventRepository interface
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { BasePrismaRepository } from '../../database/base-repository';
import { ICalendarEventRepository } from '../../../domains/calendar/repositories/calendar-event.repository.interface';
import { CalendarEventAggregate } from '../../../domains/calendar/aggregates/calendar-event.aggregate';
import { CalendarEventId } from '../../../domains/calendar/value-objects/calendar-event-id';
import { WorkspaceId } from '../../../domains/task-management/value-objects/workspace-id';
import { UserId } from '../../../domains/authentication/value-objects/user-id';
import { logger } from '../../logging/logger';

// Note: This assumes a CalendarEvent model exists in Prisma schema
// If it doesn't exist, you would need to add it to your schema
type CalendarEventWithRelations = any & {
  organizer?: any;
  attendees?: any[];
  workspace?: any;
};

export class PrismaCalendarEventRepository
  extends BasePrismaRepository<
    CalendarEventAggregate,
    string,
    CalendarEventWithRelations,
    any
  >
  implements ICalendarEventRepository
{
  constructor(client?: PrismaClient) {
    super('CalendarEvent', client);
  }

  protected toDomain(
    prismaEvent: CalendarEventWithRelations
  ): CalendarEventAggregate {
    return CalendarEventAggregate.fromPersistence({
      id: prismaEvent.id,
      workspaceId: prismaEvent.workspaceId,
      title: prismaEvent.title,
      description: prismaEvent.description,
      startTime: prismaEvent.startTime,
      endTime: prismaEvent.endTime,
      isAllDay: prismaEvent.isAllDay,
      location: prismaEvent.location,
      organizerId: prismaEvent.organizerId,
      attendeeIds: prismaEvent.attendeeIds || [],
      recurrenceRule: prismaEvent.recurrenceRule,
      recurrenceExceptions: prismaEvent.recurrenceExceptions || [],
      reminders: prismaEvent.reminders || [],
      visibility: prismaEvent.visibility,
      status: prismaEvent.status,
      externalEventId: prismaEvent.externalEventId,
      externalCalendarId: prismaEvent.externalCalendarId,
      syncStatus: prismaEvent.syncStatus,
      lastSyncAt: prismaEvent.lastSyncAt,
      metadata: prismaEvent.metadata || {},
      createdAt: prismaEvent.createdAt,
      updatedAt: prismaEvent.updatedAt,
      deletedAt: prismaEvent.deletedAt,
    });
  }

  protected toPrisma(event: CalendarEventAggregate): any {
    const eventData = event.toPersistence();
    return {
      id: eventData.id,
      workspace: { connect: { id: eventData.workspaceId } },
      title: eventData.title,
      description: eventData.description,
      startTime: eventData.startTime,
      endTime: eventData.endTime,
      isAllDay: eventData.isAllDay,
      location: eventData.location,
      organizer: { connect: { id: eventData.organizerId } },
      attendeeIds: eventData.attendeeIds,
      recurrenceRule: eventData.recurrenceRule,
      recurrenceExceptions: eventData.recurrenceExceptions,
      reminders: eventData.reminders,
      visibility: eventData.visibility,
      status: eventData.status,
      externalEventId: eventData.externalEventId,
      externalCalendarId: eventData.externalCalendarId,
      syncStatus: eventData.syncStatus,
      lastSyncAt: eventData.lastSyncAt,
      metadata: eventData.metadata,
      createdAt: eventData.createdAt,
      updatedAt: eventData.updatedAt,
      deletedAt: eventData.deletedAt,
    };
  }

  protected getDelegate(client: PrismaClient | Prisma.TransactionClient) {
    // This would need to be updated based on your actual Prisma schema
    return (client as any).calendarEvent;
  }

  protected buildWhereClause(specification: any): any {
    // Implementation would depend on the specification pattern used
    return {};
  }

  protected getDefaultInclude() {
    return {
      organizer: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
      // Note: This assumes attendees are stored as a relation
      // You might need to adjust based on your actual schema
      attendees: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    };
  }

  // ICalendarEventRepository specific methods
  async findByWorkspaceId(
    workspaceId: WorkspaceId
  ): Promise<CalendarEventAggregate[]> {
    try {
      const events = await this.getDelegate(this.client).findMany({
        where: {
          workspaceId: workspaceId.value,
          deletedAt: null,
        },
        ...this.getDefaultInclude(),
        orderBy: { startTime: 'asc' },
      });

      return events.map((event: CalendarEventWithRelations) =>
        this.toDomain(event)
      );
    } catch (error) {
      logger.error('Error finding calendar events by workspace ID', {
        workspaceId: workspaceId.value,
        error,
      });
      throw error;
    }
  }

  async findByUserId(userId: UserId): Promise<CalendarEventAggregate[]> {
    try {
      const events = await this.getDelegate(this.client).findMany({
        where: {
          OR: [
            { organizerId: userId.value },
            { attendeeIds: { has: userId.value } },
          ],
          deletedAt: null,
        },
        ...this.getDefaultInclude(),
        orderBy: { startTime: 'asc' },
      });

      return events.map((event: CalendarEventWithRelations) =>
        this.toDomain(event)
      );
    } catch (error) {
      logger.error('Error finding calendar events by user ID', {
        userId: userId.value,
        error,
      });
      throw error;
    }
  }

  async findByDateRange(
    workspaceId: WorkspaceId,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEventAggregate[]> {
    try {
      const events = await this.getDelegate(this.client).findMany({
        where: {
          workspaceId: workspaceId.value,
          OR: [
            // Events that start within the range
            {
              startTime: {
                gte: startDate,
                lte: endDate,
              },
            },
            // Events that end within the range
            {
              endTime: {
                gte: startDate,
                lte: endDate,
              },
            },
            // Events that span the entire range
            {
              startTime: { lte: startDate },
              endTime: { gte: endDate },
            },
          ],
          deletedAt: null,
        },
        ...this.getDefaultInclude(),
        orderBy: { startTime: 'asc' },
      });

      return events.map((event: CalendarEventWithRelations) =>
        this.toDomain(event)
      );
    } catch (error) {
      logger.error('Error finding calendar events by date range', {
        workspaceId: workspaceId.value,
        startDate,
        endDate,
        error,
      });
      throw error;
    }
  }

  // Additional useful methods for calendar events
  async findUpcomingEvents(
    userId: UserId,
    days: number = 7
  ): Promise<CalendarEventAggregate[]> {
    try {
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      const events = await this.getDelegate(this.client).findMany({
        where: {
          OR: [
            { organizerId: userId.value },
            { attendeeIds: { has: userId.value } },
          ],
          startTime: {
            gte: now,
            lte: futureDate,
          },
          status: { not: 'cancelled' },
          deletedAt: null,
        },
        ...this.getDefaultInclude(),
        orderBy: { startTime: 'asc' },
        take: 20,
      });

      return events.map((event: CalendarEventWithRelations) =>
        this.toDomain(event)
      );
    } catch (error) {
      logger.error('Error finding upcoming events', {
        userId: userId.value,
        days,
        error,
      });
      throw error;
    }
  }

  async findConflictingEvents(
    userId: UserId,
    startTime: Date,
    endTime: Date,
    excludeEventId?: CalendarEventId
  ): Promise<CalendarEventAggregate[]> {
    try {
      const whereClause: any = {
        OR: [
          { organizerId: userId.value },
          { attendeeIds: { has: userId.value } },
        ],
        AND: [
          {
            OR: [
              // Events that start during the proposed time
              {
                startTime: {
                  gte: startTime,
                  lt: endTime,
                },
              },
              // Events that end during the proposed time
              {
                endTime: {
                  gt: startTime,
                  lte: endTime,
                },
              },
              // Events that span the entire proposed time
              {
                startTime: { lte: startTime },
                endTime: { gte: endTime },
              },
            ],
          },
        ],
        status: { not: 'cancelled' },
        deletedAt: null,
      };

      if (excludeEventId) {
        whereClause.id = { not: excludeEventId.value };
      }

      const events = await this.getDelegate(this.client).findMany({
        where: whereClause,
        ...this.getDefaultInclude(),
        orderBy: { startTime: 'asc' },
      });

      return events.map((event: CalendarEventWithRelations) =>
        this.toDomain(event)
      );
    } catch (error) {
      logger.error('Error finding conflicting events', {
        userId: userId.value,
        startTime,
        endTime,
        excludeEventId: excludeEventId?.value,
        error,
      });
      throw error;
    }
  }

  async findRecurringEvents(
    workspaceId: WorkspaceId
  ): Promise<CalendarEventAggregate[]> {
    try {
      const events = await this.getDelegate(this.client).findMany({
        where: {
          workspaceId: workspaceId.value,
          recurrenceRule: { not: null },
          deletedAt: null,
        },
        ...this.getDefaultInclude(),
        orderBy: { startTime: 'asc' },
      });

      return events.map((event: CalendarEventWithRelations) =>
        this.toDomain(event)
      );
    } catch (error) {
      logger.error('Error finding recurring events', {
        workspaceId: workspaceId.value,
        error,
      });
      throw error;
    }
  }

  async findEventsByExternalCalendar(
    externalCalendarId: string
  ): Promise<CalendarEventAggregate[]> {
    try {
      const events = await this.getDelegate(this.client).findMany({
        where: {
          externalCalendarId,
          deletedAt: null,
        },
        ...this.getDefaultInclude(),
        orderBy: { startTime: 'asc' },
      });

      return events.map((event: CalendarEventWithRelations) =>
        this.toDomain(event)
      );
    } catch (error) {
      logger.error('Error finding events by external calendar', {
        externalCalendarId,
        error,
      });
      throw error;
    }
  }

  async findEventsNeedingSync(): Promise<CalendarEventAggregate[]> {
    try {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const events = await this.getDelegate(this.client).findMany({
        where: {
          externalEventId: { not: null },
          OR: [
            { syncStatus: 'pending' },
            { syncStatus: 'failed' },
            {
              syncStatus: 'synced',
              lastSyncAt: { lt: oneHourAgo },
              updatedAt: { gt: this.client.$queryRaw`last_sync_at` },
            },
          ],
          deletedAt: null,
        },
        ...this.getDefaultInclude(),
        orderBy: { updatedAt: 'asc' },
        take: 100,
      });

      return events.map((event: CalendarEventWithRelations) =>
        this.toDomain(event)
      );
    } catch (error) {
      logger.error('Error finding events needing sync', { error });
      throw error;
    }
  }

  // Override save method to handle domain events
  async save(event: CalendarEventAggregate): Promise<void> {
    try {
      const eventData = this.toPrisma(event);

      await this.getDelegate(this.client).upsert({
        where: { id: event.id.value },
        create: eventData,
        update: eventData,
        ...this.getDefaultInclude(),
      });

      logger.debug('Calendar event saved successfully', {
        eventId: event.id.value,
      });
    } catch (error) {
      logger.error('Error saving calendar event', {
        eventId: event.id.value,
        error,
      });
      throw error;
    }
  }

  // Override delete method for soft delete
  async delete(id: CalendarEventId): Promise<void> {
    try {
      await this.getDelegate(this.client).update({
        where: { id: id.value },
        data: {
          deletedAt: new Date(),
        },
      });

      logger.info('Calendar event soft deleted', { eventId: id.value });
    } catch (error) {
      logger.error('Error deleting calendar event', {
        eventId: id.value,
        error,
      });
      throw error;
    }
  }
}
