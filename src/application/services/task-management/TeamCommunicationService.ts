import { TeamId } from '../value-objects/TeamId';
import { TaskId } from '../value-objects/TaskId';
import { UserId } from '../../authentication/value-objects/UserId';
import { TeamService, teamService } from './TeamService';
import { DomainEvent } from '../../shared/events/DomainEvent';

export interface TeamMention {
  id: string;
  teamId: TeamId;
  mentionedBy: UserId;
  mentionedUsers: UserId[];
  context: {
    type: 'task' | 'comment' | 'project' | 'general';
    resourceId?: string;
    message: string;
  };
  createdAt: Date;
  isRead: boolean;
  readBy: UserId[];
}

export interface TeamAnnouncement {
  id: string;
  teamId: TeamId;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdBy: UserId;
  targetMembers?: UserId[]; // If undefined, targets all members
  expiresAt?: Date;
  createdAt: Date;
  readBy: UserId[];
  acknowledgedBy: UserId[];
}

export interface TeamCommunicationStats {
  totalMentions: number;
  unreadMentions: number;
  totalAnnouncements: number;
  unreadAnnouncements: number;
  mostActiveCommunicators: { userId: UserId; mentionCount: number }[];
  communicationTrends: {
    date: string;
    mentions: number;
    announcements: number;
  }[];
}

export interface CreateAnnouncementRequest {
  title: string;
  message: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  targetMembers?: UserId[];
  expiresAt?: Date;
}

export interface MentionRequest {
  teamId: TeamId;
  mentionedUsers: UserId[];
  context: {
    type: 'task' | 'comment' | 'project' | 'general';
    resourceId?: string;
    message: string;
  };
}

// Domain Events
export class TeamMentionCreatedEvent extends DomainEvent {
  constructor(
    public readonly mentionId: string,
    public readonly teamId: TeamId,
    public readonly mentionedBy: UserId,
    public readonly mentionedUsers: UserId[],
    public readonly context: any
  ) {
    super('TeamMentionCreated', {
      mentionId,
      teamId: teamId.value,
      mentionedBy: mentionedBy.value,
      mentionedUsers: mentionedUsers.map(u => u.value),
      context,
    });
  }
}

export class TeamAnnouncementCreatedEvent extends DomainEvent {
  constructor(
    public readonly announcementId: string,
    public readonly teamId: TeamId,
    public readonly title: string,
    public readonly createdBy: UserId,
    public readonly priority: string
  ) {
    super('TeamAnnouncementCreated', {
      announcementId,
      teamId: teamId.value,
      title,
      createdBy: createdBy.value,
      priority,
    });
  }
}

export class TeamCommunicationService {
  private readonly mentions = new Map<string, TeamMention>();
  private readonly announcements = new Map<string, TeamAnnouncement>();

  constructor(private readonly teamService: TeamService) {}

  /**
   * Create a team mention
   */
  async createMention(
    mentionedBy: UserId,
    request: MentionRequest
  ): Promise<TeamMention> {
    const team = await this.teamService.getTeamById(request.teamId);

    // Verify mentioner is a team member
    if (!team.isMember(mentionedBy)) {
      throw new Error('Only team members can create mentions');
    }

    // Verify all mentioned users are team members
    for (const userId of request.mentionedUsers) {
      if (!team.isMember(userId)) {
        throw new Error(`User ${userId.value} is not a member of this team`);
      }
    }

    const mention: TeamMention = {
      id: this.generateId(),
      teamId: request.teamId,
      mentionedBy,
      mentionedUsers: request.mentionedUsers,
      context: request.context,
      createdAt: new Date(),
      isRead: false,
      readBy: [],
    };

    this.mentions.set(mention.id, mention);

    // Emit domain event
    console.log(
      new TeamMentionCreatedEvent(
        mention.id,
        request.teamId,
        mentionedBy,
        request.mentionedUsers,
        request.context
      )
    );

    return mention;
  }

  /**
   * Create team announcement
   */
  async createAnnouncement(
    teamId: TeamId,
    createdBy: UserId,
    request: CreateAnnouncementRequest
  ): Promise<TeamAnnouncement> {
    const team = await this.teamService.getTeamById(teamId);

    // Verify creator can manage team
    if (!team.canUserManageTeam(createdBy)) {
      throw new Error('Only team leads can create announcements');
    }

    // Verify target members are team members
    if (request.targetMembers) {
      for (const userId of request.targetMembers) {
        if (!team.isMember(userId)) {
          throw new Error(`User ${userId.value} is not a member of this team`);
        }
      }
    }

    const announcement: TeamAnnouncement = {
      id: this.generateId(),
      teamId,
      title: request.title,
      message: request.message,
      priority: request.priority || 'medium',
      createdBy,
      targetMembers: request.targetMembers,
      expiresAt: request.expiresAt,
      createdAt: new Date(),
      readBy: [],
      acknowledgedBy: [],
    };

    this.announcements.set(announcement.id, announcement);

    // Emit domain event
    console.log(
      new TeamAnnouncementCreatedEvent(
        announcement.id,
        teamId,
        request.title,
        createdBy,
        announcement.priority
      )
    );

    return announcement;
  }

  /**
   * Get mentions for user
   */
  async getUserMentions(
    userId: UserId,
    options: {
      teamId?: TeamId;
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<TeamMention[]> {
    let mentions = Array.from(this.mentions.values()).filter(mention =>
      mention.mentionedUsers.some(u => u.equals(userId))
    );

    // Filter by team if specified
    if (options.teamId) {
      mentions = mentions.filter(mention =>
        mention.teamId.equals(options.teamId!)
      );
    }

    // Filter unread only if specified
    if (options.unreadOnly) {
      mentions = mentions.filter(
        mention => !mention.readBy.some(u => u.equals(userId))
      );
    }

    // Sort by creation date (newest first)
    mentions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    return mentions.slice(offset, offset + limit);
  }

  /**
   * Get team announcements
   */
  async getTeamAnnouncements(
    teamId: TeamId,
    userId: UserId,
    options: {
      unreadOnly?: boolean;
      includeExpired?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<TeamAnnouncement[]> {
    const team = await this.teamService.getTeamById(teamId);

    // Verify user is team member
    if (!team.isMember(userId)) {
      throw new Error('Only team members can view announcements');
    }

    let announcements = Array.from(this.announcements.values()).filter(
      announcement => {
        // Filter by team
        if (!announcement.teamId.equals(teamId)) {
          return false;
        }

        // Check if user is in target members (if specified)
        if (
          announcement.targetMembers &&
          !announcement.targetMembers.some(u => u.equals(userId))
        ) {
          return false;
        }

        return true;
      }
    );

    // Filter expired announcements if not requested
    if (!options.includeExpired) {
      const now = new Date();
      announcements = announcements.filter(
        announcement => !announcement.expiresAt || announcement.expiresAt > now
      );
    }

    // Filter unread only if specified
    if (options.unreadOnly) {
      announcements = announcements.filter(
        announcement => !announcement.readBy.some(u => u.equals(userId))
      );
    }

    // Sort by priority and creation date
    announcements.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff =
        priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 20;
    return announcements.slice(offset, offset + limit);
  }

  /**
   * Mark mention as read
   */
  async markMentionAsRead(mentionId: string, userId: UserId): Promise<void> {
    const mention = this.mentions.get(mentionId);
    if (!mention) {
      throw new Error('Mention not found');
    }

    // Verify user is mentioned
    if (!mention.mentionedUsers.some(u => u.equals(userId))) {
      throw new Error('You are not mentioned in this mention');
    }

    // Add user to read list if not already there
    if (!mention.readBy.some(u => u.equals(userId))) {
      mention.readBy.push(userId);
    }

    // Update read status if all mentioned users have read
    mention.isRead = mention.mentionedUsers.every(mentionedUser =>
      mention.readBy.some(readUser => readUser.equals(mentionedUser))
    );

    this.mentions.set(mentionId, mention);
  }

  /**
   * Mark announcement as read
   */
  async markAnnouncementAsRead(
    announcementId: string,
    userId: UserId
  ): Promise<void> {
    const announcement = this.announcements.get(announcementId);
    if (!announcement) {
      throw new Error('Announcement not found');
    }

    // Verify user can read announcement
    const team = await this.teamService.getTeamById(announcement.teamId);
    if (!team.isMember(userId)) {
      throw new Error('Only team members can read announcements');
    }

    // Check if user is in target members (if specified)
    if (
      announcement.targetMembers &&
      !announcement.targetMembers.some(u => u.equals(userId))
    ) {
      throw new Error('This announcement is not targeted to you');
    }

    // Add user to read list if not already there
    if (!announcement.readBy.some(u => u.equals(userId))) {
      announcement.readBy.push(userId);
    }

    this.announcements.set(announcementId, announcement);
  }

  /**
   * Acknowledge announcement
   */
  async acknowledgeAnnouncement(
    announcementId: string,
    userId: UserId
  ): Promise<void> {
    const announcement = this.announcements.get(announcementId);
    if (!announcement) {
      throw new Error('Announcement not found');
    }

    // Mark as read first
    await this.markAnnouncementAsRead(announcementId, userId);

    // Add user to acknowledged list if not already there
    if (!announcement.acknowledgedBy.some(u => u.equals(userId))) {
      announcement.acknowledgedBy.push(userId);
    }

    this.announcements.set(announcementId, announcement);
  }

  /**
   * Get team communication statistics
   */
  async getTeamCommunicationStats(
    teamId: TeamId,
    userId: UserId,
    period: 'week' | 'month' | 'quarter' = 'month'
  ): Promise<TeamCommunicationStats> {
    const team = await this.teamService.getTeamById(teamId);

    // Verify user is team member
    if (!team.isMember(userId)) {
      throw new Error('Only team members can view communication stats');
    }

    // Calculate date range
    const now = new Date();
    const periodDays = period === 'week' ? 7 : period === 'month' ? 30 : 90;
    const startDate = new Date(
      now.getTime() - periodDays * 24 * 60 * 60 * 1000
    );

    // Filter mentions and announcements by team and date range
    const teamMentions = Array.from(this.mentions.values()).filter(
      mention => mention.teamId.equals(teamId) && mention.createdAt >= startDate
    );

    const teamAnnouncements = Array.from(this.announcements.values()).filter(
      announcement =>
        announcement.teamId.equals(teamId) &&
        announcement.createdAt >= startDate
    );

    // Calculate unread counts for user
    const unreadMentions = teamMentions.filter(
      mention =>
        mention.mentionedUsers.some(u => u.equals(userId)) &&
        !mention.readBy.some(u => u.equals(userId))
    ).length;

    const unreadAnnouncements = teamAnnouncements.filter(
      announcement =>
        (!announcement.targetMembers ||
          announcement.targetMembers.some(u => u.equals(userId))) &&
        !announcement.readBy.some(u => u.equals(userId))
    ).length;

    // Calculate most active communicators
    const communicatorCounts = new Map<string, number>();
    teamMentions.forEach(mention => {
      const userId = mention.mentionedBy.value;
      communicatorCounts.set(userId, (communicatorCounts.get(userId) || 0) + 1);
    });
    teamAnnouncements.forEach(announcement => {
      const userId = announcement.createdBy.value;
      communicatorCounts.set(userId, (communicatorCounts.get(userId) || 0) + 1);
    });

    const mostActiveCommunicators = Array.from(communicatorCounts.entries())
      .map(([userId, count]) => ({
        userId: UserId.fromString(userId),
        mentionCount: count,
      }))
      .sort((a, b) => b.mentionCount - a.mentionCount)
      .slice(0, 5);

    // Generate trend data
    const trendData = Array.from(
      { length: Math.min(periodDays, 30) },
      (_, i) => {
        const date = new Date(
          now.getTime() - (periodDays - 1 - i) * 24 * 60 * 60 * 1000
        );
        const dateStr = date.toISOString().split('T')[0];

        const dayMentions = teamMentions.filter(
          mention => mention.createdAt.toISOString().split('T')[0] === dateStr
        ).length;

        const dayAnnouncements = teamAnnouncements.filter(
          announcement =>
            announcement.createdAt.toISOString().split('T')[0] === dateStr
        ).length;

        return {
          date: dateStr,
          mentions: dayMentions,
          announcements: dayAnnouncements,
        };
      }
    );

    return {
      totalMentions: teamMentions.length,
      unreadMentions,
      totalAnnouncements: teamAnnouncements.length,
      unreadAnnouncements,
      mostActiveCommunicators,
      communicationTrends: trendData,
    };
  }

  /**
   * Parse mentions from text
   */
  parseMentionsFromText(text: string): string[] {
    // Simple regex to find @username patterns
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }

    return [...new Set(mentions)]; // Remove duplicates
  }

  /**
   * Create mention from text parsing
   */
  async createMentionFromText(
    teamId: TeamId,
    mentionedBy: UserId,
    text: string,
    context: {
      type: 'task' | 'comment' | 'project' | 'general';
      resourceId?: string;
    }
  ): Promise<TeamMention | null> {
    const mentionedUsernames = this.parseMentionsFromText(text);
    if (mentionedUsernames.length === 0) {
      return null;
    }

    // In a real implementation, you would resolve usernames to UserIds
    // For now, we'll create mock UserIds
    const mentionedUsers = mentionedUsernames.map(username =>
      UserId.fromString(`user_${username}`)
    );

    return await this.createMention(mentionedBy, {
      teamId,
      mentionedUsers,
      context: {
        ...context,
        message: text,
      },
    });
  }

  /**
   * Get mention by ID
   */
  async getMentionById(mentionId: string): Promise<TeamMention | null> {
    return this.mentions.get(mentionId) || null;
  }

  /**
   * Get announcement by ID
   */
  async getAnnouncementById(
    announcementId: string
  ): Promise<TeamAnnouncement | null> {
    return this.announcements.get(announcementId) || null;
  }

  /**
   * Delete announcement
   */
  async deleteAnnouncement(
    announcementId: string,
    userId: UserId
  ): Promise<void> {
    const announcement = this.announcements.get(announcementId);
    if (!announcement) {
      throw new Error('Announcement not found');
    }

    // Only creator or team lead can delete
    const team = await this.teamService.getTeamById(announcement.teamId);
    if (!announcement.createdBy.equals(userId) && !team.isLead(userId)) {
      throw new Error(
        'Only the creator or team lead can delete this announcement'
      );
    }

    this.announcements.delete(announcementId);
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}
