import { LinkingOptions } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['taskmanagement://', 'https://taskmanagement.app'],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
          Register: 'register',
          ForgotPassword: 'forgot-password',
          ResetPassword: 'reset-password',
          BiometricSetup: 'biometric-setup',
        },
      },
      Main: {
        screens: {
          Dashboard: {
            screens: {
              Overview: 'dashboard',
              Analytics: 'dashboard/analytics',
              QuickActions: 'dashboard/quick-actions',
            },
          },
          Tasks: {
            screens: {
              TaskList: 'tasks',
              TaskDetail: 'tasks/:taskId',
              TaskCreate: 'tasks/create',
              TaskEdit: 'tasks/:taskId/edit',
            },
          },
          Projects: {
            screens: {
              ProjectList: 'projects',
              ProjectDetail: 'projects/:projectId',
              ProjectBoard: 'projects/:projectId/board',
            },
          },
          Profile: {
            screens: {
              ProfileMain: 'profile',
              Settings: 'profile/settings',
              Preferences: 'profile/preferences',
              Security: 'profile/security',
              About: 'profile/about',
            },
          },
          Notifications: 'notifications',
        },
      },
    },
  },
};