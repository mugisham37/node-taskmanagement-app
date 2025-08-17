import NetInfo from '@react-native-community/netinfo';
import React, { createContext, ReactNode, useContext, useEffect } from 'react';

import { useAppDispatch } from '@store/hooks';
import { setOnlineStatus as setOfflineOnlineStatus } from '@store/slices/offlineSlice';
import { setOnlineStatus as setUIOnlineStatus } from '@store/slices/uiSlice';

interface NetworkContextType {
  isOnline: boolean;
  connectionType: string | null;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

interface NetworkProviderProps {
  children: ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
  const dispatch = useAppDispatch();
  const [networkState, setNetworkState] = React.useState({
    isOnline: true,
    connectionType: null as string | null,
  });

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener(state => {
      const isOnline = state.isConnected && state.isInternetReachable;
      const connectionType = state.type;

      setNetworkState({
        isOnline: isOnline ?? false,
        connectionType,
      });

      // Update Redux store
      dispatch(setUIOnlineStatus(isOnline ?? false));
      dispatch(setOfflineOnlineStatus(isOnline ?? false));

      // Log network changes in development
      if (__DEV__) {
        console.log('Network state changed:', {
          isConnected: state.isConnected,
          isInternetReachable: state.isInternetReachable,
          type: state.type,
          details: state.details,
        });
      }
    });

    // Get initial network state
    NetInfo.fetch().then(state => {
      const isOnline = state.isConnected && state.isInternetReachable;
      const connectionType = state.type;

      setNetworkState({
        isOnline: isOnline ?? false,
        connectionType,
      });

      dispatch(setUIOnlineStatus(isOnline ?? false));
      dispatch(setOfflineOnlineStatus(isOnline ?? false));
    });

    return () => {
      unsubscribe();
    };
  }, [dispatch]);

  const contextValue: NetworkContextType = {
    isOnline: networkState.isOnline,
    connectionType: networkState.connectionType,
  };

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};