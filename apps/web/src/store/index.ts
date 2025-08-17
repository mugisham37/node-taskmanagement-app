import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import { persistReducer, persistStore } from 'redux-persist'
import storage from 'redux-persist/lib/storage'

// Import slices
import authSlice from './slices/authSlice'
import notificationsSlice from './slices/notificationsSlice'
import projectsSlice from './slices/projectsSlice'
import tasksSlice from './slices/tasksSlice'
import uiSlice from './slices/uiSlice'

// Persist configuration
const persistConfig = {
  key: 'taskmanagement-web',
  version: 1,
  storage,
  whitelist: ['auth', 'ui'], // Only persist auth and ui state
  blacklist: ['tasks', 'projects', 'notifications'], // Don't persist server data
}

// Root reducer
const rootReducer = combineReducers({
  auth: authSlice,
  ui: uiSlice,
  tasks: tasksSlice,
  projects: projectsSlice,
  notifications: notificationsSlice,
})

// Persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer)

// Store configuration
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        ignoredPaths: ['register'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
})

// Setup listeners for RTK Query
setupListeners(store.dispatch)

// Create persistor
export const persistor = persistStore(store)

// Types
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Typed hooks
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'

export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector

// Action creators
export * from './slices/authSlice'
export * from './slices/notificationsSlice'
export * from './slices/projectsSlice'
export * from './slices/tasksSlice'
export * from './slices/uiSlice'
