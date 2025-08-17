import { useCallback, useEffect, useState } from 'react';
import { biometricAuthService, type BiometricCapabilities } from '../services/auth/BiometricAuthService';

export interface BiometricAuthState {
  isAvailable: boolean;
  isEnabled: boolean;
  isLoading: boolean;
  error: string | null;
  capabilities: BiometricCapabilities | null;
  biometricType: string;
}

export const useBiometricAuth = () => {
  const [state, setState] = useState<BiometricAuthState>({
    isAvailable: false,
    isEnabled: false,
    isLoading: true,
    error: null,
    capabilities: null,
    biometricType: 'Biometric Authentication',
  });

  const checkCapabilities = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const [capabilities, isEnabled, biometricType] = await Promise.all([
        biometricAuthService.getCapabilities(),
        biometricAuthService.isBiometricEnabled(),
        biometricAuthService.getBiometricTypeDisplayName(),
      ]);

      setState(prev => ({
        ...prev,
        isAvailable: capabilities.isAvailable,
        isEnabled,
        capabilities,
        biometricType,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to check biometric capabilities',
        isLoading: false,
      }));
    }
  }, []);

  const authenticate = useCallback(async (promptMessage?: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await biometricAuthService.authenticate({
        promptMessage: promptMessage || `Authenticate with ${state.biometricType}`,
      });

      setState(prev => ({ ...prev, isLoading: false }));
      
      if (!result.success && result.error) {
        setState(prev => ({ ...prev, error: result.error! }));
      }
      
      return result.success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      return false;
    }
  }, [state.biometricType]);

  const authenticateWithCredentials = useCallback(async (): Promise<{
    success: boolean;
    credentials?: { username: string; token: string };
  }> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await biometricAuthService.authenticateWithBiometrics();
      
      setState(prev => ({ ...prev, isLoading: false }));
      
      if (!result.success && result.error) {
        setState(prev => ({ ...prev, error: result.error! }));
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      return { success: false };
    }
  }, []);

  const enableBiometric = useCallback(async (username: string, authToken: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const success = await biometricAuthService.enableBiometricAuth(username, authToken);
      
      if (success) {
        setState(prev => ({ ...prev, isEnabled: true }));
      } else {
        setState(prev => ({ ...prev, error: 'Failed to enable biometric authentication' }));
      }
      
      setState(prev => ({ ...prev, isLoading: false }));
      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to enable biometric authentication';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      return false;
    }
  }, []);

  const disableBiometric = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const success = await biometricAuthService.disableBiometricAuth();
      
      if (success) {
        setState(prev => ({ ...prev, isEnabled: false }));
      } else {
        setState(prev => ({ ...prev, error: 'Failed to disable biometric authentication' }));
      }
      
      setState(prev => ({ ...prev, isLoading: false }));
      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to disable biometric authentication';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      return false;
    }
  }, []);

  const quickAuthenticate = useCallback(async (): Promise<boolean> => {
    try {
      return await biometricAuthService.quickAuthenticate();
    } catch (error) {
      console.error('Quick authentication failed:', error);
      return false;
    }
  }, []);

  const validateSetup = useCallback(async () => {
    try {
      const validation = await biometricAuthService.validateBiometricSetup();
      return validation;
    } catch (error) {
      return {
        isValid: false,
        issues: ['Failed to validate biometric setup'],
        recommendations: ['Check device settings'],
      };
    }
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Initialize capabilities on mount
  useEffect(() => {
    checkCapabilities();
  }, [checkCapabilities]);

  return {
    ...state,
    authenticate,
    authenticateWithCredentials,
    enableBiometric,
    disableBiometric,
    quickAuthenticate,
    validateSetup,
    checkCapabilities,
    clearError,
  };
};