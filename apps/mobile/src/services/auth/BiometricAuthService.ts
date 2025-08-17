import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface BiometricCapabilities {
  isAvailable: boolean;
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
  securityLevel: 'none' | 'biometric' | 'device_credential' | 'both';
}

export interface BiometricAuthOptions {
  promptMessage?: string;
  cancelLabel?: string;
  fallbackLabel?: string;
  disableDeviceFallback?: boolean;
  requireConfirmation?: boolean;
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  warning?: string;
  biometricType?: LocalAuthentication.AuthenticationType;
}

export interface StoredCredentials {
  username: string;
  encryptedToken: string;
  biometricEnabled: boolean;
  lastAuthTime: number;
}

class BiometricAuthService {
  private static readonly CREDENTIALS_KEY = 'biometric_credentials';
  private static readonly SETTINGS_KEY = 'biometric_settings';
  private static readonly AUTH_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  async getCapabilities(): Promise<BiometricCapabilities> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();

      return {
        isAvailable: hasHardware && isEnrolled,
        hasHardware,
        isEnrolled,
        supportedTypes,
        securityLevel: this.mapSecurityLevel(securityLevel),
      };
    } catch (error) {
      console.error('Failed to get biometric capabilities:', error);
      return {
        isAvailable: false,
        hasHardware: false,
        isEnrolled: false,
        supportedTypes: [],
        securityLevel: 'none',
      };
    }
  }

  private mapSecurityLevel(level: LocalAuthentication.SecurityLevel): BiometricCapabilities['securityLevel'] {
    switch (level) {
      case LocalAuthentication.SecurityLevel.NONE:
        return 'none';
      case LocalAuthentication.SecurityLevel.SECRET:
        return 'device_credential';
      case LocalAuthentication.SecurityLevel.BIOMETRIC:
        return 'biometric';
      case LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG:
        return 'biometric';
      default:
        return 'none';
    }
  }

  async authenticate(options: BiometricAuthOptions = {}): Promise<BiometricAuthResult> {
    try {
      const capabilities = await this.getCapabilities();
      
      if (!capabilities.isAvailable) {
        return {
          success: false,
          error: capabilities.hasHardware 
            ? 'No biometric credentials enrolled' 
            : 'Biometric hardware not available',
        };
      }

      const authOptions: LocalAuthentication.LocalAuthenticationOptions = {
        promptMessage: options.promptMessage || 'Authenticate to access your account',
        cancelLabel: options.cancelLabel || 'Cancel',
        fallbackLabel: options.fallbackLabel || 'Use Passcode',
        disableDeviceFallback: options.disableDeviceFallback || false,
        requireConfirmation: options.requireConfirmation,
      };

      const result = await LocalAuthentication.authenticateAsync(authOptions);

      if (result.success) {
        await this.updateLastAuthTime();
        return {
          success: true,
          biometricType: this.getPrimaryBiometricType(capabilities.supportedTypes),
        };
      } else {
        return {
          success: false,
          error: this.mapAuthError(result.error),
          warning: result.warning,
        };
      }
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return {
        success: false,
        error: 'Authentication failed due to an unexpected error',
      };
    }
  }

  private getPrimaryBiometricType(types: LocalAuthentication.AuthenticationType[]): LocalAuthentication.AuthenticationType {
    // Prioritize Face ID/Face Recognition, then Touch ID/Fingerprint
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION;
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return LocalAuthentication.AuthenticationType.FINGERPRINT;
    }
    return types[0] || LocalAuthentication.AuthenticationType.FINGERPRINT;
  }

  private mapAuthError(error?: string): string {
    if (!error) return 'Authentication failed';
    
    // Map common error messages to user-friendly text
    const errorMappings: Record<string, string> = {
      'UserCancel': 'Authentication was cancelled',
      'UserFallback': 'User chose to use device passcode',
      'SystemCancel': 'Authentication was cancelled by the system',
      'PasscodeNotSet': 'Device passcode is not set',
      'BiometryNotAvailable': 'Biometric authentication is not available',
      'BiometryNotEnrolled': 'No biometric credentials are enrolled',
      'BiometryLockout': 'Biometric authentication is locked out',
      'AuthenticationFailed': 'Authentication failed - please try again',
      'InvalidContext': 'Authentication context is invalid',
      'NotInteractive': 'Authentication requires user interaction',
    };

    return errorMappings[error] || `Authentication failed: ${error}`;
  }

  async enableBiometricAuth(username: string, authToken: string): Promise<boolean> {
    try {
      const capabilities = await this.getCapabilities();
      
      if (!capabilities.isAvailable) {
        throw new Error('Biometric authentication is not available');
      }

      // Authenticate first to ensure user consent
      const authResult = await this.authenticate({
        promptMessage: 'Enable biometric authentication for quick access',
        requireConfirmation: true,
      });

      if (!authResult.success) {
        throw new Error(authResult.error || 'Authentication failed');
      }

      // Encrypt and store credentials
      const encryptedToken = await this.encryptToken(authToken);
      const credentials: StoredCredentials = {
        username,
        encryptedToken,
        biometricEnabled: true,
        lastAuthTime: Date.now(),
      };

      await SecureStore.setItemAsync(
        BiometricAuthService.CREDENTIALS_KEY,
        JSON.stringify(credentials),
        {
          requireAuthentication: true,
          authenticationPrompt: 'Authenticate to save your credentials',
        }
      );

      await this.saveBiometricSettings({ enabled: true, username });
      
      return true;
    } catch (error) {
      console.error('Failed to enable biometric auth:', error);
      return false;
    }
  }

  async disableBiometricAuth(): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(BiometricAuthService.CREDENTIALS_KEY);
      await this.saveBiometricSettings({ enabled: false, username: null });
      return true;
    } catch (error) {
      console.error('Failed to disable biometric auth:', error);
      return false;
    }
  }

  async isBiometricEnabled(): Promise<boolean> {
    try {
      const settings = await this.getBiometricSettings();
      return settings.enabled;
    } catch (error) {
      return false;
    }
  }

  async getStoredUsername(): Promise<string | null> {
    try {
      const settings = await this.getBiometricSettings();
      return settings.username;
    } catch (error) {
      return null;
    }
  }

  async authenticateWithBiometrics(): Promise<{
    success: boolean;
    credentials?: { username: string; token: string };
    error?: string;
  }> {
    try {
      const isEnabled = await this.isBiometricEnabled();
      if (!isEnabled) {
        return {
          success: false,
          error: 'Biometric authentication is not enabled',
        };
      }

      // Check if authentication is still valid (within timeout)
      if (await this.isAuthenticationValid()) {
        const credentials = await this.getStoredCredentials();
        if (credentials) {
          return {
            success: true,
            credentials: {
              username: credentials.username,
              token: await this.decryptToken(credentials.encryptedToken),
            },
          };
        }
      }

      // Perform biometric authentication
      const authResult = await this.authenticate({
        promptMessage: 'Authenticate to access your account',
      });

      if (!authResult.success) {
        return {
          success: false,
          error: authResult.error,
        };
      }

      // Retrieve and decrypt stored credentials
      const credentials = await this.getStoredCredentials();
      if (!credentials) {
        return {
          success: false,
          error: 'No stored credentials found',
        };
      }

      const decryptedToken = await this.decryptToken(credentials.encryptedToken);
      
      return {
        success: true,
        credentials: {
          username: credentials.username,
          token: decryptedToken,
        },
      };
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return {
        success: false,
        error: 'Authentication failed due to an unexpected error',
      };
    }
  }

  private async getStoredCredentials(): Promise<StoredCredentials | null> {
    try {
      const credentialsJson = await SecureStore.getItemAsync(
        BiometricAuthService.CREDENTIALS_KEY,
        {
          requireAuthentication: true,
          authenticationPrompt: 'Authenticate to access your credentials',
        }
      );

      if (!credentialsJson) return null;
      
      return JSON.parse(credentialsJson) as StoredCredentials;
    } catch (error) {
      console.error('Failed to get stored credentials:', error);
      return null;
    }
  }

  private async encryptToken(token: string): Promise<string> {
    // In a real implementation, you would use proper encryption
    // For now, we'll use base64 encoding as SecureStore provides encryption
    return Buffer.from(token).toString('base64');
  }

  private async decryptToken(encryptedToken: string): Promise<string> {
    // Corresponding decryption for the above
    return Buffer.from(encryptedToken, 'base64').toString('utf-8');
  }

  private async saveBiometricSettings(settings: { enabled: boolean; username: string | null }): Promise<void> {
    await AsyncStorage.setItem(
      BiometricAuthService.SETTINGS_KEY,
      JSON.stringify(settings)
    );
  }

  private async getBiometricSettings(): Promise<{ enabled: boolean; username: string | null }> {
    try {
      const settingsJson = await AsyncStorage.getItem(BiometricAuthService.SETTINGS_KEY);
      if (!settingsJson) {
        return { enabled: false, username: null };
      }
      return JSON.parse(settingsJson);
    } catch (error) {
      return { enabled: false, username: null };
    }
  }

  private async updateLastAuthTime(): Promise<void> {
    try {
      const credentials = await this.getStoredCredentials();
      if (credentials) {
        credentials.lastAuthTime = Date.now();
        await SecureStore.setItemAsync(
          BiometricAuthService.CREDENTIALS_KEY,
          JSON.stringify(credentials),
          {
            requireAuthentication: true,
            authenticationPrompt: 'Authenticate to update credentials',
          }
        );
      }
    } catch (error) {
      console.error('Failed to update last auth time:', error);
    }
  }

  private async isAuthenticationValid(): Promise<boolean> {
    try {
      const credentials = await this.getStoredCredentials();
      if (!credentials) return false;
      
      const timeSinceAuth = Date.now() - credentials.lastAuthTime;
      return timeSinceAuth < BiometricAuthService.AUTH_TIMEOUT;
    } catch (error) {
      return false;
    }
  }

  async getBiometricTypeDisplayName(): Promise<string> {
    try {
      const capabilities = await this.getCapabilities();
      const primaryType = this.getPrimaryBiometricType(capabilities.supportedTypes);
      
      switch (primaryType) {
        case LocalAuthentication.AuthenticationType.FINGERPRINT:
          return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
        case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
          return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
        case LocalAuthentication.AuthenticationType.IRIS:
          return 'Iris Recognition';
        default:
          return 'Biometric Authentication';
      }
    } catch (error) {
      return 'Biometric Authentication';
    }
  }

  async validateBiometricSetup(): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    try {
      const capabilities = await this.getCapabilities();
      
      if (!capabilities.hasHardware) {
        issues.push('Biometric hardware is not available on this device');
      } else if (!capabilities.isEnrolled) {
        issues.push('No biometric credentials are enrolled');
        recommendations.push('Set up biometric authentication in device settings');
      }
      
      if (capabilities.securityLevel === 'none') {
        issues.push('Device security level is insufficient');
        recommendations.push('Set up a device passcode or pattern');
      }
      
      const isEnabled = await this.isBiometricEnabled();
      if (capabilities.isAvailable && !isEnabled) {
        recommendations.push('Enable biometric authentication for quick access');
      }
      
      return {
        isValid: issues.length === 0,
        issues,
        recommendations,
      };
    } catch (error) {
      return {
        isValid: false,
        issues: ['Failed to validate biometric setup'],
        recommendations: ['Check device biometric settings'],
      };
    }
  }

  async clearStoredData(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(BiometricAuthService.CREDENTIALS_KEY);
      await AsyncStorage.removeItem(BiometricAuthService.SETTINGS_KEY);
    } catch (error) {
      console.error('Failed to clear biometric data:', error);
    }
  }

  // Quick authentication for app unlock scenarios
  async quickAuthenticate(): Promise<boolean> {
    try {
      const capabilities = await this.getCapabilities();
      if (!capabilities.isAvailable) return false;
      
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock app',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      
      return result.success;
    } catch (error) {
      console.error('Quick authentication failed:', error);
      return false;
    }
  }
}

export const biometricAuthService = new BiometricAuthService();