import { BaseService } from '../../shared/services/BaseService';
import { IActivityTrackingRepository } from '../repositories/IActivityTrackingRepository';
import { IMetricsRepository } from '../repositories/IMetricsRepository';
import { MetricsCollectionService } from './MetricsCollectionService';

export interface UserProductivityMetrics {
  userId: string;
  userName: string;
  timeRange: {
    startDate: Date;
    endDate: Date;
  };
  taskMetrics: {
    tasksCompleted: number;
    tasksCreated: number;
    tasksInProgress: number;
    completionRate: number;
    averageCompletionTime: number; // in hours
    overdueTasksCount: number;
    taskVelocity: number; // tasks per day
  };
  timeMetrics: {
    totalWorkingHours: number;
    averageSessionDuration: number;
    mostProductiveHour: number;
    mostProductiveDay: string;
    workingDaysCount: number;
    streakDays: number;
  };
  qualityMetrics: {
    reworkRate: number; // percentage of tasks that needed rework
    averageTaskComplexity: number;
    bugReportRate: number;
    customerSatisfactionScore: number;
  };
  collaborationMetrics: {
    commentsAdded: number;
    mentionsReceived: number;
    mentionsGiven: number;
    collaborationScore: number;
    teamInteractionRate: number;
  };
  productivityScore: number; // 0-100
  productivityTrend: 'increasing' | 'decreasing' | 'sta