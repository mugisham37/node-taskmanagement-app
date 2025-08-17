import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

export interface CameraOptions {
  mediaTypes?: ImagePicker.MediaTypeOptions;
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
  base64?: boolean;
  exif?: boolean;
}

export interface ImageResult {
  uri: string;
  width: number;
  height: number;
  type?: string;
  fileSize?: number;
  base64?: string;
  exif?: Record<string, any>;
}

export interface DocumentScanResult {
  uri: string;
  pages: DocumentPage[];
  totalPages: number;
}

export interface DocumentPage {
  uri: string;
  width: number;
  height: number;
  processed: boolean;
}

export interface FileUploadResult {
  success: boolean;
  fileId?: string;
  url?: string;
  error?: string;
}

export interface CompressionOptions {
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  format?: SaveFormat;
}

class CameraService {
  private static readonly TEMP_DIR = `${FileSystem.documentDirectory}temp/`;
  private static readonly PROCESSED_DIR = `${FileSystem.documentDirectory}processed/`;

  async initialize(): Promise<void> {
    try {
      // Create temp directories
      await this.ensureDirectoryExists(CameraService.TEMP_DIR);
      await this.ensureDirectoryExists(CameraService.PROCESSED_DIR);
      
      console.log('Camera service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize camera service:', error);
      throw error;
    }
  }

  private async ensureDirectoryExists(directory: string): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(directory);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    }
  }

  async requestPermissions(): Promise<{
    camera: boolean;
    mediaLibrary: boolean;
    microphone?: boolean;
  }> {
    try {
      const [cameraResult, mediaLibraryResult] = await Promise.all([
        ImagePicker.requestCameraPermissionsAsync(),
        MediaLibrary.requestPermissionsAsync(),
      ]);

      return {
        camera: cameraResult.status === 'granted',
        mediaLibrary: mediaLibraryResult.status === 'granted',
      };
    } catch (error) {
      console.error('Failed to request permissions:', error);
      return {
        camera: false,
        mediaLibrary: false,
      };
    }
  }

  async checkPermissions(): Promise<{
    camera: boolean;
    mediaLibrary: boolean;
  }> {
    try {
      const [cameraResult, mediaLibraryResult] = await Promise.all([
        ImagePicker.getCameraPermissionsAsync(),
        MediaLibrary.getPermissionsAsync(),
      ]);

      return {
        camera: cameraResult.status === 'granted',
        mediaLibrary: mediaLibraryResult.status === 'granted',
      };
    } catch (error) {
      console.error('Failed to check permissions:', error);
      return {
        camera: false,
        mediaLibrary: false,
      };
    }
  }

  async takePhoto(options: CameraOptions = {}): Promise<ImageResult | null> {
    try {
      const permissions = await this.checkPermissions();
      if (!permissions.camera) {
        const requested = await this.requestPermissions();
        if (!requested.camera) {
          throw new Error('Camera permission is required');
        }
      }

      const defaultOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: options.mediaTypes || ImagePicker.MediaTypeOptions.Images,
        allowsEditing: options.allowsEditing ?? true,
        aspect: options.aspect || [4, 3],
        quality: options.quality ?? 0.8,
        base64: options.base64 ?? false,
        exif: options.exif ?? false,
      };

      const result = await ImagePicker.launchCameraAsync(defaultOptions);

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: asset.type,
        fileSize: asset.fileSize,
        base64: asset.base64,
        exif: asset.exif,
      };
    } catch (error) {
      console.error('Failed to take photo:', error);
      throw error;
    }
  }

  async pickImageFromLibrary(options: CameraOptions = {}): Promise<ImageResult | null> {
    try {
      const permissions = await this.checkPermissions();
      if (!permissions.mediaLibrary) {
        const requested = await this.requestPermissions();
        if (!requested.mediaLibrary) {
          throw new Error('Media library permission is required');
        }
      }

      const defaultOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: options.mediaTypes || ImagePicker.MediaTypeOptions.Images,
        allowsEditing: options.allowsEditing ?? true,
        aspect: options.aspect || [4, 3],
        quality: options.quality ?? 0.8,
        base64: options.base64 ?? false,
        exif: options.exif ?? false,
      };

      const result = await ImagePicker.launchImageLibraryAsync(defaultOptions);

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: asset.type,
        fileSize: asset.fileSize,
        base64: asset.base64,
        exif: asset.exif,
      };
    } catch (error) {
      console.error('Failed to pick image from library:', error);
      throw error;
    }
  }

  async pickMultipleImages(options: CameraOptions = {}): Promise<ImageResult[]> {
    try {
      const permissions = await this.checkPermissions();
      if (!permissions.mediaLibrary) {
        const requested = await this.requestPermissions();
        if (!requested.mediaLibrary) {
          throw new Error('Media library permission is required');
        }
      }

      const defaultOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes: options.mediaTypes || ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Disable editing for multiple selection
        quality: options.quality ?? 0.8,
        base64: options.base64 ?? false,
        exif: options.exif ?? false,
        allowsMultipleSelection: true,
      };

      const result = await ImagePicker.launchImageLibraryAsync(defaultOptions);

      if (result.canceled || !result.assets) {
        return [];
      }

      return result.assets.map(asset => ({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        type: asset.type,
        fileSize: asset.fileSize,
        base64: asset.base64,
        exif: asset.exif,
      }));
    } catch (error) {
      console.error('Failed to pick multiple images:', error);
      throw error;
    }
  }

  async pickDocument(): Promise<{
    uri: string;
    name: string;
    size: number;
    mimeType: string;
  } | null> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      return {
        uri: asset.uri,
        name: asset.name,
        size: asset.size || 0,
        mimeType: asset.mimeType || 'application/octet-stream',
      };
    } catch (error) {
      console.error('Failed to pick document:', error);
      throw error;
    }
  }

  async compressImage(
    imageUri: string,
    options: CompressionOptions = {}
  ): Promise<ImageResult> {
    try {
      const defaultOptions = {
        quality: options.quality ?? 0.7,
        maxWidth: options.maxWidth ?? 1920,
        maxHeight: options.maxHeight ?? 1080,
        format: options.format ?? SaveFormat.JPEG,
      };

      // Get original image info
      const originalInfo = await FileSystem.getInfoAsync(imageUri);
      
      const manipulateOptions: any[] = [];
      
      // Add resize if needed
      if (defaultOptions.maxWidth || defaultOptions.maxHeight) {
        manipulateOptions.push({
          resize: {
            width: defaultOptions.maxWidth,
            height: defaultOptions.maxHeight,
          },
        });
      }

      const result = await manipulateAsync(
        imageUri,
        manipulateOptions,
        {
          compress: defaultOptions.quality,
          format: defaultOptions.format,
        }
      );

      // Get compressed file info
      const compressedInfo = await FileSystem.getInfoAsync(result.uri);

      return {
        uri: result.uri,
        width: result.width,
        height: result.height,
        fileSize: compressedInfo.size,
      };
    } catch (error) {
      console.error('Failed to compress image:', error);
      throw error;
    }
  }

  async resizeImage(
    imageUri: string,
    width: number,
    height: number,
    quality: number = 0.8
  ): Promise<ImageResult> {
    try {
      const result = await manipulateAsync(
        imageUri,
        [{ resize: { width, height } }],
        {
          compress: quality,
          format: SaveFormat.JPEG,
        }
      );

      const fileInfo = await FileSystem.getInfoAsync(result.uri);

      return {
        uri: result.uri,
        width: result.width,
        height: result.height,
        fileSize: fileInfo.size,
      };
    } catch (error) {
      console.error('Failed to resize image:', error);
      throw error;
    }
  }

  async cropImage(
    imageUri: string,
    cropData: {
      originX: number;
      originY: number;
      width: number;
      height: number;
    }
  ): Promise<ImageResult> {
    try {
      const result = await manipulateAsync(
        imageUri,
        [{ crop: cropData }],
        {
          compress: 0.8,
          format: SaveFormat.JPEG,
        }
      );

      const fileInfo = await FileSystem.getInfoAsync(result.uri);

      return {
        uri: result.uri,
        width: result.width,
        height: result.height,
        fileSize: fileInfo.size,
      };
    } catch (error) {
      console.error('Failed to crop image:', error);
      throw error;
    }
  }

  async rotateImage(imageUri: string, degrees: number): Promise<ImageResult> {
    try {
      const result = await manipulateAsync(
        imageUri,
        [{ rotate: degrees }],
        {
          compress: 0.8,
          format: SaveFormat.JPEG,
        }
      );

      const fileInfo = await FileSystem.getInfoAsync(result.uri);

      return {
        uri: result.uri,
        width: result.width,
        height: result.height,
        fileSize: fileInfo.size,
      };
    } catch (error) {
      console.error('Failed to rotate image:', error);
      throw error;
    }
  }

  async enhanceDocumentImage(imageUri: string): Promise<ImageResult> {
    try {
      // Apply document enhancement filters
      const result = await manipulateAsync(
        imageUri,
        [
          // Increase contrast for better text readability
          { contrast: 1.2 },
          // Adjust brightness
          { brightness: 0.1 },
          // Sharpen the image
          { sharpen: 0.5 },
        ],
        {
          compress: 0.9,
          format: SaveFormat.JPEG,
        }
      );

      const fileInfo = await FileSystem.getInfoAsync(result.uri);

      return {
        uri: result.uri,
        width: result.width,
        height: result.height,
        fileSize: fileInfo.size,
      };
    } catch (error) {
      console.error('Failed to enhance document image:', error);
      throw error;
    }
  }

  async scanDocument(): Promise<DocumentScanResult | null> {
    try {
      // Take photo for document scanning
      const photo = await this.takePhoto({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1.0,
      });

      if (!photo) return null;

      // Process the image for document scanning
      const processedImage = await this.enhanceDocumentImage(photo.uri);

      // Create document scan result
      const scanResult: DocumentScanResult = {
        uri: processedImage.uri,
        pages: [
          {
            uri: processedImage.uri,
            width: processedImage.width,
            height: processedImage.height,
            processed: true,
          },
        ],
        totalPages: 1,
      };

      return scanResult;
    } catch (error) {
      console.error('Failed to scan document:', error);
      throw error;
    }
  }

  async scanMultiplePages(): Promise<DocumentScanResult | null> {
    try {
      const pages: DocumentPage[] = [];
      let continueScan = true;

      while (continueScan) {
        const photo = await this.takePhoto({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 1.0,
        });

        if (!photo) break;

        const processedImage = await this.enhanceDocumentImage(photo.uri);
        pages.push({
          uri: processedImage.uri,
          width: processedImage.width,
          height: processedImage.height,
          processed: true,
        });

        // In a real implementation, you would show a dialog asking if the user wants to scan another page
        continueScan = false; // For now, just scan one page
      }

      if (pages.length === 0) return null;

      return {
        uri: pages[0].uri, // Main document URI
        pages,
        totalPages: pages.length,
      };
    } catch (error) {
      console.error('Failed to scan multiple pages:', error);
      throw error;
    }
  }

  async saveToGallery(imageUri: string, albumName?: string): Promise<boolean> {
    try {
      const permissions = await this.checkPermissions();
      if (!permissions.mediaLibrary) {
        const requested = await this.requestPermissions();
        if (!requested.mediaLibrary) {
          throw new Error('Media library permission is required');
        }
      }

      const asset = await MediaLibrary.createAssetAsync(imageUri);
      
      if (albumName) {
        let album = await MediaLibrary.getAlbumAsync(albumName);
        if (!album) {
          album = await MediaLibrary.createAlbumAsync(albumName, asset, false);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to save to gallery:', error);
      return false;
    }
  }

  async getImageMetadata(imageUri: string): Promise<{
    width: number;
    height: number;
    fileSize: number;
    mimeType?: string;
    exif?: Record<string, any>;
  }> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      
      // For more detailed metadata, you would need to use a library like expo-image-metadata
      return {
        width: 0, // Would be extracted from metadata
        height: 0, // Would be extracted from metadata
        fileSize: fileInfo.size || 0,
        mimeType: this.getMimeTypeFromUri(imageUri),
      };
    } catch (error) {
      console.error('Failed to get image metadata:', error);
      throw error;
    }
  }

  private getMimeTypeFromUri(uri: string): string {
    const extension = uri.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',
      tiff: 'image/tiff',
    };
    return mimeTypes[extension || ''] || 'image/jpeg';
  }

  async createThumbnail(
    imageUri: string,
    size: number = 200
  ): Promise<ImageResult> {
    try {
      const result = await manipulateAsync(
        imageUri,
        [{ resize: { width: size, height: size } }],
        {
          compress: 0.7,
          format: SaveFormat.JPEG,
        }
      );

      const fileInfo = await FileSystem.getInfoAsync(result.uri);

      return {
        uri: result.uri,
        width: result.width,
        height: result.height,
        fileSize: fileInfo.size,
      };
    } catch (error) {
      console.error('Failed to create thumbnail:', error);
      throw error;
    }
  }

  async cleanupTempFiles(): Promise<void> {
    try {
      const tempDir = await FileSystem.readDirectoryAsync(CameraService.TEMP_DIR);
      const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

      for (const file of tempDir) {
        const filePath = `${CameraService.TEMP_DIR}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        
        if (fileInfo.exists && fileInfo.modificationTime && fileInfo.modificationTime < cutoffTime) {
          await FileSystem.deleteAsync(filePath);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
    }
  }

  async getStorageUsage(): Promise<{
    tempSize: number;
    processedSize: number;
    totalSize: number;
  }> {
    try {
      const [tempFiles, processedFiles] = await Promise.all([
        FileSystem.readDirectoryAsync(CameraService.TEMP_DIR),
        FileSystem.readDirectoryAsync(CameraService.PROCESSED_DIR),
      ]);

      let tempSize = 0;
      let processedSize = 0;

      for (const file of tempFiles) {
        const fileInfo = await FileSystem.getInfoAsync(`${CameraService.TEMP_DIR}${file}`);
        tempSize += fileInfo.size || 0;
      }

      for (const file of processedFiles) {
        const fileInfo = await FileSystem.getInfoAsync(`${CameraService.PROCESSED_DIR}${file}`);
        processedSize += fileInfo.size || 0;
      }

      return {
        tempSize,
        processedSize,
        totalSize: tempSize + processedSize,
      };
    } catch (error) {
      console.error('Failed to get storage usage:', error);
      return { tempSize: 0, processedSize: 0, totalSize: 0 };
    }
  }

  // QR Code scanning (would require expo-barcode-scanner)
  async scanQRCode(): Promise<{ data: string; type: string } | null> {
    try {
      // This would use expo-barcode-scanner
      // For now, return null as placeholder
      console.log('QR Code scanning not implemented yet');
      return null;
    } catch (error) {
      console.error('Failed to scan QR code:', error);
      return null;
    }
  }
}

export const cameraService = new CameraService();