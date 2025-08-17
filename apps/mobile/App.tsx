import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { ErrorBoundary } from '@components/common/ErrorBoundary';
import { LoadingScreen } from '@components/common/LoadingScreen';
import { toastConfig } from '@config/toast';
import { AppNavigator } from '@navigation/AppNavigator';
import { AuthProvider } from '@services/auth/AuthProvider';
import { NetworkProvider } from '@services/network/NetworkProvider';
import { NotificationProvider } from '@services/notifications/NotificationProvider';
import { persistor, store } from '@store/index';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Initialize mobile services first
        await initializeMobileServices();

        // Pre-load fonts, make any API calls you need to do here
        await Font.loadAsync({
          // Add custom fonts here if needed
          'Inter-Regular': require('./src/assets/fonts/Inter-Regular.ttf'),
          'Inter-Medium': require('./src/assets/fonts/Inter-Medium.ttf'),
          'Inter-SemiBold': require('./src/assets/fonts/Inter-SemiBold.ttf'),
          'Inter-Bold': require('./src/assets/fonts/Inter-Bold.ttf'),
        });

        console.log('Mobile app initialization completed successfully');
      } catch (e) {
        console.warn('App initialization error:', e);
      } finally {
        // Tell the application to render
        setIsReady(true);
      }
    }

    prepare();

    // Cleanup services when app is unmounted
    return () => {
      cleanupMobileServices().catch(console.error);
    };
  }, []);

  const onLayoutRootView = React.useCallback(async () => {
    if (isReady) {
      // This tells the splash screen to hide immediately! If we call this after
      // `setIsReady`, then we may see a blank screen while the app is
      // loading its initial state and rendering its first pixels. So instead,
      // we hide the splash screen once we know the root view has already
      // performed layout.
      await SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <SafeAreaProvider>
          <Provider store={store}>
            <PersistGate loading={<LoadingScreen />} persistor={persistor}>
              <NetworkProvider>
                <AuthProvider>
                  <NotificationProvider>
                    <AppNavigator />
                    <StatusBar style="auto" />
                    <Toast config={toastConfig} />
                  </NotificationProvider>
                </AuthProvider>
              </NetworkProvider>
            </PersistGate>
          </Provider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}