import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface OfflineAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

interface OfflineState {
  isOnline: boolean;
  queue: OfflineAction[];
  syncing: boolean;
  lastSyncTime: number | null;
  syncErrors: string[];
}

const initialState: OfflineState = {
  isOnline: true,
  queue: [],
  syncing: false,
  lastSyncTime: null,
  syncErrors: [],
};

const offlineSlice = createSlice({
  name: 'offline',
  initialState,
  reducers: {
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    addToQueue: (state, action: PayloadAction<Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>>) => {
      const offlineAction: OfflineAction = {
        ...action.payload,
        id: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        retryCount: 0,
      };
      state.queue.push(offlineAction);
    },
    removeFromQueue: (state, action: PayloadAction<string>) => {
      state.queue = state.queue.filter(action => action.id !== action.payload);
    },
    incrementRetryCount: (state, action: PayloadAction<string>) => {
      const actionItem = state.queue.find(item => item.id === action.payload);
      if (actionItem) {
        actionItem.retryCount += 1;
      }
    },
    setSyncing: (state, action: PayloadAction<boolean>) => {
      state.syncing = action.payload;
    },
    setSyncTime: (state, action: PayloadAction<number>) => {
      state.lastSyncTime = action.payload;
    },
    addSyncError: (state, action: PayloadAction<string>) => {
      state.syncErrors.push(action.payload);
    },
    clearSyncErrors: (state) => {
      state.syncErrors = [];
    },
    clearQueue: (state) => {
      state.queue = [];
    },
  },
});

export const {
  setOnlineStatus,
  addToQueue,
  removeFromQueue,
  incrementRetryCount,
  setSyncing,
  setSyncTime,
  addSyncError,
  clearSyncErrors,
  clearQueue,
} = offlineSlice.actions;

export default offlineSlice.reducer;