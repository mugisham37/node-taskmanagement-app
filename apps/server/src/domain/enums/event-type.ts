/**
 * Calendar Event Type Enumeration
 */
export enum EventType {
  MEETING = 'MEETING',
  TASK = 'TASK',
  REMINDER = 'REMINDER',
  DEADLINE = 'DEADLINE',
  MILESTONE = 'MILESTONE',
  APPOINTMENT = 'APPOINTMENT',
  PERSONAL = 'PERSONAL',
  HOLIDAY = 'HOLIDAY',
  CONFERENCE = 'CONFERENCE',
  TRAINING = 'TRAINING',
  REVIEW = 'REVIEW',
  BREAK = 'BREAK',
  TRAVEL = 'TRAVEL',
  OTHER = 'OTHER'
}

/**
 * Calendar Event Attendee Status
 */
export enum AttendeeStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  TENTATIVE = 'TENTATIVE',
  NO_RESPONSE = 'NO_RESPONSE'
}

/**
 * Calendar Event Reminder Type
 */
export enum ReminderType {
  EMAIL = 'EMAIL',
  NOTIFICATION = 'NOTIFICATION',
  SMS = 'SMS',
  POPUP = 'POPUP'
}
