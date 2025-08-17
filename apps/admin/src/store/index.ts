import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { persistReducer, persistStore } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

// Import slices
import alertsSlice from './slices/alertsSlice';
import analyticsSlice from './slices/analyticsSlice';
import auditSlice from './slices/auditSlice';
import authSlice from './slices/authSlice';
import monitoringSlice from './slices/monitoringSlice';
import settingsSlice from './slices/settingsSlice';
import uiSlice from './slices/uiSlice';
import usersSlice from './slices/usersSlice';

// Persist configuration
const persistConfig = {
  key: 'admin-root',
  storage,
  whitelist: ['auth', 'ui', 'settings'], // Only persist these slices
};

const rootReducer = {
  auth: authSlice,
  ui: uiSlice,
  users: usersSlice,
  monitoring: monitoringSlice,
  analytics: analyticsSlice,
  alerts: alertsSlice,
  settings: settingsSlice,
  audit: auditSlice,
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;