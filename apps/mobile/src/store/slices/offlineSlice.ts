import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface OfflineAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  retryCount: number;
}

interface OfflineState {
  isOnline: boolean;
  queue: OfflineAction[];
  syncing: boolean;
  lastSyncTime: number | null;
}

const initialState: OfflineState = {
  isOnline: true,
  queue: [],
  syncing: false,
  lastSyncTime: null,
};

const offlineSlice = createSlice({
  name: 'offline',
  initialState,
  reducers: {
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    addToQueue: (state, action: PayloadAction<Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>>) => {
      const queueItem: OfflineAction = {
        ...action.payload,
        id: `offline-${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        retryCount: 0,
      };
      state.queue.push(queueItem);
    },
    removeFromQueue: (state, action: PayloadAction<string>) => {
      state.queue = state.queue.filter(item => item.id !== action.payload);
    },
    incrementRetryCount: (state, action: PayloadAction<string>) => {
      const item = state.queue.find(item => item.id === action.payload);
      if (item) {
        item.retryCount += 1;
      }
    },
    clearQueue: (state) => {
      state.queue = [];
    },
    setSyncing: (state, action: PayloadAction<boolean>) => {
      state.syncing = action.payload;
    },
    setLastSyncTime: (state, action: PayloadAction<number>) => {
      state.lastSyncTime = action.payload;
    },
  },
});

export const {
  setOnlineStatus,
  addToQueue,
  removeFromQueue,
  incrementRetryCount,
  clearQueue,
  setSyncing,
  setLastSyncTime,
} = offlineSlice.actions;

export default offlineSlice.reducer;