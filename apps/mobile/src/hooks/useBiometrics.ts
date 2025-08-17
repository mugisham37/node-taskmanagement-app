import { BiometricAuthResult } from '@types/index';
import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';

export const useBiometrics = () => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [biometryType, setBiometryType] = useState<string | null>(null);

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolledResult = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

      setIsAvailable(hasHardware);
      setIsEnrolled(isEnrolledResult);
      
      if (supportedTypes.length > 0) {
        const type = supportedTypes[0];
        setBiometryType(
          type === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION
            ? 'FaceID'
            : type === LocalAuthentication.AuthenticationType.FINGERPRINT
            ? 'TouchID'
            : 'Biometric'
        );
      }
    } catch (error) {
      console.error('Error checking biometric availability:', error);
    }
  };

  const authenticate = async (
    promptMessage: string = 'Authenticate to continue'
  ): Promise<BiometricAuthResult> => {
    try {
      if (!isAvailable || !isEnrolled) {
        return {
          success: false,
          error: 'Biometric authentication not available',
        };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Password',
      });

      return {
        success: result.success,
        error: result.error,
        biometryType: biometryType as any,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  };

  return {
    isAvailable,
    isEnrolled,
    biometryType,
    authenticate,
    checkBiometricAvailability,
  };
};