import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  theme: 'light' | 'dark' | 'system';
  isOnline: boolean;
  activeScreen: string;
  isLoading: boolean;
  loadingMessage: string;
  bottomSheetVisible: boolean;
  modalVisible: boolean;
  sidebarVisible: boolean;
  refreshing: boolean;
  keyboardVisible: boolean;
  orientation: 'portrait' | 'landscape';
  safeAreaInsets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

const initialState: UIState = {
  theme: 'system',
  isOnline: true,
  activeScreen: 'Dashboard',
  isLoading: false,
  loadingMessage: '',
  bottomSheetVisible: false,
  modalVisible: false,
  sidebarVisible: false,
  refreshing: false,
  keyboardVisible: false,
  orientation: 'portrait',
  safeAreaInsets: {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;
    },
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    setActiveScreen: (state, action: PayloadAction<string>) => {
      state.activeScreen = action.payload;
    },
    setLoading: (state, action: PayloadAction<{ isLoading: boolean; message?: string }>) => {
      state.isLoading = action.payload.isLoading;
      state.loadingMessage = action.payload.message || '';
    },
    setBottomSheetVisible: (state, action: PayloadAction<boolean>) => {
      state.bottomSheetVisible = action.payload;
    },
    setModalVisible: (state, action: PayloadAction<boolean>) => {
      state.modalVisible = action.payload;
    },
    setSidebarVisible: (state, action: PayloadAction<boolean>) => {
      state.sidebarVisible = action.payload;
    },
    setRefreshing: (state, action: PayloadAction<boolean>) => {
      state.refreshing = action.payload;
    },
    setKeyboardVisible: (state, action: PayloadAction<boolean>) => {
      state.keyboardVisible = action.payload;
    },
    setOrientation: (state, action: PayloadAction<'portrait' | 'landscape'>) => {
      state.orientation = action.payload;
    },
    setSafeAreaInsets: (
      state,
      action: PayloadAction<{
        top: number;
        bottom: number;
        left: number;
        right: number;
      }>
    ) => {
      state.safeAreaInsets = action.payload;
    },
  },
});

export const {
  setTheme,
  setOnlineStatus,
  setActiveScreen,
  setLoading,
  setBottomSheetVisible,
  setModalVisible,
  setSidebarVisible,
  setRefreshing,
  setKeyboardVisible,
  setOrientation,
  setSafeAreaInsets,
} = uiSlice.actions;

export default uiSlice.reducer;