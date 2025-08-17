import { Dimensions, Platform, StatusBar } from 'react-native';
import DeviceInfo from 'react-native-device-info';

export interface PlatformInfo {
  isIOS: boolean;
  isAndroid: boolean;
  version: number;
  isTablet: boolean;
  hasNotch: boolean;
  statusBarHeight: number;
  screenWidth: number;
  screenHeight: number;
  isLandscape: boolean;
}

class PlatformManager {
  private static instance: PlatformManager;
  private platformInfo: PlatformInfo;

  private constructor() {
    this.platformInfo = this.initializePlatformInfo();
  }

  public static getInstance(): PlatformManager {
    if (!PlatformManager.instance) {
      PlatformManager.instance = new PlatformManager();
    }
    return PlatformManager.instance;
  }

  private initializePlatformInfo(): PlatformInfo {
    const { width, height } = Dimensions.get('window');
    const isLandscape = width > height;
    
    return {
      isIOS: Platform.OS === 'ios',
      isAndroid: Platform.OS === 'android',
      version: Platform.Version as number,
      isTablet: DeviceInfo.isTablet(),
      hasNotch: this.checkHasNotch(),
      statusBarHeight: StatusBar.currentHeight || 0,
      screenWidth: width,
      screenHeight: height,
      isLandscape,
    };
  }

  private checkHasNotch(): boolean {
    if (Platform.OS === 'ios') {
      const { height, width } = Dimensions.get('window');
      const screenHeight = Math.max(height, width);
      
      // iPhone X and newer have notches
      return screenHeight >= 812;
    }
    
    // Android devices with notches
    if (Platform.OS === 'android') {
      return (StatusBar.currentHeight || 0) > 24;
    }
    
    return false;
  }

  public getPlatformInfo(): PlatformInfo {
    return this.platformInfo;
  }

  public updateDimensions(): void {
    const { width, height } = Dimensions.get('window');
    this.platformInfo.screenWidth = width;
    this.platformInfo.screenHeight = height;
    this.platformInfo.isLandscape = width > height;
  }

  public getOptimalImageSize(baseSize: number): number {
    const { screenWidth, isTablet } = this.platformInfo;
    
    if (isTablet) {
      return baseSize * 1.5;
    }
    
    if (screenWidth > 400) {
      return baseSize * 1.2;
    }
    
    return baseSize;
  }

  public getOptimalFontSize(baseSize: number): number {
    const { screenWidth, isTablet } = this.platformInfo;
    
    if (isTablet) {
      return baseSize * 1.1;
    }
    
    if (screenWidth < 350) {
      return baseSize * 0.9;
    }
    
    return baseSize;
  }

  public getSafeAreaInsets() {
    const { isIOS, hasNotch, statusBarHeight } = this.platformInfo;
    
    return {
      top: isIOS && hasNotch ? 44 : statusBarHeight,
      bottom: isIOS && hasNotch ? 34 : 0,
      left: 0,
      right: 0,
    };
  }

  public getHapticFeedbackType(): 'light' | 'medium' | 'heavy' | 'selection' {
    return this.platformInfo.isIOS ? 'light' : 'selection';
  }

  public shouldUseNativeDriver(): boolean {
    // Use native driver for better performance on both platforms
    return true;
  }

  public getAnimationDuration(baseDuration: number): number {
    const { isAndroid, version } = this.platformInfo;
    
    // Older Android versions might need longer animations
    if (isAndroid && version < 23) {
      return baseDuration * 1.2;
    }
    
    return baseDuration;
  }
}

// Export singleton instance
export const platformManager = PlatformManager.getInstance();

// Utility functions
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

export const getScreenDimensions = () => {
  return Dimensions.get('window');
};

export const isTablet = () => {
  return DeviceInfo.isTablet();
};

export const hasNotch = () => {
  return platformManager.getPlatformInfo().hasNotch;
};

export const getSafeAreaInsets = () => {
  return platformManager.getSafeAreaInsets();
};

export const getOptimalTouchableSize = (baseSize: number) => {
  // Minimum touch target size should be 44pt on iOS and 48dp on Android
  const minSize = isIOS ? 44 : 48;
  return Math.max(baseSize, minSize);
};

export const getStatusBarHeight = () => {
  return StatusBar.currentHeight || 0;
};

// Platform-specific styles
export const platformStyles = {
  shadow: isIOS
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      }
    : {
        elevation: 4,
      },
  
  borderRadius: isIOS ? 8 : 4,
  
  headerHeight: isIOS ? 44 : 56,
  
  tabBarHeight: isIOS ? 49 : 56,
  
  buttonHeight: isIOS ? 44 : 48,
  
  inputHeight: isIOS ? 44 : 48,
};