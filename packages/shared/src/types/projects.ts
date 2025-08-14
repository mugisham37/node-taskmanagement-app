// Project management types

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  ownerId: string;
  members: ProjectMember[];
  tags: string[];
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  progress: number;
  settings: ProjectSettings;
  createdAt: Date;
  updatedAt: Date;
}

export enum ProjectStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  ON_HOLD = 'on-hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum ProjectPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: Date;
  permissions: ProjectPermission[];
}

export enum ProjectRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer'
}

export interface ProjectPermission {
  resource: string;
  actions: string[];
}

export interface ProjectSettings {
  isPublic: boolean;
  allowGuestAccess: boolean;
  taskAutoAssignment: boolean;
  notificationSettings: {
    taskUpdates: boolean;
    deadlineReminders: boolean;
    memberJoined: boolean;
    projectUpdates: boolean;
  };
  workflowSettings: {
    allowStatusTransitions: Record<string, string[]>;
    requireApprovalForCompletion: boolean;
    autoCloseCompletedTasks: boolean;
  };
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  priority?: ProjectPriority;
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  settings?: Partial<ProjectSettings>;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  progress?: number;
  settings?: Partial<ProjectSettings>;
}

export interface ProjectFilter {
  status?: ProjectStatus[];
  priority?: ProjectPriority[];
  ownerId?: string[];
  memberId?: string;
  tags?: string[];
  startDateFrom?: Date;
  startDateTo?: Date;
  endDateFrom?: Date;
  endDateTo?: Date;
  search?: string;
}

export interface ProjectStats {
  total: number;
  byStatus: Record<ProjectStatus, number>;
  byPriority: Record<ProjectPriority, number>;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalMembers: number;
  averageProgress: number;
}