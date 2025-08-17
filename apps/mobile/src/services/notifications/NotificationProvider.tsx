import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import React, { createContext, ReactNode, useContext, useEffect } from 'react';
import { Platform } from 'react-native';

import config from '@config/index';
import { useAppDispatch } from '@store/hooks';
import { addNotification, setPushToken } from '@store/slices/notificationsSlice';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface NotificationContextType {
  requestPermissions: () => Promise<boolean>;
  scheduleLocalNotification: (title: string, body: string, trigger?: Notifications.NotificationTriggerInput) => Promise<string>;
  cancelNotification: (identifier: string) => Promise<void>;
  cancelAllNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    initializeNotifications();
    setupNotificationListeners();
  }, []);

  const initializeNotifications = async () => {
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.warn('Failed to get push token for push notification!');
        return;
      }
      
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      dispatch(setPushToken(token));
      
      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync(config.notifications.channelId, {
          name: config.notifications.channelName,
          description: config.notifications.channelDescription,
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
    } else {
      console.warn('Must use physical device for Push Notifications');
    }
  };

  const setupNotificationListeners = () => {
    // Handle notifications received while app is foregrounded
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      const { title, body, data } = notification.request.content;
      
      dispatch(addNotification({
        id: notification.request.identifier,
        title: title || 'Notification',
        message: body || '',
        type: 'info',
        timestamp: Date.now(),
        read: false,
        data,
      }));
    });

    // Handle user tapping on notifications
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      const { notification } = response;
      const { data } = notification.request.content;
      
      // Handle navigation based on notification data
      if (data?.screen) {
        // Navigate to specific screen
        // This would typically use navigation service
        console.log('Navigate to:', data.screen);
      }
    });

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  };

  const requestPermissions = async (): Promise<boolean> => {
    if (!Device.isDevice) {
      return false;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  };

  const scheduleLocalNotification = async (
    title: string,
    body: string,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string> => {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
      },
      trigger: trigger || null,
    });

    return identifier;
  };

  const cancelNotification = async (identifier: string): Promise<void> => {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  };

  const cancelAllNotifications = async (): Promise<void> => {
    await Notifications.cancelAllScheduledNotificationsAsync();
  };

  const contextValue: NotificationContextType = {
    requestPermissions,
    scheduleLocalNotification,
    cancelNotification,
    cancelAllNotifications,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};