import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SystemSettings {
  siteName: string;
  siteDescription: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  emailVerificationRequired: boolean;
  maxFileUploadSize: number;
  sessionTimeout: number;
  maxLoginAttempts: number;
  passwordMinLength: number;
  backupRetentionDays: number;
  logRetentionDays: number;
}

interface SettingsState {
  systemSettings: SystemSettings | null;
  isLoading: boolean;
  error: string | null;
  isDirty: boolean;
}

const initialState: SettingsState = {
  systemSettings: null,
  isLoading: false,
  error: null,
  isDirty: false,
};

// Async thunks
export const fetchSystemSettings = createAsyncThunk(
  'settings/fetchSystemSettings',
  async () => {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const mockSettings: SystemSettings = {
      siteName: 'TaskManagement Admin',
      siteDescription: 'Comprehensive task management system administration',
      maintenanceMode: false,
      registrationEnabled: true,
      emailVerificationRequired: true,
      maxFileUploadSize: 10,
      sessionTimeout: 60,
      maxLoginAttempts: 5,
      passwordMinLength: 8,
      backupRetentionDays: 30,
      logRetentionDays: 7,
    };

    return mockSettings;
  }
);

export const updateSystemSettings = createAsyncThunk(
  'settings/updateSystemSettings',
  async (settings: SystemSettings) => {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    return settings;
  }
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    updateSettingsLocally: (state, action: PayloadAction<Partial<SystemSettings>>) => {
      if (state.systemSettings) {
        state.systemSettings = { ...state.systemSettings, ...action.payload };
        state.isDirty = true;
      }
    },
    resetSettings: (state) => {
      state.isDirty = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch system settings
      .addCase(fetchSystemSettings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSystemSettings.fulfilled, (state, action) => {
        state.isLoading = false;
        state.systemSettings = action.payload;
        state.isDirty = false;
      })
      .addCase(fetchSystemSettings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch system settings';
      })
      // Update system settings
      .addCase(updateSystemSettings.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateSystemSettings.fulfilled, (state, action) => {
        state.isLoading = false;
        state.systemSettings = action.payload;
        state.isDirty = false;
      })
      .addCase(updateSystemSettings.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to update system settings';
      });
  },
});

export const { updateSettingsLocally, resetSettings } = settingsSlice.actions;
export default settingsSlice.reducer;