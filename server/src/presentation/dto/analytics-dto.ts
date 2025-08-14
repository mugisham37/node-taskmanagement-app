import { z } from 'zod';
import { BaseQuerySchema } from './base-dto';

// Analytics DTOs
export interface AnalyticsRequestDto {
  projectId?: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
  timeRange?: '7d' | '30d' | '90d' | '1y';
  includeTeamData?: boolean;
}

export interface TaskAnalyticsDto {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  completionRate: number;
  averageCompletionTime: number;
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
  tasksByProject: Record<string, number>;
  productivityTrend: Array<{
    date: string;
    completed: number;
    created: number;
  }>;
  timeSpentByDay: Array<{
    date: string;
    hours: number;
  }>;
}

export interface ProjectAnalyticsDto {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  projectProgress: Record<
    string,
    {
      name: string;
      progress: number;
      tasksCompleted: number;
      totalTasks: number;
    }
  >;
  teamProductivity: Record<
    string,
    {
      userId: string;
      userName: string;
      tasksCompleted: number;
      hoursWorked: number;
    }
  >;
  resourceUtilization: Record<string, number>;
  milestoneCompletion: Array<{
    milestoneId: string;
    name: string;
    dueDate: string;
    completionDate?: string;
    status: string;
  }>;
  budgetAnalysis: {
    allocated: number;
    spent: number;
    remaining: number;
    burnRate: number;
  };
}

export interface ProductivityAnalyticsDto {
  dailyProductivity: Array<{
    date: string;
    score: number;
    tasksCompleted: number;
    hoursWorked: number;
  }>;
  weeklyProductivity: Array<{
    week: string;
    score: number;
    tasksCompleted: number;
    hoursWorked: number;
  }>;
  monthlyProductivity: Array<{
    month: string;
    score: number;
    tasksCompleted: number;
    hoursWorked: number;
  }>;
  focusTime: number;
  distractionTime: number;
  peakProductivityHours: Array<{
    hour: number;
    productivity: number;
  }>;
  taskCompletionVelocity: number;
  qualityScore: number;
  collaborationMetrics: {
    meetingsAttended: number;
    commentsPosted: number;
    filesShared: number;
    collaborationScore: number;
  };
}

export interface DashboardAnalyticsDto {
  overview: {
    totalTasks: number;
    completedToday: number;
    upcomingDeadlines: number;
    overdueTasks: number;
  };
  productivity: {
    todayScore: number;
    weeklyAverage: number;
    monthlyTrend: Array<{
      date: string;
      score: number;
    }>;
  };
  projects: {
    active: number;
    completed: number;
    onTrack: number;
    atRisk: number;
  };
  team: {
    members: number;
    activeMembers: number;
    teamProductivity: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
    userId: string;
    userName: string;
  }>;
  upcomingEvents: Array<{
    id: string;
    title: string;
    startDate: string;
    type: string;
  }>;
  notifications: {
    unread: number;
    urgent: number;
  };
}

export interface ActivityAnalyticsDto {
  activityTimeline: Array<{
    timestamp: string;
    type: string;
    description: string;
    userId: string;
    entityType: string;
    entityId: string;
  }>;
  mostActiveHours: Array<{
    hour: number;
    activityCount: number;
  }>;
  activityByType: Record<string, number>;
  collaborationActivity: {
    commentsPosted: number;
    filesShared: number;
    meetingsAttended: number;
    tasksAssigned: number;
    tasksCompleted: number;
  };
  systemUsage: {
    loginFrequency: number;
    sessionDuration: number;
    featureUsage: Record<string, number>;
  };
}

// Validation schemas
export const AnalyticsQuerySchema = BaseQuerySchema.extend({
  projectId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  userId: z.string().optional(),
  timeRange: z.enum(['7d', '30d', '90d', '1y']).optional(),
  includeTeamData: z.boolean().default(false),
});

export const DashboardQuerySchema = z.object({
  timeRange: z.enum(['7d', '30d', '90d', '1y']).default('30d'),
  includeTeamData: z.boolean().default(false),
});

export const ExportAnalyticsSchema = z.object({
  type: z.enum(['tasks', 'projects', 'productivity', 'activity']),
  format: z.enum(['csv', 'xlsx', 'json']).default('csv'),
  dateRange: AnalyticsQuerySchema,
});

export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;
export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;
export type ExportAnalyticsRequest = z.infer<typeof ExportAnalyticsSchema>;
