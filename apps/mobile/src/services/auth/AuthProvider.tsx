import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, ReactNode, useContext, useEffect } from 'react';

import config from '@config/index';
import { useAppDispatch, useAppSelector } from '@store/hooks';
import { setBiometricEnabled } from '@store/slices/authSlice';

interface AuthContextType {
  authenticateWithBiometrics: () => Promise<boolean>;
  enableBiometrics: () => Promise<boolean>;
  disableBiometrics: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, biometricEnabled } = useAppSelector((state) => state.auth);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      // Check for stored tokens
      const token = await SecureStore.getItemAsync(config.auth.tokenStorageKey);
      const refreshToken = await SecureStore.getItemAsync(config.auth.refreshTokenStorageKey);
      
      if (token && refreshToken) {
        // Validate token and restore session
        // This would typically involve calling an API to validate the token
        // For now, we'll assume the token is valid
        
        // Get user data from token or API
        // const userData = await getUserFromToken(token);
        
        // dispatch(loginSuccess({
        //   user: userData,
        //   token,
        //   refreshToken,
        //   expiresIn: 3600, // This should come from token validation
        // }));
      }

      // Check biometric availability and settings
      const biometricSupported = await LocalAuthentication.hasHardwareAsync();
      const biometricEnrolled = await LocalAuthentication.isEnrolledAsync();
      const biometricSetting = await SecureStore.getItemAsync(config.auth.biometricStorageKey);
      
      if (biometricSupported && biometricEnrolled && biometricSetting === 'true') {
        dispatch(setBiometricEnabled(true));
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    }
  };

  const authenticateWithBiometrics = async (): Promise<boolean> => {
    try {
      const biometricSupported = await LocalAuthentication.hasHardwareAsync();
      const biometricEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (!biometricSupported || !biometricEnrolled) {
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access your account',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Password',
      });

      return result.success;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  };

  const enableBiometrics = async (): Promise<boolean> => {
    try {
      const biometricSupported = await LocalAuthentication.hasHardwareAsync();
      const biometricEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (!biometricSupported || !biometricEnrolled) {
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric authentication',
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        await SecureStore.setItemAsync(config.auth.biometricStorageKey, 'true');
        dispatch(setBiometricEnabled(true));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to enable biometrics:', error);
      return false;
    }
  };

  const disableBiometrics = async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(config.auth.biometricStorageKey);
      dispatch(setBiometricEnabled(false));
    } catch (error) {
      console.error('Failed to disable biometrics:', error);
    }
  };

  const contextValue: AuthContextType = {
    authenticateWithBiometrics,
    enableBiometrics,
    disableBiometrics,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};