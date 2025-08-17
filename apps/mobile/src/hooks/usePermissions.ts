import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';

interface PermissionStatus {
  notifications: boolean;
  camera: boolean;
  mediaLibrary: boolean;
  location: boolean;
}

export const usePermissions = () => {
  const [permissions, setPermissions] = useState<PermissionStatus>({
    notifications: false,
    camera: false,
    mediaLibrary: false,
    location: false,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAllPermissions();
  }, []);

  const checkAllPermissions = async () => {
    try {
      setLoading(true);
      
      const [
        notificationStatus,
        cameraStatus,
        mediaLibraryStatus,
        locationStatus,
      ] = await Promise.all([
        Notifications.getPermissionsAsync(),
        ImagePicker.getCameraPermissionsAsync(),
        ImagePicker.getMediaLibraryPermissionsAsync(),
        Location.getForegroundPermissionsAsync(),
      ]);

      setPermissions({
        notifications: notificationStatus.status === 'granted',
        camera: cameraStatus.status === 'granted',
        mediaLibrary: mediaLibraryStatus.status === 'granted',
        location: locationStatus.status === 'granted',
      });
    } catch (error) {
      console.error('Error checking permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestNotificationPermission = async (): Promise<boolean> => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      const granted = status === 'granted';
      
      setPermissions(prev => ({ ...prev, notifications: granted }));
      return granted;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  const requestCameraPermission = async (): Promise<boolean> => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      const granted = status === 'granted';
      
      setPermissions(prev => ({ ...prev, camera: granted }));
      return granted;
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      return false;
    }
  };

  const requestMediaLibraryPermission = async (): Promise<boolean> => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      const granted = status === 'granted';
      
      setPermissions(prev => ({ ...prev, mediaLibrary: granted }));
      return granted;
    } catch (error) {
      console.error('Error requesting media library permission:', error);
      return false;
    }
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      
      setPermissions(prev => ({ ...prev, location: granted }));
      return granted;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  };

  const requestAllPermissions = async (): Promise<PermissionStatus> => {
    const results = await Promise.all([
      requestNotificationPermission(),
      requestCameraPermission(),
      requestMediaLibraryPermission(),
      requestLocationPermission(),
    ]);

    return {
      notifications: results[0],
      camera: results[1],
      mediaLibrary: results[2],
      location: results[3],
    };
  };

  return {
    permissions,
    loading,
    checkAllPermissions,
    requestNotificationPermission,
    requestCameraPermission,
    requestMediaLibraryPermission,
    requestLocationPermission,
    requestAllPermissions,
  };
};