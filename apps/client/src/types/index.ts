// Re-export shared types
export * from "@taskmanagement/shared";

// Client-specific types
export interface ClientPreferences {
  theme: "light" | "dark" | "system";
  language: string;
  timezone: string;
  notifications: {
    email: boolean;
    push: boolean;
    desktop: boolean;
  };
}

export interface NavigationItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

export interface DashboardStats {
  totalTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  totalProjects: number;
}

export interface RealtimeEvent {
  type: string;
  payload: any;
  timestamp: number;
  userId?: string;
  roomId?: string;
}