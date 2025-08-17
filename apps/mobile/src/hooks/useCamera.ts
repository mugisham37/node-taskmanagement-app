import { useCallback, useState } from 'react';
import { cameraService, type CameraOptions, type DocumentScanResult, type ImageResult } from '../services/camera/CameraService';

export interface CameraState {
  isLoading: boolean;
  error: string | null;
  hasPermissions: boolean;
  lastImage: ImageResult | null;
  lastDocument: DocumentScanResult | null;
}

export const useCamera = () => {
  const [state, setState] = useState<CameraState>({
    isLoading: false,
    error: null,
    hasPermissions: false,
    lastImage: null,
    lastDocument: null,
  });

  const checkPermissions = useCallback(async () => {
    try {
      const permissions = await cameraService.checkPermissions();
      setState(prev => ({ 
        ...prev, 
        hasPermissions: permissions.camera && permissions.mediaLibrary 
      }));
      return permissions;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to check permissions' 
      }));
      return { camera: false, mediaLibrary: false };
    }
  }, []);

  const requestPermissions = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const permissions = await cameraService.requestPermissions();
      setState(prev => ({ 
        ...prev, 
        hasPermissions: permissions.camera && permissions.mediaLibrary,
        isLoading: false 
      }));
      return permissions;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to request permissions',
        isLoading: false,
      }));
      return { camera: false, mediaLibrary: false };
    }
  }, []);

  const takePhoto = useCallback(async (options?: CameraOptions): Promise<ImageResult | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await cameraService.takePhoto(options);
      setState(prev => ({ 
        ...prev, 
        lastImage: result,
        isLoading: false 
      }));
      return result;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to take photo',
        isLoading: false,
      }));
      return null;
    }
  }, []);

  const pickImage = useCallback(async (options?: CameraOptions): Promise<ImageResult | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await cameraService.pickImageFromLibrary(options);
      setState(prev => ({ 
        ...prev, 
        lastImage: result,
        isLoading: false 
      }));
      return result;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to pick image',
        isLoading: false,
      }));
      return null;
    }
  }, []);

  const pickMultipleImages = useCallback(async (options?: CameraOptions): Promise<ImageResult[]> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const results = await cameraService.pickMultipleImages(options);
      setState(prev => ({ 
        ...prev, 
        lastImage: results.length > 0 ? results[0] : null,
        isLoading: false 
      }));
      return results;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to pick images',
        isLoading: false,
      }));
      return [];
    }
  }, []);

  const scanDocument = useCallback(async (): Promise<DocumentScanResult | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await cameraService.scanDocument();
      setState(prev => ({ 
        ...prev, 
        lastDocument: result,
        isLoading: false 
      }));
      return result;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to scan document',
        isLoading: false,
      }));
      return null;
    }
  }, []);

  const scanMultiplePages = useCallback(async (): Promise<DocumentScanResult | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await cameraService.scanMultiplePages();
      setState(prev => ({ 
        ...prev, 
        lastDocument: result,
        isLoading: false 
      }));
      return result;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to scan multiple pages',
        isLoading: false,
      }));
      return null;
    }
  }, []);

  const compressImage = useCallback(async (
    imageUri: string, 
    options?: { quality?: number; maxWidth?: number; maxHeight?: number }
  ): Promise<ImageResult | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await cameraService.compressImage(imageUri, options);
      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to compress image',
        isLoading: false,
      }));
      return null;
    }
  }, []);

  const resizeImage = useCallback(async (
    imageUri: string,
    width: number,
    height: number,
    quality?: number
  ): Promise<ImageResult | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await cameraService.resizeImage(imageUri, width, height, quality);
      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to resize image',
        isLoading: false,
      }));
      return null;
    }
  }, []);

  const cropImage = useCallback(async (
    imageUri: string,
    cropData: { originX: number; originY: number; width: number; height: number }
  ): Promise<ImageResult | null> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await cameraService.cropImage(imageUri, cropData);
      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to crop image',
        isLoading: false,
      }));
      return null;
    }
  }, []);

  const saveToGallery = useCallback(async (imageUri: string, albumName?: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const success = await cameraService.saveToGallery(imageUri, albumName);
      setState(prev => ({ ...prev, isLoading: false }));
      
      if (!success) {
        setState(prev => ({ ...prev, error: 'Failed to save image to gallery' }));
      }
      
      return success;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to save to gallery',
        isLoading: false,
      }));
      return false;
    }
  }, []);

  const createThumbnail = useCallback(async (imageUri: string, size?: number): Promise<ImageResult | null> => {
    try {
      return await cameraService.createThumbnail(imageUri, size);
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to create thumbnail',
      }));
      return null;
    }
  }, []);

  const getStorageUsage = useCallback(async () => {
    try {
      return await cameraService.getStorageUsage();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to get storage usage',
      }));
      return { tempSize: 0, processedSize: 0, totalSize: 0 };
    }
  }, []);

  const cleanupTempFiles = useCallback(async () => {
    try {
      await cameraService.cleanupTempFiles();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to cleanup temp files',
      }));
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const clearLastResults = useCallback(() => {
    setState(prev => ({ ...prev, lastImage: null, lastDocument: null }));
  }, []);

  return {
    ...state,
    checkPermissions,
    requestPermissions,
    takePhoto,
    pickImage,
    pickMultipleImages,
    scanDocument,
    scanMultiplePages,
    compressImage,
    resizeImage,
    cropImage,
    saveToGallery,
    createThumbnail,
    getStorageUsage,
    cleanupTempFiles,
    clearError,
    clearLastResults,
  };
};