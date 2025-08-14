// User management types

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  bio?: string;
  timezone: string;
  language: string;
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  preferences: UserPreferences;
  stats: UserStats;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    push: boolean;
    desktop: boolean;
    taskAssigned: boolean;
    taskDue: boolean;
    projectUpdates: boolean;
    mentions: boolean;
  };
  dashboard: {
    defaultView: 'list' | 'board' | 'calendar';
    showCompletedTasks: boolean;
    tasksPerPage: number;
  };
  privacy: {
    showOnlineStatus: boolean;
    allowDirectMessages: boolean;
    showProfile: boolean;
  };
}

export interface UserStats {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalProjects: number;
  activeProjects: number;
  hoursLogged: number;
  averageTaskCompletionTime: number;
  productivityScore: number;
}

export interface UpdateUserProfileRequest {
  firstName?: string;
  lastName?: string;
  bio?: string;
  timezone?: string;
  language?: string;
  avatar?: string;
}

export interface UpdateUserPreferencesRequest {
  theme?: 'light' | 'dark' | 'system';
  notifications?: Partial<UserPreferences['notifications']>;
  dashboard?: Partial<UserPreferences['dashboard']>;
  privacy?: Partial<UserPreferences['privacy']>;
}

export interface UserFilter {
  role?: UserRole[];
  isActive?: boolean;
  isEmailVerified?: boolean;
  search?: string;
  createdFrom?: Date;
  createdTo?: Date;
  lastLoginFrom?: Date;
  lastLoginTo?: Date;
}

export interface UserInvitation {
  id: string;
  email: string;
  role: UserRole;
  invitedBy: string;
  projectId?: string;
  token: string;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
}

export interface InviteUserRequest {
  email: string;
  role: UserRole;
  projectId?: string;
  message?: string;
}

// Re-export UserRole from auth types for convenience
export { UserRole } from './auth';