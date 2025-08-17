import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    temperature: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    inbound: number;
    outbound: number;
  };
}

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  uptime: string;
  responseTime: number;
  lastCheck: string;
}

interface MonitoringState {
  metrics: SystemMetrics | null;
  services: ServiceStatus[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

const initialState: MonitoringState = {
  metrics: null,
  services: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
};

// Async thunks
export const fetchSystemMetrics = createAsyncThunk(
  'monitoring/fetchSystemMetrics',
  async () => {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const mockMetrics: SystemMetrics = {
      cpu: {
        usage: 45.2,
        cores: 8,
        temperature: 62,
      },
      memory: {
        used: 12.4,
        total: 32,
        percentage: 38.8,
      },
      disk: {
        used: 245,
        total: 500,
        percentage: 49.0,
      },
      network: {
        inbound: 125.6,
        outbound: 89.3,
      },
    };

    return mockMetrics;
  }
);

export const fetchServiceStatus = createAsyncThunk(
  'monitoring/fetchServiceStatus',
  async () => {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const mockServices: ServiceStatus[] = [
      {
        name: 'API Server',
        status: 'healthy',
        uptime: '99.9%',
        responseTime: 145,
        lastCheck: '2024-01-15T10:30:00Z',
      },
      {
        name: 'Database',
        status: 'healthy',
        uptime: '99.8%',
        responseTime: 23,
        lastCheck: '2024-01-15T10:30:00Z',
      },
    ];

    return mockServices;
  }
);

const monitoringSlice = createSlice({
  name: 'monitoring',
  initialState,
  reducers: {
    updateMetrics: (state, action: PayloadAction<SystemMetrics>) => {
      state.metrics = action.payload;
      state.lastUpdated = new Date().toISOString();
    },
    updateServiceStatus: (state, action: PayloadAction<ServiceStatus[]>) => {
      state.services = action.payload;
      state.lastUpdated = new Date().toISOString();
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch system metrics
      .addCase(fetchSystemMetrics.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSystemMetrics.fulfilled, (state, action) => {
        state.isLoading = false;
        state.metrics = action.payload;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchSystemMetrics.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch system metrics';
      })
      // Fetch service status
      .addCase(fetchServiceStatus.fulfilled, (state, action) => {
        state.services = action.payload;
        state.lastUpdated = new Date().toISOString();
      });
  },
});

export const { updateMetrics, updateServiceStatus } = monitoringSlice.actions;
export default monitoringSlice.reducer;