import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './users';
import { tasks } from './tasks';
import { projects } from './projects';
import { workspaces } from './workspaces';
import { teams } from './teams';

// Event type enum
export const eventTypeEnum = ['task', 'meeting', 'deadline', 'other'] as const;

export const calendarEvents = pgTable('calendar_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 20 }).notNull().default('other'),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  allDay: boolean('all_day').notNull().default(false),
  location: varchar('location', { length: 500 }),
  url: text('url'),
  color: varchar('color', { length: 7 }).notNull().default('#4f46e5'),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  isRecurring: boolean('is_recurring').notNull().default(false),
  recurrenceRule: text('recurrence_rule'),
  externalCalendarId: varchar('external_calendar_id', { length: 255 }),
  externalEventId: varchar('external_event_id', { length: 255 }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userStartDateIdx: index('calendar_events_user_start_date_idx').on(table.userId, table.startDate),
  startEndDateIdx: index('calendar_events_start_end_date_idx').on(table.startDate, table.endDate),
  typeIdx: index('calendar_events_type_idx').on(table.type),
  taskIdx: index('calendar_events_task_idx').on(table.taskId),
  projectIdx: index('calendar_events_project_idx').on(table.projectId),
  workspaceIdx: index('calendar_events_workspace_idx').on(table.workspaceId),
  teamIdx: index('calendar_events_team_idx').on(table.teamId),
  externalIdx: index('calendar_events_external_idx').on(table.externalCalendarId, table.externalEventId),
  titleSearchIdx: index('calendar_events_title_search_idx').on(table.title),
}));

export const calendarEventAttendees = pgTable('calendar_event_attendees', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => calendarEvents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  responseAt: timestamp('response_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  eventUserIdx: index('calendar_event_attendees_event_user_idx').on(table.eventId, table.userId),
  userIdx: index('calendar_event_attendees_user_idx').on(table.userId),
  statusIdx: index('calendar_event_attendees_status_idx').on(table.status),
}));

export const calendarEventReminders = pgTable('calendar_event_reminders', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => calendarEvents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  minutesBefore: integer('minutes_before').notNull(),
  method: varchar('method', { length: 20 }).notNull().default('notification'),
  sent: boolean('sent').notNull().default(false),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  eventUserIdx: index('calendar_event_reminders_event_user_idx').on(table.eventId, table.userId),
  sentIdx: index('calendar_event_reminders_sent_idx').on(table.sent),
  methodIdx: index('calendar_event_reminders_method_idx').on(table.method),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one, many }) => ({
  user: one(users, {
    fields: [calendarEvents.userId],
    references: [users.id],
  }),
  task: one(tasks, {
    fields: [calendarEvents.taskId],
    references: [tasks.id],
  }),
  project: one(projects, {
    fields: [calendarEvents.projectId],
    references: [projects.id],
  }),
  workspace: one(workspaces, {
    fields: [calendarEvents.workspaceId],
    references: [workspaces.id],
  }),
  team: one(teams, {
    fields: [calendarEvents.teamId],
    references: [teams.id],
  }),
  attendees: many(calendarEventAttendees),
  reminders: many(calendarEventReminders),
}));

export const calendarEventAttendeesRelations = relations(calendarEventAttendees, ({ one }) => ({
  event: one(calendarEvents, {
    fields: [calendarEventAttendees.eventId],
    references: [calendarEvents.id],
  }),
  user: one(users, {
    fields: [calendarEventAttendees.userId],
    references: [users.id],
  }),
}));

export const calendarEventRemindersRelations = relations(calendarEventReminders, ({ one }) => ({
  event: one(calendarEvents, {
    fields: [calendarEventReminders.eventId],
    references: [calendarEvents.id],
  }),
  user: one(users, {
    fields: [calendarEventReminders.userId],
    references: [users.id],
  }),
}));

export const insertCalendarEventSchema = createInsertSchema(calendarEvents, {
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: z.enum(eventTypeEnum),
  startDate: z.date(),
  endDate: z.date().optional(),
  allDay: z.boolean().optional(),
  location: z.string().max(500).optional(),
  url: z.string().url().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().max(500).optional(),
  externalCalendarId: z.string().max(255).optional(),
  externalEventId: z.string().max(255).optional(),
  metadata: z.record(z.any()).optional(),
});

export const selectCalendarEventSchema = createSelectSchema(calendarEvents);

export const insertCalendarEventAttendeeSchema = createInsertSchema(calendarEventAttendees, {
  status: z.enum(['pending', 'accepted', 'declined', 'tentative']),
});

export const selectCalendarEventAttendeeSchema = createSelectSchema(calendarEventAttendees);

export const insertCalendarEventReminderSchema = createInsertSchema(calendarEventReminders, {
  minutesBefore: z.number().min(0),
  method: z.enum(['notification', 'email', 'sms']),
  sent: z.boolean().optional(),
});

export const selectCalendarEventReminderSchema = createSelectSchema(calendarEventReminders);

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type NewCalendarEvent = typeof calendarEvents.$inferInsert;
export type CalendarEventAttendee = typeof calendarEventAttendees.$inferSelect;
export type NewCalendarEventAttendee = typeof calendarEventAttendees.$inferInsert;
export type CalendarEventReminder = typeof calendarEventReminders.$inferSelect;
export type NewCalendarEventReminder = typeof calendarEventReminders.$inferInsert;
export type EventType = typeof eventTypeEnum[number];
