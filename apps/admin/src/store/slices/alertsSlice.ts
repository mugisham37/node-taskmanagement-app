import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  timestamp: string;
  source: string;
  acknowledged: boolean;
  resolved: boolean;
}

interface AlertsState {
  alerts: Alert[];
  isLoading: boolean;
  error: string | null;
  filter: 'all' | 'unresolved' | 'acknowledged';
}

const initialState: AlertsState = {
  alerts: [],
  isLoading: false,
  error: null,
  filter: 'all',
};

// Async thunks
export const fetchAlerts = createAsyncThunk(
  'alerts/fetchAlerts',
  async () => {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock alerts data
    const mockAlerts: Alert[] = [
      {
        id: '1',
        title: 'High CPU Usage',
        message: 'CPU usage has exceeded 90% for the past 5 minutes on server-01',
        severity: 'error',
        timestamp: '2024-01-15T10:25:00Z',
        source: 'System Monitor',
        acknowledged: false,
        resolved: false,
      },
      {
        id: '2',
        title: 'Database Connection Pool Warning',
        message: 'Database connection pool is at 85% capacity',
        severity: 'warning',
        timestamp: '2024-01-15T10:20:00Z',
        source: 'Database Monitor',
        acknowledged: true,
        resolved: false,
      },
    ];

    return mockAlerts;
  }
);

export const acknowledgeAlert = createAsyncThunk(
  'alerts/acknowledgeAlert',
  async (alertId: string) => {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 500));
    return alertId;
  }
);

export const resolveAlert = createAsyncThunk(
  'alerts/resolveAlert',
  async (alertId: string) => {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 500));
    return alertId;
  }
);

const alertsSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    setFilter: (state, action: PayloadAction<'all' | 'unresolved' | 'acknowledged'>) => {
      state.filter = action.payload;
    },
    addAlert: (state, action: PayloadAction<Omit<Alert, 'id' | 'timestamp' | 'acknowledged' | 'resolved'>>) => {
      const alert: Alert = {
        ...action.payload,
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        acknowledged: false,
        resolved: false,
      };
      state.alerts.unshift(alert);
    },
    removeAlert: (state, action: PayloadAction<string>) => {
      state.alerts = state.alerts.filter(alert => alert.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch alerts
      .addCase(fetchAlerts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAlerts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.alerts = action.payload;
      })
      .addCase(fetchAlerts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch alerts';
      })
      // Acknowledge alert
      .addCase(acknowledgeAlert.fulfilled, (state, action) => {
        const alert = state.alerts.find(a => a.id === action.payload);
        if (alert) {
          alert.acknowledged = true;
        }
      })
      // Resolve alert
      .addCase(resolveAlert.fulfilled, (state, action) => {
        const alert = state.alerts.find(a => a.id === action.payload);
        if (alert) {
          alert.resolved = true;
          alert.acknowledged = true;
        }
      });
  },
});

export const { setFilter, addAlert, removeAlert } = alertsSlice.actions;
export default alertsSlice.reducer;