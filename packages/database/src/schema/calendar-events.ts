import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  pgEnum,
  json,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Event type enum
export const eventTypeEnum = pgEnum('event_type', [
  'task',
  'meeting',
  'deadline',
  'other',
]);

// Attendee status enum
export const attendeeStatusEnum = pgEnum('attendee_status', [
  'pending',
  'accepted',
  'declined',
  'tentative',
]);

// Calendar events table with recurrence support
export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    type: eventTypeEnum('type').notNull(),
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date'),
    allDay: boolean('all_day').notNull().default(false),
    location: varchar('location', { length: 255 }),
    url: text('url'),
    color: varchar('color', { length: 7 }).notNull().default('#4f46e5'),
    userId: varchar('user_id', { length: 36 }).notNull(),
    workspaceId: varchar('workspace_id', { length: 36 }),
    teamId: varchar('team_id', { length: 36 }),
    projectId: varchar('project_id', { length: 36 }),
    taskId: varchar('task_id', { length: 36 }),
    isRecurring: boolean('is_recurring').notNull().default(false),
    recurrenceRule: text('recurrence_rule'), // RRULE format
    attendees: json('attendees')
      .$type<
        Array<{
          userId: string;
          status: string;
          responseAt?: string;
        }>
      >()
      .notNull()
      .default([]),
    reminders: json('reminders')
      .$type<
        Array<{
          id: string;
          minutesBefore: number;
          method: string;
          sent: boolean;
          sentAt?: string;
        }>
      >()
      .notNull()
      .default([]),
    externalCalendarId: varchar('external_calendar_id', { length: 255 }),
    externalEventId: varchar('external_event_id', { length: 255 }),
    metadata: json('metadata')
      .$type<Record<string, any>>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    // User and time-based indexes for calendar queries
    userTimeIdx: index('idx_calendar_events_user_time').on(
      table.userId,
      table.startDate,
      table.endDate
    ),

    // Workspace calendar views
    workspaceTimeIdx: index('idx_calendar_events_workspace_time').on(
      table.workspaceId,
      table.startDate
    ),

    // Project and task associations
    projectIdx: index('idx_calendar_events_project').on(table.projectId),
    taskIdx: index('idx_calendar_events_task').on(table.taskId),

    // Event type filtering
    typeIdx: index('idx_calendar_events_type').on(table.type, table.startDate),

    // Recurrence queries
    recurringIdx: index('idx_calendar_events_recurring').on(
      table.isRecurring,
      table.userId
    ),

    // Time range queries for calendar views
    startDateIdx: index('idx_calendar_events_start_date').on(table.startDate),
    endDateIdx: index('idx_calendar_events_end_date').on(table.endDate),

    // External calendar integration
    externalCalendarIdx: index('idx_calendar_events_external_calendar').on(
      table.externalCalendarId
    ),
    externalEventIdx: index('idx_calendar_events_external_event').on(
      table.externalEventId
    ),

    // Upcoming events for reminders
    upcomingEventsIdx: index('idx_calendar_events_upcoming').on(
      table.startDate,
      table.userId
    ),

    // Team calendar views
    teamTimeIdx: index('idx_calendar_events_team_time').on(
      table.teamId,
      table.startDate
    ),

    // Conflict detection (overlapping events for same user)
    conflictDetectionIdx: index('idx_calendar_events_conflict').on(
      table.userId,
      table.startDate,
      table.endDate,
      table.allDay
    ),
  })
);

// Relations
export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  user: one(users, {
    fields: [calendarEvents.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [calendarEvents.workspaceId],
    references: [workspaces.id],
  }),
  project: one(projects, {
    fields: [calendarEvents.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [calendarEvents.taskId],
    references: [tasks.id],
  }),
}));

// Import other tables for relations
import { users } from './users';
import { workspaces } from './workspaces';
import { projects } from './projects';
import { tasks } from './tasks';