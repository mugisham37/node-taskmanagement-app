import { BaseService } from '../../shared/services/BaseService';
import { IActivityTrackingRepository } from '../repositories/IActivityTrackingRepository';
import { IMetricsRepository } from '../repositories/IMetricsRepository';
import { MetricsCollectionService } from './MetricsCollectionService';
import { ActivityTrackingService } from './ActivityTrackingService';

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
  productivityTrend: 'increasing' | 'decreasing' | 'stable';
  recommendations: string[];
}

export interface TeamProductivityMetrics {
  teamId: string;
  teamName: string;
  timeRange: {
    startDate: Date;
    endDate: Date;
  };
  overview: {
    memberCount: number;
    totalTasks: number;
    completedTasks: number;
    averageCompletionRate: number;
    teamVelocity: number;
  };
  memberMetrics: UserProductivityMetrics[];
  collaborationMetrics: {
    totalCollaborativeActions: number;
    averageCollaborationScore: number;
    crossFunctionalInteractions: number;
    knowledgeSharingIndex: number;
  };
  performanceDistribution: {
    highPerformers: number; // count
    averagePerformers: number; // count
    lowPerformers: number; // count
  };
  teamHealthScore: number; // 0-100
  recommendations: string[];
}

export interface WorkspaceProductivityMetrics {
  workspaceId: string;
  workspaceName: string;
  timeRange: {
    startDate: Date;
    endDate: Date;
  };
  overview: {
    totalUsers: number;
    activeUsers: number;
    totalProjects: number;
    totalTasks: number;
    overallCompletionRate: number;
    workspaceVelocity: number;
  };
  departmentMetrics: Array<{
    departmentName: string;
    memberCount: number;
    productivityScore: number;
    collaborationScore: number;
    taskCompletionRate: number;
  }>;
  trendAnalysis: {
    productivityTrend: 'increasing' | 'decreasing' | 'stable';
    trendPercentage: number;
    keyDrivers: string[];
  };
  benchmarks: {
    industryAverage: number;
    topQuartile: number;
    currentPosition: 'top' | 'above_average' | 'average' | 'below_average';
  };
  recommendations: string[];
}

export interface ProductivityInsights {
  timeToValue: {
    averageTimeToFirstTask: number; // hours
    averageTimeToFirstCompletion: number; // hours
    onboardingEfficiency: number; // 0-100
  };
  workloadAnalysis: {
    averageTasksPerUser: number;
    workloadDistribution: 'balanced' | 'unbalanced';
    overloadedUsers: string[]; // user IDs
    underutilizedUsers: string[]; // user IDs
  };
  bottleneckAnalysis: {
    commonBottlenecks: Array<{
      type: string;
      frequency: number;
      impact: 'high' | 'medium' | 'low';
      affectedUsers: string[];
    }>;
    resolutionSuggestions: string[];
  };
  skillGapAnalysis: {
    identifiedGaps: Array<{
      skill: string;
      severity: 'critical' | 'moderate' | 'minor';
      affectedUsers: string[];
      trainingRecommendations: string[];
    }>;
  };
}

export class ProductivityAnalyticsService extends BaseService {
  constructor(
    private readonly activityRepository: IActivityTrackingRepository,
    private readonly metricsRepository: IMetricsRepository,
    private readonly metricsCollectionService: MetricsCollectionService,
    private readonly activityTrackingService: ActivityTrackingService
  ) {
    super('ProductivityAnalyticsService');
  }

  async getUserProductivityMetrics(
    userId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<UserProductivityMetrics> {
    try {
      // Get basic user activity profile
      const activityProfile =
        await this.activityTrackingService.getUserActivityProfile(
          userId,
          timeRange
        );

      // Get detailed task metrics
      const taskMetrics = await this.calculateUserTaskMetrics(
        userId,
        timeRange
      );

      // Get time-based metrics
      const timeMetrics = await this.calculateUserTimeMetrics(
        userId,
        timeRange
      );

      // Get quality metrics
      const qualityMetrics = await this.calculateUserQualityMetrics(
        userId,
        timeRange
      );

      // Get collaboration metrics
      const collaborationMetrics = await this.calculateUserCollaborationMetrics(
        userId,
        timeRange
      );

      // Calculate overall productivity score
      const productivityScore = await this.calculateProductivityScore(
        taskMetrics,
        timeMetrics,
        qualityMetrics,
        collaborationMetrics
      );

      // Analyze productivity trend
      const productivityTrend = await this.analyzeProductivityTrend(
        userId,
        timeRange
      );

      // Generate recommendations
      const recommendations = await this.generateUserRecommendations(
        userId,
        taskMetrics,
        timeMetrics,
        qualityMetrics,
        collaborationMetrics,
        productivityScore
      );

      const metrics: UserProductivityMetrics = {
        userId,
        userName: activityProfile.userName || 'Unknown User',
        timeRange,
        taskMetrics,
        timeMetrics,
        qualityMetrics,
        collaborationMetrics,
        productivityScore,
        productivityTrend,
        recommendations,
      };

      // Record metrics for future analysis
      await this.recordProductivityMetrics(metrics);

      return metrics;
    } catch (error) {
      this.logger.error('Failed to get user productivity metrics', {
        error: error.message,
        userId,
        timeRange,
      });
      throw error;
    }
  }

  async getTeamProductivityMetrics(
    teamId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<TeamProductivityMetrics> {
    try {
      // Get team members
      const teamMembers = await this.getTeamMembers(teamId);

      // Get individual member metrics
      const memberMetrics = await Promise.all(
        teamMembers.map(member =>
          this.getUserProductivityMetrics(member.userId, timeRange)
        )
      );

      // Calculate team overview
      const overview = this.calculateTeamOverview(memberMetrics);

      // Calculate collaboration metrics
      const collaborationMetrics = await this.calculateTeamCollaborationMetrics(
        teamId,
        timeRange
      );

      // Analyze performance distribution
      const performanceDistribution =
        this.analyzePerformanceDistribution(memberMetrics);

      // Calculate team health score
      const teamHealthScore = this.calculateTeamHealthScore(
        overview,
        collaborationMetrics,
        performanceDistribution
      );

      // Generate team recommendations
      const recommendations = await this.generateTeamRecommendations(
        teamId,
        overview,
        memberMetrics,
        collaborationMetrics,
        performanceDistribution
      );

      const metrics: TeamProductivityMetrics = {
        teamId,
        teamName: await this.getTeamName(teamId),
        timeRange,
        overview,
        memberMetrics,
        collaborationMetrics,
        performanceDistribution,
        teamHealthScore,
        recommendations,
      };

      return metrics;
    } catch (error) {
      this.logger.error('Failed to get team productivity metrics', {
        error: error.message,
        teamId,
        timeRange,
      });
      throw error;
    }
  }

  async getWorkspaceProductivityMetrics(
    workspaceId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<WorkspaceProductivityMetrics> {
    try {
      // Get workspace overview
      const overview = await this.calculateWorkspaceOverview(
        workspaceId,
        timeRange
      );

      // Get department metrics
      const departmentMetrics = await this.calculateDepartmentMetrics(
        workspaceId,
        timeRange
      );

      // Analyze trends
      const trendAnalysis = await this.analyzeWorkspaceTrends(
        workspaceId,
        timeRange
      );

      // Get benchmarks
      const benchmarks = await this.getProductivityBenchmarks(workspaceId);

      // Generate recommendations
      const recommendations = await this.generateWorkspaceRecommendations(
        workspaceId,
        overview,
        departmentMetrics,
        trendAnalysis,
        benchmarks
      );

      const metrics: WorkspaceProductivityMetrics = {
        workspaceId,
        workspaceName: await this.getWorkspaceName(workspaceId),
        timeRange,
        overview,
        departmentMetrics,
        trendAnalysis,
        benchmarks,
        recommendations,
      };

      return metrics;
    } catch (error) {
      this.logger.error('Failed to get workspace productivity metrics', {
        error: error.message,
        workspaceId,
        timeRange,
      });
      throw error;
    }
  }

  async getProductivityInsights(
    workspaceId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<ProductivityInsights> {
    try {
      // Analyze time to value
      const timeToValue = await this.analyzeTimeToValue(workspaceId, timeRange);

      // Analyze workload distribution
      const workloadAnalysis = await this.analyzeWorkloadDistribution(
        workspaceId,
        timeRange
      );

      // Identify bottlenecks
      const bottleneckAnalysis = await this.analyzeBottlenecks(
        workspaceId,
        timeRange
      );

      // Analyze skill gaps
      const skillGapAnalysis = await this.analyzeSkillGaps(
        workspaceId,
        timeRange
      );

      const insights: ProductivityInsights = {
        timeToValue,
        workloadAnalysis,
        bottleneckAnalysis,
        skillGapAnalysis,
      };

      return insights;
    } catch (error) {
      this.logger.error('Failed to get productivity insights', {
        error: error.message,
        workspaceId,
        timeRange,
      });
      throw error;
    }
  }

  // Private helper methods

  private async calculateUserTaskMetrics(
    userId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<UserProductivityMetrics['taskMetrics']> {
    // Implementation would query task data and calculate metrics
    return {
      tasksCompleted: 0,
      tasksCreated: 0,
      tasksInProgress: 0,
      completionRate: 0,
      averageCompletionTime: 0,
      overdueTasksCount: 0,
      taskVelocity: 0,
    };
  }

  private async calculateUserTimeMetrics(
    userId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<UserProductivityMetrics['timeMetrics']> {
    // Implementation would analyze time-based activity data
    return {
      totalWorkingHours: 0,
      averageSessionDuration: 0,
      mostProductiveHour: 9,
      mostProductiveDay: 'Monday',
      workingDaysCount: 0,
      streakDays: 0,
    };
  }

  private async calculateUserQualityMetrics(
    userId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<UserProductivityMetrics['qualityMetrics']> {
    // Implementation would analyze quality indicators
    return {
      reworkRate: 0,
      averageTaskComplexity: 0,
      bugReportRate: 0,
      customerSatisfactionScore: 0,
    };
  }

  private async calculateUserCollaborationMetrics(
    userId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<UserProductivityMetrics['collaborationMetrics']> {
    // Implementation would analyze collaboration activities
    return {
      commentsAdded: 0,
      mentionsReceived: 0,
      mentionsGiven: 0,
      collaborationScore: 0,
      teamInteractionRate: 0,
    };
  }

  private async calculateProductivityScore(
    taskMetrics: UserProductivityMetrics['taskMetrics'],
    timeMetrics: UserProductivityMetrics['timeMetrics'],
    qualityMetrics: UserProductivityMetrics['qualityMetrics'],
    collaborationMetrics: UserProductivityMetrics['collaborationMetrics']
  ): Promise<number> {
    // Weighted scoring algorithm
    let score = 0;

    // Task completion (40% weight)
    score += taskMetrics.completionRate * 0.4;

    // Time efficiency (25% weight)
    const timeEfficiency = Math.min(
      100,
      (8 / (taskMetrics.averageCompletionTime || 8)) * 100
    );
    score += timeEfficiency * 0.25;

    // Quality (20% weight)
    const qualityScore = Math.max(0, 100 - qualityMetrics.reworkRate);
    score += qualityScore * 0.2;

    // Collaboration (15% weight)
    score += collaborationMetrics.collaborationScore * 0.15;

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  private async analyzeProductivityTrend(
    userId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<'increasing' | 'decreasing' | 'stable'> {
    // Implementation would compare current period with previous period
    return 'stable';
  }

  private async generateUserRecommendations(
    userId: string,
    taskMetrics: UserProductivityMetrics['taskMetrics'],
    timeMetrics: UserProductivityMetrics['timeMetrics'],
    qualityMetrics: UserProductivityMetrics['qualityMetrics'],
    collaborationMetrics: UserProductivityMetrics['collaborationMetrics'],
    productivityScore: number
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (taskMetrics.completionRate < 70) {
      recommendations.push(
        'Focus on completing existing tasks before taking on new ones'
      );
    }

    if (taskMetrics.overdueTasksCount > 3) {
      recommendations.push(
        'Review task prioritization and deadline management'
      );
    }

    if (qualityMetrics.reworkRate > 20) {
      recommendations.push(
        'Consider additional quality checks before marking tasks complete'
      );
    }

    if (collaborationMetrics.collaborationScore < 50) {
      recommendations.push(
        'Increase team collaboration through comments and mentions'
      );
    }

    if (timeMetrics.streakDays < 3) {
      recommendations.push(
        'Build consistency by completing at least one task daily'
      );
    }

    return recommendations;
  }

  private async getTeamMembers(
    teamId: string
  ): Promise<Array<{ userId: string; userName: string }>> {
    // Implementation would query team membership
    return [];
  }

  private calculateTeamOverview(
    memberMetrics: UserProductivityMetrics[]
  ): TeamProductivityMetrics['overview'] {
    const totalTasks = memberMetrics.reduce(
      (sum, m) => sum + m.taskMetrics.tasksCompleted,
      0
    );
    const completedTasks = memberMetrics.reduce(
      (sum, m) => sum + m.taskMetrics.tasksCompleted,
      0
    );
    const averageCompletionRate =
      memberMetrics.reduce((sum, m) => sum + m.taskMetrics.completionRate, 0) /
      memberMetrics.length;

    return {
      memberCount: memberMetrics.length,
      totalTasks,
      completedTasks,
      averageCompletionRate,
      teamVelocity: totalTasks / memberMetrics.length,
    };
  }

  private async calculateTeamCollaborationMetrics(
    teamId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<TeamProductivityMetrics['collaborationMetrics']> {
    // Implementation would analyze team collaboration patterns
    return {
      totalCollaborativeActions: 0,
      averageCollaborationScore: 0,
      crossFunctionalInteractions: 0,
      knowledgeSharingIndex: 0,
    };
  }

  private analyzePerformanceDistribution(
    memberMetrics: UserProductivityMetrics[]
  ): TeamProductivityMetrics['performanceDistribution'] {
    const highPerformers = memberMetrics.filter(
      m => m.productivityScore >= 80
    ).length;
    const lowPerformers = memberMetrics.filter(
      m => m.productivityScore < 60
    ).length;
    const averagePerformers =
      memberMetrics.length - highPerformers - lowPerformers;

    return {
      highPerformers,
      averagePerformers,
      lowPerformers,
    };
  }

  private calculateTeamHealthScore(
    overview: TeamProductivityMetrics['overview'],
    collaborationMetrics: TeamProductivityMetrics['collaborationMetrics'],
    performanceDistribution: TeamProductivityMetrics['performanceDistribution']
  ): number {
    // Implementation would calculate team health based on various factors
    return 75; // Placeholder
  }

  private async generateTeamRecommendations(
    teamId: string,
    overview: TeamProductivityMetrics['overview'],
    memberMetrics: UserProductivityMetrics[],
    collaborationMetrics: TeamProductivityMetrics['collaborationMetrics'],
    performanceDistribution: TeamProductivityMetrics['performanceDistribution']
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (overview.averageCompletionRate < 70) {
      recommendations.push(
        'Team completion rate is below target. Consider workload rebalancing.'
      );
    }

    if (
      performanceDistribution.lowPerformers >
      performanceDistribution.highPerformers
    ) {
      recommendations.push(
        'Focus on supporting underperforming team members with training or mentoring.'
      );
    }

    if (collaborationMetrics.averageCollaborationScore < 60) {
      recommendations.push(
        'Encourage more team collaboration through regular check-ins and pair work.'
      );
    }

    return recommendations;
  }

  private async calculateWorkspaceOverview(
    workspaceId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<WorkspaceProductivityMetrics['overview']> {
    // Implementation would query workspace-wide metrics
    return {
      totalUsers: 0,
      activeUsers: 0,
      totalProjects: 0,
      totalTasks: 0,
      overallCompletionRate: 0,
      workspaceVelocity: 0,
    };
  }

  private async calculateDepartmentMetrics(
    workspaceId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<WorkspaceProductivityMetrics['departmentMetrics']> {
    // Implementation would analyze metrics by department/team
    return [];
  }

  private async analyzeWorkspaceTrends(
    workspaceId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<WorkspaceProductivityMetrics['trendAnalysis']> {
    // Implementation would analyze productivity trends
    return {
      productivityTrend: 'stable',
      trendPercentage: 0,
      keyDrivers: [],
    };
  }

  private async getProductivityBenchmarks(
    workspaceId: string
  ): Promise<WorkspaceProductivityMetrics['benchmarks']> {
    // Implementation would compare against industry benchmarks
    return {
      industryAverage: 75,
      topQuartile: 85,
      currentPosition: 'average',
    };
  }

  private async generateWorkspaceRecommendations(
    workspaceId: string,
    overview: WorkspaceProductivityMetrics['overview'],
    departmentMetrics: WorkspaceProductivityMetrics['departmentMetrics'],
    trendAnalysis: WorkspaceProductivityMetrics['trendAnalysis'],
    benchmarks: WorkspaceProductivityMetrics['benchmarks']
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (overview.overallCompletionRate < benchmarks.industryAverage) {
      recommendations.push(
        'Overall completion rate is below industry average. Focus on process improvements.'
      );
    }

    if (trendAnalysis.productivityTrend === 'decreasing') {
      recommendations.push(
        'Productivity is declining. Investigate root causes and implement corrective measures.'
      );
    }

    return recommendations;
  }

  private async analyzeTimeToValue(
    workspaceId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<ProductivityInsights['timeToValue']> {
    // Implementation would analyze onboarding and time-to-productivity metrics
    return {
      averageTimeToFirstTask: 0,
      averageTimeToFirstCompletion: 0,
      onboardingEfficiency: 0,
    };
  }

  private async analyzeWorkloadDistribution(
    workspaceId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<ProductivityInsights['workloadAnalysis']> {
    // Implementation would analyze task distribution across users
    return {
      averageTasksPerUser: 0,
      workloadDistribution: 'balanced',
      overloadedUsers: [],
      underutilizedUsers: [],
    };
  }

  private async analyzeBottlenecks(
    workspaceId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<ProductivityInsights['bottleneckAnalysis']> {
    // Implementation would identify common bottlenecks
    return {
      commonBottlenecks: [],
      resolutionSuggestions: [],
    };
  }

  private async analyzeSkillGaps(
    workspaceId: string,
    timeRange: { startDate: Date; endDate: Date }
  ): Promise<ProductivityInsights['skillGapAnalysis']> {
    // Implementation would identify skill gaps based on task performance
    return {
      identifiedGaps: [],
    };
  }

  private async recordProductivityMetrics(
    metrics: UserProductivityMetrics
  ): Promise<void> {
    try {
      // Record key metrics for trend analysis
      await this.metricsCollectionService.recordMetric({
        name: 'user.productivity_score',
        value: metrics.productivityScore,
        tags: { userId: metrics.userId },
      });

      await this.metricsCollectionService.recordMetric({
        name: 'user.task_completion_rate',
        value: metrics.taskMetrics.completionRate,
        tags: { userId: metrics.userId },
      });

      await this.metricsCollectionService.recordMetric({
        name: 'user.collaboration_score',
        value: metrics.collaborationMetrics.collaborationScore,
        tags: { userId: metrics.userId },
      });
    } catch (error) {
      this.logger.error('Failed to record productivity metrics', {
        error: error.message,
        userId: metrics.userId,
      });
    }
  }

  private async getTeamName(teamId: string): Promise<string> {
    // Implementation would query team name
    return 'Unknown Team';
  }

  private async getWorkspaceName(workspaceId: string): Promise<string> {
    // Implementation would query workspace name
    return 'Unknown Workspace';
  }
}
