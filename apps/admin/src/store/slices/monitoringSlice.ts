import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
}

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  uptime: number;
  responseTime: number;
  lastCheck: string;
  dependencies: Array<{
    name: string;
    status: 'healthy' | 'unhealthy' | 'unknown';
  }>;
}

interface PerformanceMetrics {
  apiResponseTime: {
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    requestsPerMinute: number;
  };
  errorRate: {
    rate: number;
    count: number;
  };
  activeConnections: number;
  queueSize: number;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  service: string;
  message: string;
  metadata?: Record<string, any>;
}

interface MonitoringState {
  // System metrics
  systemMetrics: SystemMetrics | null;
  systemMetricsHistory: Array<{ timestamp: string; metrics: SystemMetrics }>;
  
  // Service health
  services: ServiceHealth[];
  overallHealth: 'healthy' | 'unhealthy' | 'degraded';
  
  // Performance metrics
  performanceMetrics: PerformanceMetrics | null;
  performanceHistory: Array<{ timestamp: string; metrics: PerformanceMetrics }>;
  
  // Logs
  logs: LogEntry[];
  logFilters: {
    level?: string;
    service?: string;
    timeRange?: string;
    search?: string;
  };
  
  // Alerts
  activeAlerts: number;
  criticalAlerts: number;
  
  // Real-time updates
  isRealTimeEnabled: boolean;
  lastUpdate: string | null;
  
  // Loading states
  isLoadingMetrics: boolean;
  isLoadingServices: boolean;
  isLoadingLogs: boolean;
  
  // Error states
  error: string | null;
  
  // Configuration
  refreshInterval: number;
  metricsRetention: number; // hours
}

const initialState: MonitoringState = {
  systemMetrics: null,
  systemMetricsHistory: [],
  services: [],
  overallHealth: 'unknown',
  performanceMetrics: null,
  performanceHistory: [],
  logs: [],
  logFilters: {},
  activeAlerts: 0,
  criticalAlerts: 0,
  isRealTimeEnabled: true,
  lastUpdate: null,
  isLoadingMetrics: false,
  isLoadingServices: false,
  isLoadingLogs: false,
  error: null,
  refreshInterval: 30000, // 30 seconds
  metricsRetention: 24, // 24 hours
};

// Async thunks
export const fetchSystemMetricsAsync = createAsyncThunk(
  'monitoring/fetchSystemMetrics',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/monitoring/system-metrics');
      if (!response.ok) throw new Error('Failed to fetch system metrics');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchServiceHealthAsync = createAsyncThunk(
  'monitoring/fetchServiceHealth',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/monitoring/service-health');
      if (!response.ok) throw new Error('Failed to fetch service health');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchPerformanceMetricsAsync = createAsyncThunk(
  'monitoring/fetchPerformanceMetrics',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/monitoring/performance-metrics');
      if (!response.ok) throw new Error('Failed to fetch performance metrics');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchLogsAsync = createAsyncThunk(
  'monitoring/fetchLogs',
  async (filters: Record<string, any>, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/monitoring/logs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch logs');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const monitoringSlice = createSlice({
  name: 'monitoring',
  initialState,
  reducers: {
    // Real-time updates
    updateSystemMetrics: (state, action: PayloadAction<SystemMetrics>) => {
      state.systemMetrics = action.payload;
      state.lastUpdate = new Date().toISOString();
      
      // Add to history
      state.systemMetricsHistory.push({
        timestamp: new Date().toISOString(),
        metrics: action.payload,
      });
      
      // Keep only recent history based on retention
      const cutoff = new Date(Date.now() - state.metricsRetention * 60 * 60 * 1000);
      state.systemMetricsHistory = state.systemMetricsHistory.filter(
        entry => new Date(entry.timestamp) > cutoff
      );
    },
    
    updateServiceHealth: (state, action: PayloadAction<ServiceHealth[]>) => {
      state.services = action.payload;
      
      // Calculate overall health
      const unhealthyServices = action.payload.filter(s => s.status === 'unhealthy').length;
      const degradedServices = action.payload.filter(s => s.status === 'degraded').length;
      
      if (unhealthyServices > 0) {
        state.overallHealth = 'unhealthy';
      } else if (degradedServices > 0) {
        state.overallHealth = 'degraded';
      } else {
        state.overallHealth = 'healthy';
      }
    },
    
    updatePerformanceMetrics: (state, action: PayloadAction<PerformanceMetrics>) => {
      state.performanceMetrics = action.payload;
      
      // Add to history
      state.performanceHistory.push({
        timestamp: new Date().toISOString(),
        metrics: action.payload,
      });
      
      // Keep only recent history
      const cutoff = new Date(Date.now() - state.metricsRetention * 60 * 60 * 1000);
      state.performanceHistory = state.performanceHistory.filter(
        entry => new Date(entry.timestamp) > cutoff
      );
    },
    
    addLogEntry: (state, action: PayloadAction<LogEntry>) => {
      state.logs.unshift(action.payload);
      
      // Keep only recent logs (max 1000)
      if (state.logs.length > 1000) {
        state.logs = state.logs.slice(0, 1000);
      }
    },
    
    // Log filtering
    setLogFilters: (state, action: PayloadAction<typeof initialState.logFilters>) => {
      state.logFilters = action.payload;
    },
    
    updateLogFilter: (state, action: PayloadAction<{ key: string; value: any }>) => {
      const { key, value } = action.payload;
      if (value === null || value === undefined || value === '') {
        delete (state.logFilters as any)[key];
      } else {
        (state.logFilters as any)[key] = value;
      }
    },
    
    clearLogFilters: (state) => {
      state.logFilters = {};
    },
    
    // Alert updates
    updateAlertCounts: (state, action: PayloadAction<{ active: number; critical: number }>) => {
      state.activeAlerts = action.payload.active;
      state.criticalAlerts = action.payload.critical;
    },
    
    // Configuration
    setRealTimeEnabled: (state, action: PayloadAction<boolean>) => {
      state.isRealTimeEnabled = action.payload;
    },
    
    setRefreshInterval: (state, action: PayloadAction<number>) => {
      state.refreshInterval = action.payload;
    },
    
    setMetricsRetention: (state, action: PayloadAction<number>) => {
      state.metricsRetention = action.payload;
    },
    
    // Error handling
    clearError: (state) => {
      state.error = null;
    },
    
    // Clear data
    clearMetricsHistory: (state) => {
      state.systemMetricsHistory = [];
      state.performanceHistory = [];
    },
    
    clearLogs: (state) => {
      state.logs = [];
    },
  },
  extraReducers: (builder) => {
    // Fetch system metrics
    builder
      .addCase(fetchSystemMetricsAsync.pending, (state) => {
        state.isLoadingMetrics = true;
        state.error = null;
      })
      .addCase(fetchSystemMetricsAsync.fulfilled, (state, action) => {
        state.isLoadingMetrics = false;
        state.systemMetrics = action.payload;
        state.lastUpdate = new Date().toISOString();
      })
      .addCase(fetchSystemMetricsAsync.rejected, (state, action) => {
        state.isLoadingMetrics = false;
        state.error = action.payload as string;
      });

    // Fetch service health
    builder
      .addCase(fetchServiceHealthAsync.pending, (state) => {
        state.isLoadingServices = true;
        state.error = null;
      })
      .addCase(fetchServiceHealthAsync.fulfilled, (state, action) => {
        state.isLoadingServices = false;
        state.services = action.payload;
      })
      .addCase(fetchServiceHealthAsync.rejected, (state, action) => {
        state.isLoadingServices = false;
        state.error = action.payload as string;
      });

    // Fetch performance metrics
    builder
      .addCase(fetchPerformanceMetricsAsync.fulfilled, (state, action) => {
        state.performanceMetrics = action.payload;
      });

    // Fetch logs
    builder
      .addCase(fetchLogsAsync.pending, (state) => {
        state.isLoadingLogs = true;
        state.error = null;
      })
      .addCase(fetchLogsAsync.fulfilled, (state, action) => {
        state.isLoadingLogs = false;
        state.logs = action.payload;
      })
      .addCase(fetchLogsAsync.rejected, (state, action) => {
        state.isLoadingLogs = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  updateSystemMetrics,
  updateServiceHealth,
  updatePerformanceMetrics,
  addLogEntry,
  setLogFilters,
  updateLogFilter,
  clearLogFilters,
  updateAlertCounts,
  setRealTimeEnabled,
  setRefreshInterval,
  setMetricsRetention,
  clearError,
  clearMetricsHistory,
  clearLogs,
} = monitoringSlice.actions;

export default monitoringSlice.reducer;