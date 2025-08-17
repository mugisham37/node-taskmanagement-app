import { useAppSelector } from '@store/hooks';

export const useNetworkStatus = () => {
  const isOnline = useAppSelector((state) => state.ui.isOnline);
  
  return {
    isOnline,
    isOffline: !isOnline,
  };
};