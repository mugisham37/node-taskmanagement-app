import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NavigatorScreenParams } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

// Root Stack Navigator
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

// Auth Stack Navigator
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
  BiometricSetup: undefined;
};

// Main Tab Navigator
export type MainTabParamList = {
  Dashboard: NavigatorScreenParams<DashboardStackParamList>;
  Tasks: NavigatorScreenParams<TasksStackParamList>;
  Projects: NavigatorScreenParams<ProjectsStackParamList>;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
  Notifications: undefined;
};

// Dashboard Stack Navigator
export type DashboardStackParamList = {
  Overview: undefined;
  Analytics: undefined;
  QuickActions: undefined;
};

// Tasks Stack Navigator
export type TasksStackParamList = {
  TaskList: { projectId?: string; workspaceId?: string };
  TaskDetail: { taskId: string };
  TaskCreate: { projectId?: string };
  TaskEdit: { taskId: string };
};

// Projects Stack Navigator
export type ProjectsStackParamList = {
  ProjectList: { workspaceId?: string };
  ProjectDetail: { projectId: string };
  ProjectBoard: { projectId: string };
};

// Profile Stack Navigator
export type ProfileStackParamList = {
  ProfileMain: undefined;
  Settings: undefined;
  Preferences: undefined;
  Security: undefined;
  About: undefined;
};

// Screen Props Types
export type RootStackScreenProps<T extends keyof RootStackParamList> = 
  NativeStackScreenProps<RootStackParamList, T>;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = 
  NativeStackScreenProps<AuthStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = 
  BottomTabScreenProps<MainTabParamList, T>;

export type DashboardStackScreenProps<T extends keyof DashboardStackParamList> = 
  NativeStackScreenProps<DashboardStackParamList, T>;

export type TasksStackScreenProps<T extends keyof TasksStackParamList> = 
  NativeStackScreenProps<TasksStackParamList, T>;

export type ProjectsStackScreenProps<T extends keyof ProjectsStackParamList> = 
  NativeStackScreenProps<ProjectsStackParamList, T>;

export type ProfileStackScreenProps<T extends keyof ProfileStackParamList> = 
  NativeStackScreenProps<ProfileStackParamList, T>;

// Navigation Props
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}