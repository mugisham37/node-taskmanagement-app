import { CameraResult } from '@types/index';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

export const useCamera = () => {
  const [loading, setLoading] = useState(false);

  const requestPermissions = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  };

  const requestMediaLibraryPermissions = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  };

  const takePhoto = async (): Promise<CameraResult | null> => {
    try {
      setLoading(true);
      
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        throw new Error('Camera permission not granted');
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        return {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          type: 'image',
          fileSize: asset.fileSize,
        };
      }

      return null;
    } catch (error) {
      console.error('Error taking photo:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (): Promise<CameraResult | null> => {
    try {
      setLoading(true);
      
      const hasPermission = await requestMediaLibraryPermissions();
      if (!hasPermission) {
        throw new Error('Media library permission not granted');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        return {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          type: 'image',
          fileSize: asset.fileSize,
        };
      }

      return null;
    } catch (error) {
      console.error('Error picking image:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    takePhoto,
    pickImage,
    requestPermissions,
    requestMediaLibraryPermissions,
  };
};