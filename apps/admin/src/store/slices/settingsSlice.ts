import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SystemSettings {
  general: {
    siteName: string;
    siteDescription: string;
    adminEmail: string;
    timezone: string;
    dateFormat: string;
    language: string;
    maintenanceMode: boolean;
  };
  security: {
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
      maxAge: number; // days
    };
    sessionTimeout: number; // minutes
    maxLoginAttempts: number;
    lockoutDuration: number; // minutes
    twoFactorRequired: boolean;
    ipWhitelist: string[];
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    slackEnabled: boolean;
    webhookEnabled: boolean;
    defaultChannels: string[];
  };
  integrations: {
    prometheus: {
      enabled: boolean;
      endpoint: string;
      username?: string;
      password?: string;
    };
    grafana: {
      enabled: boolean;
      endpoint: string;
      apiKey?: string;
    };
    jaeger: {
      enabled: boolean;
      endpoint: string;
    };
    elasticsearch: {
      enabled: boolean;
      endpoint: string;
      username?: string;
      password?: string;
    };
  };
  backup: {
    enabled: boolean;
    schedule: string; // cron expression
    retention: number; // days
    destination: 's3' | 'local' | 'ftp';
    config: Record<string, any>;
  };
  performance: {
    cacheEnabled: boolean;
    cacheTtl: number; // seconds
    rateLimiting: {
      enabled: boolean;
      requestsPerMinute: number;
      burstLimit: number;
    };
    compression: {
      enabled: boolean;
      level: number;
    };
  };
}

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  conditions: Array<{
    type: 'user_role' | 'user_id' | 'ip_address' | 'custom';
    operator: 'equals' | 'contains' | 'in' | 'not_in';
    value: any;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: 'welcome' | 'password_reset' | 'notification' | 'alert' | 'custom';
  variables: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  expiresAt?: string;
  lastUsed?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SettingsState {
  // System settings
  systemSettings: SystemSettings | null;
  
  // Feature flags
  featureFlags: FeatureFlag[];
  selectedFeatureFlag: FeatureFlag | null;
  
  // Email templates
  emailTemplates: EmailTemplate[];
  selectedEmailTemplate: EmailTemplate | null;
  
  // API keys
  apiKeys: ApiKey[];
  selectedApiKey: ApiKey | null;
  
  // Loading states
  isLoadingSettings: boolean;
  isLoadingFeatureFlags: boolean;
  isLoadingEmailTemplates: boolean;
  isLoadingApiKeys: boolean;
  isSaving: boolean;
  
  // Error states
  error: string | null;
  validationErrors: Record<string, string>;
  
  // UI state
  activeTab: string;
  unsavedChanges: boolean;
}

const initialState: SettingsState = {
  systemSettings: null,
  featureFlags: [],
  selectedFeatureFlag: null,
  emailTemplates: [],
  selectedEmailTemplate: null,
  apiKeys: [],
  selectedApiKey: null,
  isLoadingSettings: false,
  isLoadingFeatureFlags: false,
  isLoadingEmailTemplates: false,
  isLoadingApiKeys: false,
  isSaving: false,
  error: null,
  validationErrors: {},
  activeTab: 'general',
  unsavedChanges: false,
};

// Async thunks
export const fetchSystemSettingsAsync = createAsyncThunk(
  'settings/fetchSystemSettings',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/settings/system');
      if (!response.ok) throw new Error('Failed to fetch system settings');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateSystemSettingsAsync = createAsyncThunk(
  'settings/updateSystemSettings',
  async (settings: Partial<SystemSettings>, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/settings/system', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!response.ok) throw new Error('Failed to update system settings');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchFeatureFlagsAsync = createAsyncThunk(
  'settings/fetchFeatureFlags',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/settings/feature-flags');
      if (!response.ok) throw new Error('Failed to fetch feature flags');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const createFeatureFlagAsync = createAsyncThunk(
  'settings/createFeatureFlag',
  async (flagData: Omit<FeatureFlag, 'id' | 'createdAt' | 'updatedAt'>, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/settings/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flagData),
      });
      if (!response.ok) throw new Error('Failed to create feature flag');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateFeatureFlagAsync = createAsyncThunk(
  'settings/updateFeatureFlag',
  async ({ id, data }: { id: string; data: Partial<FeatureFlag> }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/settings/feature-flags/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update feature flag');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchEmailTemplatesAsync = createAsyncThunk(
  'settings/fetchEmailTemplates',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/settings/email-templates');
      if (!response.ok) throw new Error('Failed to fetch email templates');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchApiKeysAsync = createAsyncThunk(
  'settings/fetchApiKeys',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/settings/api-keys');
      if (!response.ok) throw new Error('Failed to fetch API keys');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const createApiKeyAsync = createAsyncThunk(
  'settings/createApiKey',
  async (keyData: Omit<ApiKey, 'id' | 'key' | 'createdAt' | 'updatedAt'>, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keyData),
      });
      if (!response.ok) throw new Error('Failed to create API key');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const revokeApiKeyAsync = createAsyncThunk(
  'settings/revokeApiKey',
  async (keyId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/settings/api-keys/${keyId}/revoke`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to revoke API key');
      return keyId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    // UI actions
    setActiveTab: (state, action: PayloadAction<string>) => {
      state.activeTab = action.payload;
    },
    
    setUnsavedChanges: (state, action: PayloadAction<boolean>) => {
      state.unsavedChanges = action.payload;
    },
    
    // Selection actions
    setSelectedFeatureFlag: (state, action: PayloadAction<FeatureFlag | null>) => {
      state.selectedFeatureFlag = action.payload;
    },
    
    setSelectedEmailTemplate: (state, action: PayloadAction<EmailTemplate | null>) => {
      state.selectedEmailTemplate = action.payload;
    },
    
    setSelectedApiKey: (state, action: PayloadAction<ApiKey | null>) => {
      state.selectedApiKey = action.payload;
    },
    
    // Local settings updates (before saving)
    updateLocalSettings: (state, action: PayloadAction<{ section: string; data: any }>) => {
      const { section, data } = action.payload;
      if (state.systemSettings) {
        (state.systemSettings as any)[section] = {
          ...(state.systemSettings as any)[section],
          ...data,
        };
        state.unsavedChanges = true;
      }
    },
    
    // Feature flag actions
    toggleFeatureFlag: (state, action: PayloadAction<string>) => {
      const flag = state.featureFlags.find(f => f.id === action.payload);
      if (flag) {
        flag.enabled = !flag.enabled;
      }
    },
    
    updateFeatureFlagRollout: (state, action: PayloadAction<{ id: string; percentage: number }>) => {
      const { id, percentage } = action.payload;
      const flag = state.featureFlags.find(f => f.id === id);
      if (flag) {
        flag.rolloutPercentage = percentage;
      }
    },
    
    // Error handling
    clearError: (state) => {
      state.error = null;
    },
    
    clearValidationErrors: (state) => {
      state.validationErrors = {};
    },
    
    setValidationError: (state, action: PayloadAction<{ field: string; message: string }>) => {
      const { field, message } = action.payload;
      state.validationErrors[field] = message;
    },
    
    // Reset state
    resetUnsavedChanges: (state) => {
      state.unsavedChanges = false;
    },
  },
  extraReducers: (builder) => {
    // Fetch system settings
    builder
      .addCase(fetchSystemSettingsAsync.pending, (state) => {
        state.isLoadingSettings = true;
        state.error = null;
      })
      .addCase(fetchSystemSettingsAsync.fulfilled, (state, action) => {
        state.isLoadingSettings = false;
        state.systemSettings = action.payload;
        state.unsavedChanges = false;
      })
      .addCase(fetchSystemSettingsAsync.rejected, (state, action) => {
        state.isLoadingSettings = false;
        state.error = action.payload as string;
      });

    // Update system settings
    builder
      .addCase(updateSystemSettingsAsync.pending, (state) => {
        state.isSaving = true;
        state.error = null;
        state.validationErrors = {};
      })
      .addCase(updateSystemSettingsAsync.fulfilled, (state, action) => {
        state.isSaving = false;
        state.systemSettings = action.payload;
        state.unsavedChanges = false;
      })
      .addCase(updateSystemSettingsAsync.rejected, (state, action) => {
        state.isSaving = false;
        state.error = action.payload as string;
      });

    // Fetch feature flags
    builder
      .addCase(fetchFeatureFlagsAsync.pending, (state) => {
        state.isLoadingFeatureFlags = true;
        state.error = null;
      })
      .addCase(fetchFeatureFlagsAsync.fulfilled, (state, action) => {
        state.isLoadingFeatureFlags = false;
        state.featureFlags = action.payload;
      })
      .addCase(fetchFeatureFlagsAsync.rejected, (state, action) => {
        state.isLoadingFeatureFlags = false;
        state.error = action.payload as string;
      });

    // Create feature flag
    builder
      .addCase(createFeatureFlagAsync.fulfilled, (state, action) => {
        state.featureFlags.push(action.payload);
      });

    // Update feature flag
    builder
      .addCase(updateFeatureFlagAsync.fulfilled, (state, action) => {
        const index = state.featureFlags.findIndex(flag => flag.id === action.payload.id);
        if (index !== -1) {
          state.featureFlags[index] = action.payload;
        }
        if (state.selectedFeatureFlag?.id === action.payload.id) {
          state.selectedFeatureFlag = action.payload;
        }
      });

    // Fetch email templates
    builder
      .addCase(fetchEmailTemplatesAsync.pending, (state) => {
        state.isLoadingEmailTemplates = true;
        state.error = null;
      })
      .addCase(fetchEmailTemplatesAsync.fulfilled, (state, action) => {
        state.isLoadingEmailTemplates = false;
        state.emailTemplates = action.payload;
      })
      .addCase(fetchEmailTemplatesAsync.rejected, (state, action) => {
        state.isLoadingEmailTemplates = false;
        state.error = action.payload as string;
      });

    // Fetch API keys
    builder
      .addCase(fetchApiKeysAsync.pending, (state) => {
        state.isLoadingApiKeys = true;
        state.error = null;
      })
      .addCase(fetchApiKeysAsync.fulfilled, (state, action) => {
        state.isLoadingApiKeys = false;
        state.apiKeys = action.payload;
      })
      .addCase(fetchApiKeysAsync.rejected, (state, action) => {
        state.isLoadingApiKeys = false;
        state.error = action.payload as string;
      });

    // Create API key
    builder
      .addCase(createApiKeyAsync.fulfilled, (state, action) => {
        state.apiKeys.push(action.payload);
      });

    // Revoke API key
    builder
      .addCase(revokeApiKeyAsync.fulfilled, (state, action) => {
        const index = state.apiKeys.findIndex(key => key.id === action.payload);
        if (index !== -1) {
          state.apiKeys[index].enabled = false;
        }
      });
  },
});

export const {
  setActiveTab,
  setUnsavedChanges,
  setSelectedFeatureFlag,
  setSelectedEmailTemplate,
  setSelectedApiKey,
  updateLocalSettings,
  toggleFeatureFlag,
  updateFeatureFlagRollout,
  clearError,
  clearValidationErrors,
  setValidationError,
  resetUnsavedChanges,
} = settingsSlice.actions;

export default settingsSlice.reducer;