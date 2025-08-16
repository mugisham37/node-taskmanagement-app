import {
  AttendeeStatus,
  CalendarEvent,
  CalendarEventAttendee,
  CalendarEventReminder,
  EventType,
} from '@taskmanagement/domain';
import { DatabaseConnection } from '../connection';
import { CalendarEventRepository } from '../repositories/calendar-event-repository';

export class CalendarEventSeeder {
  private calendarEventRepository: CalendarEventRepository;

  constructor(_connection: DatabaseConnection) {
    this.calendarEventRepository = new CalendarEventRepository();
  }

  async seed(
    userIds: string[],
    workspaceIds: string[],
    projectIds: string[],
    taskIds: string[],
    count: number = 100
  ): Promise<CalendarEvent[]> {
    const calendarEvents: CalendarEvent[] = [];

    const eventTypes = Object.values(EventType);
    const attendeeStatuses = Object.values(AttendeeStatus);

    const sampleTitles = [
      'Team Standup Meeting',
      'Project Planning Session',
      'Task Review',
      'Client Presentation',
      'Sprint Retrospective',
      'Code Review Meeting',
      'Design Workshop',
      'Product Demo',
      'Training Session',
      'One-on-One Meeting',
    ];

    const sampleDescriptions = [
      'Daily standup to discuss progress and blockers',
      'Planning session for upcoming project milestones',
      'Review completed tasks and plan next steps',
      'Present project progress to client stakeholders',
      'Retrospective meeting to discuss what went well and what can be improved',
      'Review code changes and discuss best practices',
      'Collaborative design workshop for new features',
      'Demonstrate new product features to the team',
      'Training session on new tools and technologies',
      'Individual meeting to discuss career development',
    ];

    const sampleLocations = [
      'Conference Room A',
      'Meeting Room 1',
      'Zoom Call',
      'Google Meet',
      'Office Lobby',
      'Client Office',
      'Remote',
      'Cafeteria',
      'Training Room',
      'Executive Boardroom',
    ];

    const colors = [
      '#4f46e5', // Indigo
      '#059669', // Emerald
      '#dc2626', // Red
      '#d97706', // Amber
      '#7c3aed', // Violet
      '#0891b2', // Cyan
      '#be185d', // Pink
      '#65a30d', // Lime
    ];

    for (let i = 0; i < count; i++) {
      const userId = userIds[Math.floor(Math.random() * userIds.length)]!;
      const workspaceId = workspaceIds[Math.floor(Math.random() * workspaceIds.length)]!;
      const type = eventTypes[Math.floor(Math.random() * eventTypes.length)]!;
      const title = sampleTitles[Math.floor(Math.random() * sampleTitles.length)]!;
      const description =
        sampleDescriptions[Math.floor(Math.random() * sampleDescriptions.length)]!;
      const location =
        Math.random() > 0.3
          ? sampleLocations[Math.floor(Math.random() * sampleLocations.length)]!
          : undefined;
      const color = colors[Math.floor(Math.random() * colors.length)]!;

      // Generate random start date (within next 30 days)
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 30));
      startDate.setHours(Math.floor(Math.random() * 16) + 8); // 8 AM to 11 PM
      startDate.setMinutes(Math.floor(Math.random() * 4) * 15); // 0, 15, 30, 45 minutes

      // Generate end date (30 minutes to 4 hours later)
      const endDate = new Date(startDate);
      const durationMinutes = [30, 60, 90, 120, 180, 240][Math.floor(Math.random() * 6)]!;
      endDate.setMinutes(endDate.getMinutes() + durationMinutes);

      const allDay = Math.random() > 0.9; // 10% chance of all-day events
      const isRecurring = Math.random() > 0.8; // 20% chance of recurring events

      // Generate attendees (1-5 attendees)
      const attendeeCount = Math.floor(Math.random() * 5) + 1;
      const attendees: CalendarEventAttendee[] = [];
      const selectedUserIds = new Set([userId]); // Include event creator

      for (let j = 0; j < attendeeCount && selectedUserIds.size < userIds.length; j++) {
        let attendeeUserId;
        do {
          attendeeUserId = userIds[Math.floor(Math.random() * userIds.length)]!;
        } while (selectedUserIds.has(attendeeUserId));

        selectedUserIds.add(attendeeUserId);
        attendees.push({
          userId: attendeeUserId,
          status: attendeeStatuses[Math.floor(Math.random() * attendeeStatuses.length)]!,
          responseAt: Math.random() > 0.5 ? new Date() : undefined,
        });
      }

      // Generate reminders (0-3 reminders)
      const reminderCount = Math.floor(Math.random() * 4);
      const reminders: CalendarEventReminder[] = [];
      const reminderTimes = [5, 15, 30, 60, 120]; // minutes before
      const reminderMethods = ['notification', 'email', 'sms'] as const;

      for (let j = 0; j < reminderCount; j++) {
        reminders.push({
          id: `reminder-${i}-${j}`,
          minutesBefore: reminderTimes[Math.floor(Math.random() * reminderTimes.length)]!,
          method: reminderMethods[Math.floor(Math.random() * reminderMethods.length)]!,
          sent: Math.random() > 0.7, // 30% chance already sent
          sentAt: Math.random() > 0.7 ? new Date() : undefined,
        });
      }

      // Optionally associate with project or task
      let projectId: string | undefined;
      let taskId: string | undefined;

      if (type === EventType.TASK && Math.random() > 0.5) {
        taskId = taskIds[Math.floor(Math.random() * taskIds.length)]!;
      } else if (Math.random() > 0.6) {
        projectId = projectIds[Math.floor(Math.random() * projectIds.length)]!;
      }

      // Generate recurrence rule for recurring events
      let recurrenceRule: string | undefined;
      if (isRecurring) {
        const recurrencePatterns = [
          'FREQ=DAILY;INTERVAL=1',
          'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR',
          'FREQ=WEEKLY;INTERVAL=1;BYDAY=TU,TH',
          'FREQ=WEEKLY;INTERVAL=2',
          'FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1',
          'FREQ=MONTHLY;INTERVAL=1;BYDAY=1MO',
        ];
        recurrenceRule = recurrencePatterns[Math.floor(Math.random() * recurrencePatterns.length)]!;
      }

      const calendarEvent = CalendarEvent.create({
        title,
        description,
        type,
        startDate,
        endDate: allDay ? undefined : endDate,
        allDay,
        location,
        color,
        userId,
        workspaceId,
        projectId,
        taskId,
        isRecurring,
        recurrenceRule,
        attendees,
        reminders,
        metadata: {
          source: 'seeder',
          category: type,
          duration: allDay ? 'all-day' : `${durationMinutes}min`,
          attendeeCount: attendees.length,
        },
      });

      calendarEvents.push(calendarEvent);
    }

    // Save calendar events in batches
    const batchSize = 25;
    for (let i = 0; i < calendarEvents.length; i += batchSize) {
      const batch = calendarEvents.slice(i, i + batchSize);
      await Promise.all(batch.map((event) => this.calendarEventRepository.save(event)));
    }

    console.log(`Seeded ${calendarEvents.length} calendar events`);
    return calendarEvents;
  }

  async getExistingCalendarEvents(): Promise<CalendarEvent[]> {
    // This would need to be implemented based on your repository's findAll method
    return [];
  }
}
