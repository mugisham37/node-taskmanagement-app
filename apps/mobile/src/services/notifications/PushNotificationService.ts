import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiService } from '../api/ApiService';

export interface NotificationData {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  categoryId?: string;
  sound?: string;
  badge?: number;
  priority?: 'default' | 'high' | 'max';
  channelId?: string;
}

export interface ScheduledNotification {
  id: string;
  trigger: Notifications.NotificationTriggerInput;
  content: Notifications.NotificationContentInput;
}

export interface NotificationCategory {
  identifier: string;
  actions: NotificationAction[];
  options?: {
    customDismissAction?: boolean;
    allowInCarPlay?: boolean;
    showTitle?: boolean;
    showSubtitle?: boolean;
  };
}

export interface NotificationAction {
  identifier: string;
  title: string;
  options?: {
    isDestructive?: boolean;
    isAuthenticationRequired?: boolean;
    opensAppToForeground?: boolean;
  };
}

class PushNotificationService {
  private expoPushToken: string | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Configure notification behavior
      await this.configureNotifications();

      // Set up notification channels (Android)
      await this.setupNotificationChannels();

      // Set up notification categories
      await this.setupNotificationCategories();

      // Register for push notifications
      await this.registerForPushNotifications();

      // Set up listeners
      this.setupNotificationListeners();

      this.isInitialized = true;
      console.log('Push notification service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize push notification service:', error);
      throw error;
    }
  }

  private async configureNotifications(): Promise<void> {
    // Set notification handler
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const shouldShow = await this.shouldShowNotification(notification);
        return {
          shouldShowAlert: shouldShow,
          shouldPlaySound: shouldShow,
          shouldSetBadge: shouldShow,
        };
      },
    });

    // Configure notification behavior on iOS
    if (Platform.OS === 'ios') {
      await Notifications.setNotificationCategoryAsync('TASK_ACTIONS', [
        {
          identifier: 'COMPLETE_TASK',
          buttonTitle: 'Complete',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'SNOOZE_TASK',
          buttonTitle: 'Snooze',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: 'VIEW_TASK',
          buttonTitle: 'View',
          options: {
            opensAppToForeground: true,
          },
        },
      ]);
    }
  }

  private async setupNotificationChannels(): Promise<void> {
    if (Platform.OS === 'android') {
      // Create notification channels for Android
      await Notifications.setNotificationChannelAsync('tasks', {
        name: 'Task Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
        description: 'Notifications for task updates and reminders',
      });

      await Notifications.setNotificationChannelAsync('projects', {
        name: 'Project Notifications',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
        description: 'Notifications for project updates',
      });

      await Notifications.setNotificationChannelAsync('system', {
        name: 'System Notifications',
        importance: Notifications.AndroidImportance.LOW,
        vibrationPattern: [0, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
        description: 'System notifications and updates',
      });

      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Task Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'reminder_sound',
        description: 'Task due date and deadline reminders',
      });
    }
  }

  private async setupNotificationCategories(): Promise<void> {
    const categories: NotificationCategory[] = [
      {
        identifier: 'TASK_REMINDER',
        actions: [
          {
            identifier: 'COMPLETE_TASK',
            title: 'Mark Complete',
            options: { opensAppToForeground: false }
          },
          {
            identifier: 'SNOOZE_REMINDER',
            title: 'Snooze 1h',
            options: { opensAppToForeground: false }
          },
          {
            identifier: 'VIEW_TASK',
            title: 'View Task',
            options: { opensAppToForeground: true }
          }
        ]
      },
      {
        identifier: 'TASK_ASSIGNED',
        actions: [
          {
            identifier: 'ACCEPT_TASK',
            title: 'Accept',
            options: { opensAppToForeground: false }
          },
          {
            identifier: 'VIEW_TASK',
            title: 'View Details',
            options: { opensAppToForeground: true }
          }
        ]
      },
      {
        identifier: 'PROJECT_UPDATE',
        actions: [
          {
            identifier: 'VIEW_PROJECT',
            title: 'View Project',
            options: { opensAppToForeground: true }
          }
        ]
      }
    ];

    for (const category of categories) {
      if (Platform.OS === 'ios') {
        await Notifications.setNotificationCategoryAsync(
          category.identifier,
          category.actions.map(action => ({
            identifier: action.identifier,
            buttonTitle: action.title,
            options: action.options
          }))
        );
      }
    }
  }

  private async registerForPushNotifications(): Promise<void> {
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowAnnouncements: true,
          allowCriticalAlerts: false,
          provideAppNotificationSettings: true,
          allowProvisional: false,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notification permissions not granted');
      return;
    }

    // Get push token
    try {
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PROJECT_ID,
      });
      
      this.expoPushToken = token.data;
      await this.savePushToken(token.data);
      
      // Register token with backend
      await this.registerTokenWithBackend(token.data);
      
      console.log('Push token registered:', token.data);
    } catch (error) {
      console.error('Failed to get push token:', error);
    }
  }

  private setupNotificationListeners(): void {
    // Listen for notifications received while app is running
    this.notificationListener = Notifications.addNotificationReceivedListener(
      this.handleNotificationReceived.bind(this)
    );

    // Listen for user interactions with notifications
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      this.handleNotificationResponse.bind(this)
    );
  }

  private async handleNotificationReceived(notification: Notifications.Notification): Promise<void> {
    console.log('Notification received:', notification);
    
    // Update badge count
    const badgeCount = await this.getBadgeCount();
    await Notifications.setBadgeCountAsync(badgeCount + 1);
    
    // Handle notification data
    const { data } = notification.request.content;
    if (data) {
      await this.processNotificationData(data);
    }
  }

  private async handleNotificationResponse(response: Notifications.NotificationResponse): Promise<void> {
    console.log('Notification response:', response);
    
    const { actionIdentifier, notification } = response;
    const { data } = notification.request.content;
    
    // Handle action-specific responses
    switch (actionIdentifier) {
      case 'COMPLETE_TASK':
        if (data?.taskId) {
          await this.completeTaskFromNotification(data.taskId);
        }
        break;
        
      case 'SNOOZE_REMINDER':
        if (data?.taskId) {
          await this.snoozeTaskReminder(data.taskId, 60); // 1 hour
        }
        break;
        
      case 'ACCEPT_TASK':
        if (data?.taskId) {
          await this.acceptTaskFromNotification(data.taskId);
        }
        break;
        
      case 'VIEW_TASK':
      case 'VIEW_PROJECT':
        // Navigation will be handled by the app's navigation service
        break;
        
      default:
        // Default action (tap notification)
        if (data?.deepLink) {
          // Handle deep linking
          await this.handleDeepLink(data.deepLink);
        }
        break;
    }
    
    // Clear badge if notification was interacted with
    await this.decrementBadgeCount();
  }

  private async shouldShowNotification(notification: Notifications.Notification): Promise<boolean> {
    // Check user preferences
    const preferences = await this.getNotificationPreferences();
    const { categoryId } = notification.request.content.data || {};
    
    if (categoryId && preferences[categoryId] === false) {
      return false;
    }
    
    // Check do not disturb settings
    const currentHour = new Date().getHours();
    if (preferences.doNotDisturb && 
        currentHour >= preferences.doNotDisturbStart && 
        currentHour < preferences.doNotDisturbEnd) {
      return false;
    }
    
    return true;
  }

  private async processNotificationData(data: any): Promise<void> {
    // Process notification data for app state updates
    if (data.type === 'task_update' && data.taskId) {
      // Trigger task refresh in the app
      // This would typically emit an event or update a store
    } else if (data.type === 'project_update' && data.projectId) {
      // Trigger project refresh in the app
    }
  }

  // Public API methods
  async sendLocalNotification(notification: NotificationData): Promise<string> {
    const content: Notifications.NotificationContentInput = {
      title: notification.title,
      body: notification.body,
      data: notification.data,
      sound: notification.sound || 'default',
      badge: notification.badge,
      categoryIdentifier: notification.categoryId,
    };

    if (Platform.OS === 'android') {
      content.android = {
        channelId: notification.channelId || 'tasks',
        priority: notification.priority === 'high' ? 
          Notifications.AndroidNotificationPriority.HIGH : 
          Notifications.AndroidNotificationPriority.DEFAULT,
      };
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content,
      trigger: null, // Immediate notification
    });

    return identifier;
  }

  async scheduleNotification(
    notification: NotificationData,
    trigger: Notifications.NotificationTriggerInput
  ): Promise<string> {
    const content: Notifications.NotificationContentInput = {
      title: notification.title,
      body: notification.body,
      data: notification.data,
      sound: notification.sound || 'default',
      badge: notification.badge,
      categoryIdentifier: notification.categoryId,
    };

    if (Platform.OS === 'android') {
      content.android = {
        channelId: notification.channelId || 'reminders',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      };
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content,
      trigger,
    });

    // Store scheduled notification for management
    await this.storeScheduledNotification(identifier, { content, trigger });

    return identifier;
  }

  async cancelNotification(identifier: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    await this.removeScheduledNotification(identifier);
  }

  async cancelAllNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await this.clearScheduledNotifications();
  }

  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    return await Notifications.getAllScheduledNotificationsAsync();
  }

  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  async incrementBadgeCount(): Promise<void> {
    const current = await this.getBadgeCount();
    await this.setBadgeCount(current + 1);
  }

  async decrementBadgeCount(): Promise<void> {
    const current = await this.getBadgeCount();
    await this.setBadgeCount(Math.max(0, current - 1));
  }

  async clearBadge(): Promise<void> {
    await this.setBadgeCount(0);
  }

  // Task-specific notification methods
  async scheduleTaskReminder(taskId: string, title: string, dueDate: Date): Promise<string> {
    const reminderTime = new Date(dueDate.getTime() - 60 * 60 * 1000); // 1 hour before
    
    if (reminderTime <= new Date()) {
      throw new Error('Reminder time must be in the future');
    }

    return await this.scheduleNotification(
      {
        id: `task_reminder_${taskId}`,
        title: 'Task Reminder',
        body: `"${title}" is due in 1 hour`,
        data: {
          type: 'task_reminder',
          taskId,
          deepLink: `/tasks/${taskId}`,
        },
        categoryId: 'TASK_REMINDER',
        channelId: 'reminders',
        priority: 'high',
      },
      {
        date: reminderTime,
      }
    );
  }

  async scheduleTaskDeadlineNotification(taskId: string, title: string, dueDate: Date): Promise<string> {
    return await this.scheduleNotification(
      {
        id: `task_deadline_${taskId}`,
        title: 'Task Deadline',
        body: `"${title}" is due now!`,
        data: {
          type: 'task_deadline',
          taskId,
          deepLink: `/tasks/${taskId}`,
        },
        categoryId: 'TASK_REMINDER',
        channelId: 'reminders',
        priority: 'high',
      },
      {
        date: dueDate,
      }
    );
  }

  // Helper methods
  private async savePushToken(token: string): Promise<void> {
    await AsyncStorage.setItem('push_token', token);
  }

  private async getPushToken(): Promise<string | null> {
    return await AsyncStorage.getItem('push_token');
  }

  private async registerTokenWithBackend(token: string): Promise<void> {
    try {
      await apiService.registerPushToken(token, Platform.OS);
    } catch (error) {
      console.error('Failed to register push token with backend:', error);
    }
  }

  private async getNotificationPreferences(): Promise<Record<string, any>> {
    const preferences = await AsyncStorage.getItem('notification_preferences');
    return preferences ? JSON.parse(preferences) : {
      tasks: true,
      projects: true,
      system: true,
      reminders: true,
      doNotDisturb: false,
      doNotDisturbStart: 22, // 10 PM
      doNotDisturbEnd: 8,    // 8 AM
    };
  }

  async updateNotificationPreferences(preferences: Record<string, any>): Promise<void> {
    await AsyncStorage.setItem('notification_preferences', JSON.stringify(preferences));
  }

  private async storeScheduledNotification(identifier: string, notification: any): Promise<void> {
    const stored = await AsyncStorage.getItem('scheduled_notifications');
    const notifications = stored ? JSON.parse(stored) : {};
    notifications[identifier] = notification;
    await AsyncStorage.setItem('scheduled_notifications', JSON.stringify(notifications));
  }

  private async removeScheduledNotification(identifier: string): Promise<void> {
    const stored = await AsyncStorage.getItem('scheduled_notifications');
    if (stored) {
      const notifications = JSON.parse(stored);
      delete notifications[identifier];
      await AsyncStorage.setItem('scheduled_notifications', JSON.stringify(notifications));
    }
  }

  private async clearScheduledNotifications(): Promise<void> {
    await AsyncStorage.removeItem('scheduled_notifications');
  }

  // Action handlers
  private async completeTaskFromNotification(taskId: string): Promise<void> {
    try {
      await apiService.updateTask(taskId, { status: 'COMPLETED' });
      await this.sendLocalNotification({
        id: `task_completed_${taskId}`,
        title: 'Task Completed',
        body: 'Task marked as completed',
        channelId: 'system',
      });
    } catch (error) {
      console.error('Failed to complete task from notification:', error);
    }
  }

  private async snoozeTaskReminder(taskId: string, minutes: number): Promise<void> {
    try {
      const snoozeTime = new Date(Date.now() + minutes * 60 * 1000);
      await this.scheduleNotification(
        {
          id: `task_snoozed_${taskId}`,
          title: 'Task Reminder (Snoozed)',
          body: 'Your snoozed task reminder',
          data: {
            type: 'task_reminder',
            taskId,
            deepLink: `/tasks/${taskId}`,
          },
          categoryId: 'TASK_REMINDER',
          channelId: 'reminders',
        },
        {
          date: snoozeTime,
        }
      );
    } catch (error) {
      console.error('Failed to snooze task reminder:', error);
    }
  }

  private async acceptTaskFromNotification(taskId: string): Promise<void> {
    try {
      await apiService.updateTask(taskId, { status: 'IN_PROGRESS' });
      await this.sendLocalNotification({
        id: `task_accepted_${taskId}`,
        title: 'Task Accepted',
        body: 'Task has been accepted and is now in progress',
        channelId: 'system',
      });
    } catch (error) {
      console.error('Failed to accept task from notification:', error);
    }
  }

  private async handleDeepLink(deepLink: string): Promise<void> {
    // This would typically be handled by the navigation service
    console.log('Deep link:', deepLink);
  }

  async cleanup(): Promise<void> {
    if (this.notificationListener) {
      this.notificationListener.remove();
    }
    if (this.responseListener) {
      this.responseListener.remove();
    }
    this.isInitialized = false;
  }

  get pushToken(): string | null {
    return this.expoPushToken;
  }
}

export const pushNotificationService = new PushNotificationService();