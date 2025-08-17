import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

// Import slices
import alertsSlice from './slices/alertsSlice';
import analyticsSlice from './slices/analyticsSlice';
import auditSlice from './slices/auditSlice';
import authSlice from './slices/authSlice';
import monitoringSlice from './slices/monitoringSlice';
import settingsSlice from './slices/settingsSlice';
import uiSlice from './slices/uiSlice';
import usersSlice from './slices/usersSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice,
    ui: uiSlice,
    users: usersSlice,
    monitoring: monitoringSlice,
    analytics: analyticsSlice,
    alerts: alertsSlice,
    settings: settingsSlice,
    audit: auditSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [],
      },
    }),
  devTools: typeof window !== 'undefined' && process.env.NODE_ENV !== 'production',
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;