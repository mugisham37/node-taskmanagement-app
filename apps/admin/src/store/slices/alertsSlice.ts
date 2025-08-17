import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'active' | 'acknowledged' | 'resolved' | 'suppressed';
  source: string;
  category: 'system' | 'security' | 'performance' | 'business' | 'user';
  createdAt: string;
  updatedAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  metadata?: Record<string, any>;
  tags: string[];
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  threshold: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  enabled: boolean;
  channels: string[];
  cooldown: number; // minutes
  createdAt: string;
  updatedAt: string;
}

interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'sms' | 'pagerduty';
  config: Record<string, any>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EscalationPolicy {
  id: string;
  name: string;
  description: string;
  rules: Array<{
    level: number;
    delay: number; // minutes
    channels: string[];
    users: string[];
  }>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AlertsState {
  // Alerts
  alerts: Alert[];
  selectedAlerts: string[];
  alertFilters: {
    severity?: string[];
    status?: string[];
    category?: string[];
    source?: string;
    dateRange?: { start: string; end: string };
    search?: string;
  };
  
  // Alert rules
  alertRules: AlertRule[];
  selectedRule: AlertRule | null;
  
  // Notification channels
  notificationChannels: NotificationChannel[];
  selectedChannel: NotificationChannel | null;
  
  // Escalation policies
  escalationPolicies: EscalationPolicy[];
  selectedPolicy: EscalationPolicy | null;
  
  // Statistics
  alertStats: {
    total: number;
    active: number;
    critical: number;
    acknowledged: number;
    resolved: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    trend: Array<{ date: string; count: number }>;
  };
  
  // Pagination
  currentPage: number;
  pageSize: number;
  totalAlerts: number;
  
  // Sorting
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  
  // Loading states
  isLoadingAlerts: boolean;
  isLoadingRules: boolean;
  isLoadingChannels: boolean;
  isLoadingPolicies: boolean;
  isLoadingStats: boolean;
  
  // Operation states
  isAcknowledging: boolean;
  isResolving: boolean;
  isSuppressing: boolean;
  isBulkOperating: boolean;
  
  // Error states
  error: string | null;
  
  // Real-time updates
  realTimeEnabled: boolean;
  lastUpdate: string | null;
}

const initialState: AlertsState = {
  alerts: [],
  selectedAlerts: [],
  alertFilters: {},
  alertRules: [],
  selectedRule: null,
  notificationChannels: [],
  selectedChannel: null,
  escalationPolicies: [],
  selectedPolicy: null,
  alertStats: {
    total: 0,
    active: 0,
    critical: 0,
    acknowledged: 0,
    resolved: 0,
    byCategory: {},
    bySeverity: {},
    trend: [],
  },
  currentPage: 1,
  pageSize: 25,
  totalAlerts: 0,
  sortBy: 'createdAt',
  sortOrder: 'desc',
  isLoadingAlerts: false,
  isLoadingRules: false,
  isLoadingChannels: false,
  isLoadingPolicies: false,
  isLoadingStats: false,
  isAcknowledging: false,
  isResolving: false,
  isSuppressing: false,
  isBulkOperating: false,
  error: null,
  realTimeEnabled: true,
  lastUpdate: null,
};

// Async thunks
export const fetchAlertsAsync = createAsyncThunk(
  'alerts/fetchAlerts',
  async (params: { page?: number; pageSize?: number; filters?: Record<string, any> }, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error('Failed to fetch alerts');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const acknowledgeAlertAsync = createAsyncThunk(
  'alerts/acknowledgeAlert',
  async ({ alertId, note }: { alertId: string; note?: string }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      if (!response.ok) throw new Error('Failed to acknowledge alert');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const resolveAlertAsync = createAsyncThunk(
  'alerts/resolveAlert',
  async ({ alertId, note }: { alertId: string; note?: string }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      if (!response.ok) throw new Error('Failed to resolve alert');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const suppressAlertAsync = createAsyncThunk(
  'alerts/suppressAlert',
  async ({ alertId, duration, note }: { alertId: string; duration: number; note?: string }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}/suppress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration, note }),
      });
      if (!response.ok) throw new Error('Failed to suppress alert');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const bulkOperationAlertsAsync = createAsyncThunk(
  'alerts/bulkOperation',
  async (
    { alertIds, operation, data }: { alertIds: string[]; operation: 'acknowledge' | 'resolve' | 'suppress'; data?: any },
    { rejectWithValue }
  ) => {
    try {
      const response = await fetch('/api/alerts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertIds, operation, data }),
      });
      if (!response.ok) throw new Error('Failed to perform bulk operation');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchAlertRulesAsync = createAsyncThunk(
  'alerts/fetchAlertRules',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/alerts/rules');
      if (!response.ok) throw new Error('Failed to fetch alert rules');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchNotificationChannelsAsync = createAsyncThunk(
  'alerts/fetchNotificationChannels',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/alerts/channels');
      if (!response.ok) throw new Error('Failed to fetch notification channels');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchAlertStatsAsync = createAsyncThunk(
  'alerts/fetchAlertStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/alerts/stats');
      if (!response.ok) throw new Error('Failed to fetch alert statistics');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const alertsSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    // Selection actions
    selectAlert: (state, action: PayloadAction<string>) => {
      if (!state.selectedAlerts.includes(action.payload)) {
        state.selectedAlerts.push(action.payload);
      }
    },
    
    deselectAlert: (state, action: PayloadAction<string>) => {
      state.selectedAlerts = state.selectedAlerts.filter(id => id !== action.payload);
    },
    
    selectAllAlerts: (state) => {
      state.selectedAlerts = state.alerts.map(alert => alert.id);
    },
    
    deselectAllAlerts: (state) => {
      state.selectedAlerts = [];
    },
    
    toggleAlertSelection: (state, action: PayloadAction<string>) => {
      const alertId = action.payload;
      if (state.selectedAlerts.includes(alertId)) {
        state.selectedAlerts = state.selectedAlerts.filter(id => id !== alertId);
      } else {
        state.selectedAlerts.push(alertId);
      }
    },
    
    // Filter actions
    setAlertFilters: (state, action: PayloadAction<typeof initialState.alertFilters>) => {
      state.alertFilters = action.payload;
      state.currentPage = 1;
    },
    
    updateAlertFilter: (state, action: PayloadAction<{ key: string; value: any }>) => {
      const { key, value } = action.payload;
      if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
        delete (state.alertFilters as any)[key];
      } else {
        (state.alertFilters as any)[key] = value;
      }
      state.currentPage = 1;
    },
    
    clearAlertFilters: (state) => {
      state.alertFilters = {};
      state.currentPage = 1;
    },
    
    // Pagination actions
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload;
    },
    
    setPageSize: (state, action: PayloadAction<number>) => {
      state.pageSize = action.payload;
      state.currentPage = 1;
    },
    
    // Sorting actions
    setSorting: (state, action: PayloadAction<{ sortBy: string; sortOrder: 'asc' | 'desc' }>) => {
      state.sortBy = action.payload.sortBy;
      state.sortOrder = action.payload.sortOrder;
    },
    
    // Real-time updates
    addAlert: (state, action: PayloadAction<Alert>) => {
      state.alerts.unshift(action.payload);
      state.totalAlerts += 1;
      state.lastUpdate = new Date().toISOString();
    },
    
    updateAlert: (state, action: PayloadAction<Alert>) => {
      const index = state.alerts.findIndex(alert => alert.id === action.payload.id);
      if (index !== -1) {
        state.alerts[index] = action.payload;
      }
      state.lastUpdate = new Date().toISOString();
    },
    
    removeAlert: (state, action: PayloadAction<string>) => {
      state.alerts = state.alerts.filter(alert => alert.id !== action.payload);
      state.totalAlerts -= 1;
      state.selectedAlerts = state.selectedAlerts.filter(id => id !== action.payload);
    },
    
    // Configuration actions
    setSelectedRule: (state, action: PayloadAction<AlertRule | null>) => {
      state.selectedRule = action.payload;
    },
    
    setSelectedChannel: (state, action: PayloadAction<NotificationChannel | null>) => {
      state.selectedChannel = action.payload;
    },
    
    setSelectedPolicy: (state, action: PayloadAction<EscalationPolicy | null>) => {
      state.selectedPolicy = action.payload;
    },
    
    // Real-time configuration
    setRealTimeEnabled: (state, action: PayloadAction<boolean>) => {
      state.realTimeEnabled = action.payload;
    },
    
    // Error handling
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch alerts
    builder
      .addCase(fetchAlertsAsync.pending, (state) => {
        state.isLoadingAlerts = true;
        state.error = null;
      })
      .addCase(fetchAlertsAsync.fulfilled, (state, action) => {
        state.isLoadingAlerts = false;
        state.alerts = action.payload.data;
        state.totalAlerts = action.payload.total;
        state.lastUpdate = new Date().toISOString();
      })
      .addCase(fetchAlertsAsync.rejected, (state, action) => {
        state.isLoadingAlerts = false;
        state.error = action.payload as string;
      });

    // Acknowledge alert
    builder
      .addCase(acknowledgeAlertAsync.pending, (state) => {
        state.isAcknowledging = true;
        state.error = null;
      })
      .addCase(acknowledgeAlertAsync.fulfilled, (state, action) => {
        state.isAcknowledging = false;
        const index = state.alerts.findIndex(alert => alert.id === action.payload.id);
        if (index !== -1) {
          state.alerts[index] = action.payload;
        }
      })
      .addCase(acknowledgeAlertAsync.rejected, (state, action) => {
        state.isAcknowledging = false;
        state.error = action.payload as string;
      });

    // Resolve alert
    builder
      .addCase(resolveAlertAsync.pending, (state) => {
        state.isResolving = true;
        state.error = null;
      })
      .addCase(resolveAlertAsync.fulfilled, (state, action) => {
        state.isResolving = false;
        const index = state.alerts.findIndex(alert => alert.id === action.payload.id);
        if (index !== -1) {
          state.alerts[index] = action.payload;
        }
      })
      .addCase(resolveAlertAsync.rejected, (state, action) => {
        state.isResolving = false;
        state.error = action.payload as string;
      });

    // Suppress alert
    builder
      .addCase(suppressAlertAsync.pending, (state) => {
        state.isSuppressing = true;
        state.error = null;
      })
      .addCase(suppressAlertAsync.fulfilled, (state, action) => {
        state.isSuppressing = false;
        const index = state.alerts.findIndex(alert => alert.id === action.payload.id);
        if (index !== -1) {
          state.alerts[index] = action.payload;
        }
      })
      .addCase(suppressAlertAsync.rejected, (state, action) => {
        state.isSuppressing = false;
        state.error = action.payload as string;
      });

    // Bulk operations
    builder
      .addCase(bulkOperationAlertsAsync.pending, (state) => {
        state.isBulkOperating = true;
        state.error = null;
      })
      .addCase(bulkOperationAlertsAsync.fulfilled, (state, action) => {
        state.isBulkOperating = false;
        state.selectedAlerts = [];
        // Update alerts based on operation results
        action.payload.successful.forEach((alertId: string) => {
          const index = state.alerts.findIndex(alert => alert.id === alertId);
          if (index !== -1) {
            // Update alert status based on operation
            // This would be more specific based on the actual response
          }
        });
      })
      .addCase(bulkOperationAlertsAsync.rejected, (state, action) => {
        state.isBulkOperating = false;
        state.error = action.payload as string;
      });

    // Fetch alert rules
    builder
      .addCase(fetchAlertRulesAsync.pending, (state) => {
        state.isLoadingRules = true;
        state.error = null;
      })
      .addCase(fetchAlertRulesAsync.fulfilled, (state, action) => {
        state.isLoadingRules = false;
        state.alertRules = action.payload;
      })
      .addCase(fetchAlertRulesAsync.rejected, (state, action) => {
        state.isLoadingRules = false;
        state.error = action.payload as string;
      });

    // Fetch notification channels
    builder
      .addCase(fetchNotificationChannelsAsync.pending, (state) => {
        state.isLoadingChannels = true;
        state.error = null;
      })
      .addCase(fetchNotificationChannelsAsync.fulfilled, (state, action) => {
        state.isLoadingChannels = false;
        state.notificationChannels = action.payload;
      })
      .addCase(fetchNotificationChannelsAsync.rejected, (state, action) => {
        state.isLoadingChannels = false;
        state.error = action.payload as string;
      });

    // Fetch alert stats
    builder
      .addCase(fetchAlertStatsAsync.pending, (state) => {
        state.isLoadingStats = true;
        state.error = null;
      })
      .addCase(fetchAlertStatsAsync.fulfilled, (state, action) => {
        state.isLoadingStats = false;
        state.alertStats = action.payload;
      })
      .addCase(fetchAlertStatsAsync.rejected, (state, action) => {
        state.isLoadingStats = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  selectAlert,
  deselectAlert,
  selectAllAlerts,
  deselectAllAlerts,
  toggleAlertSelection,
  setAlertFilters,
  updateAlertFilter,
  clearAlertFilters,
  setCurrentPage,
  setPageSize,
  setSorting,
  addAlert,
  updateAlert,
  removeAlert,
  setSelectedRule,
  setSelectedChannel,
  setSelectedPolicy,
  setRealTimeEnabled,
  clearError,
} = alertsSlice.actions;

export default alertsSlice.reducer;