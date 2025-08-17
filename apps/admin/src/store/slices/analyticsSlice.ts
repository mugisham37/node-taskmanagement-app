import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UserEngagementMetrics {
  activeUsers: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  sessionMetrics: {
    averageSessionDuration: number;
    bounceRate: number;
    pagesPerSession: number;
  };
  userRetention: {
    day1: number;
    day7: number;
    day30: number;
  };
}

interface FeatureUsageMetrics {
  features: Array<{
    name: string;
    usage: number;
    trend: 'up' | 'down' | 'stable';
    users: number;
  }>;
  topFeatures: string[];
  unusedFeatures: string[];
}

interface BusinessMetrics {
  revenue: {
    total: number;
    growth: number;
    trend: Array<{ date: string; value: number }>;
  };
  conversions: {
    rate: number;
    total: number;
    funnel: Array<{ stage: string; count: number; rate: number }>;
  };
  customerMetrics: {
    totalCustomers: number;
    newCustomers: number;
    churnRate: number;
    lifetimeValue: number;
  };
}

interface PerformanceAnalytics {
  pageLoadTimes: {
    average: number;
    p95: number;
    trend: Array<{ date: string; value: number }>;
  };
  apiPerformance: {
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
  };
  userExperience: {
    coreWebVitals: {
      lcp: number; // Largest Contentful Paint
      fid: number; // First Input Delay
      cls: number; // Cumulative Layout Shift
    };
    satisfactionScore: number;
  };
}

interface CustomReport {
  id: string;
  name: string;
  description: string;
  type: 'chart' | 'table' | 'metric';
  config: Record<string, any>;
  data: any[];
  createdAt: string;
  updatedAt: string;
}

interface AnalyticsState {
  // Metrics
  userEngagement: UserEngagementMetrics | null;
  featureUsage: FeatureUsageMetrics | null;
  businessMetrics: BusinessMetrics | null;
  performanceAnalytics: PerformanceAnalytics | null;
  
  // Reports
  customReports: CustomReport[];
  selectedReport: CustomReport | null;
  
  // Filters
  dateRange: {
    start: string;
    end: string;
  };
  filters: {
    userSegment?: string;
    platform?: string;
    region?: string;
    plan?: string;
  };
  
  // Comparison
  comparisonEnabled: boolean;
  comparisonPeriod: {
    start: string;
    end: string;
  };
  
  // Loading states
  isLoadingEngagement: boolean;
  isLoadingFeatures: boolean;
  isLoadingBusiness: boolean;
  isLoadingPerformance: boolean;
  isLoadingReports: boolean;
  
  // Error states
  error: string | null;
  
  // Export
  isExporting: boolean;
  exportProgress: number;
  
  // Real-time updates
  realTimeEnabled: boolean;
  lastUpdate: string | null;
}

const initialState: AnalyticsState = {
  userEngagement: null,
  featureUsage: null,
  businessMetrics: null,
  performanceAnalytics: null,
  customReports: [],
  selectedReport: null,
  dateRange: {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    end: new Date().toISOString().split('T')[0], // today
  },
  filters: {},
  comparisonEnabled: false,
  comparisonPeriod: {
    start: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 60 days ago
    end: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
  },
  isLoadingEngagement: false,
  isLoadingFeatures: false,
  isLoadingBusiness: false,
  isLoadingPerformance: false,
  isLoadingReports: false,
  error: null,
  isExporting: false,
  exportProgress: 0,
  realTimeEnabled: false,
  lastUpdate: null,
};

// Async thunks
export const fetchUserEngagementAsync = createAsyncThunk(
  'analytics/fetchUserEngagement',
  async (params: { dateRange: { start: string; end: string }; filters?: Record<string, any> }, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/analytics/user-engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error('Failed to fetch user engagement metrics');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchFeatureUsageAsync = createAsyncThunk(
  'analytics/fetchFeatureUsage',
  async (params: { dateRange: { start: string; end: string }; filters?: Record<string, any> }, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/analytics/feature-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error('Failed to fetch feature usage metrics');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchBusinessMetricsAsync = createAsyncThunk(
  'analytics/fetchBusinessMetrics',
  async (params: { dateRange: { start: string; end: string }; filters?: Record<string, any> }, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/analytics/business-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error('Failed to fetch business metrics');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchPerformanceAnalyticsAsync = createAsyncThunk(
  'analytics/fetchPerformanceAnalytics',
  async (params: { dateRange: { start: string; end: string }; filters?: Record<string, any> }, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/analytics/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error('Failed to fetch performance analytics');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchCustomReportsAsync = createAsyncThunk(
  'analytics/fetchCustomReports',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/analytics/custom-reports');
      if (!response.ok) throw new Error('Failed to fetch custom reports');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const createCustomReportAsync = createAsyncThunk(
  'analytics/createCustomReport',
  async (reportData: Omit<CustomReport, 'id' | 'createdAt' | 'updatedAt'>, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/analytics/custom-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData),
      });
      if (!response.ok) throw new Error('Failed to create custom report');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const exportDataAsync = createAsyncThunk(
  'analytics/exportData',
  async (
    params: { type: string; format: 'csv' | 'xlsx' | 'json'; filters?: Record<string, any> },
    { rejectWithValue, dispatch }
  ) => {
    try {
      dispatch(setExportProgress(0));
      
      const response = await fetch('/api/analytics/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) throw new Error('Failed to export data');
      
      // Simulate progress updates
      const reader = response.body?.getReader();
      if (reader) {
        let progress = 0;
        while (progress < 100) {
          progress += 10;
          dispatch(setExportProgress(progress));
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      return await response.blob();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    // Date range actions
    setDateRange: (state, action: PayloadAction<{ start: string; end: string }>) => {
      state.dateRange = action.payload;
    },
    
    // Filter actions
    setFilters: (state, action: PayloadAction<Record<string, any>>) => {
      state.filters = action.payload;
    },
    
    updateFilter: (state, action: PayloadAction<{ key: string; value: any }>) => {
      const { key, value } = action.payload;
      if (value === null || value === undefined || value === '') {
        delete (state.filters as any)[key];
      } else {
        (state.filters as any)[key] = value;
      }
    },
    
    clearFilters: (state) => {
      state.filters = {};
    },
    
    // Comparison actions
    setComparisonEnabled: (state, action: PayloadAction<boolean>) => {
      state.comparisonEnabled = action.payload;
    },
    
    setComparisonPeriod: (state, action: PayloadAction<{ start: string; end: string }>) => {
      state.comparisonPeriod = action.payload;
    },
    
    // Report actions
    setSelectedReport: (state, action: PayloadAction<CustomReport | null>) => {
      state.selectedReport = action.payload;
    },
    
    // Export actions
    setExportProgress: (state, action: PayloadAction<number>) => {
      state.exportProgress = action.payload;
    },
    
    // Real-time actions
    setRealTimeEnabled: (state, action: PayloadAction<boolean>) => {
      state.realTimeEnabled = action.payload;
    },
    
    updateLastUpdate: (state) => {
      state.lastUpdate = new Date().toISOString();
    },
    
    // Error actions
    clearError: (state) => {
      state.error = null;
    },
    
    // Preset date ranges
    setPresetDateRange: (state, action: PayloadAction<'today' | 'yesterday' | 'last7days' | 'last30days' | 'last90days' | 'thisMonth' | 'lastMonth'>) => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (action.payload) {
        case 'today':
          state.dateRange = {
            start: today.toISOString().split('T')[0],
            end: today.toISOString().split('T')[0],
          };
          break;
        case 'yesterday':
          const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
          state.dateRange = {
            start: yesterday.toISOString().split('T')[0],
            end: yesterday.toISOString().split('T')[0],
          };
          break;
        case 'last7days':
          const last7days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          state.dateRange = {
            start: last7days.toISOString().split('T')[0],
            end: today.toISOString().split('T')[0],
          };
          break;
        case 'last30days':
          const last30days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
          state.dateRange = {
            start: last30days.toISOString().split('T')[0],
            end: today.toISOString().split('T')[0],
          };
          break;
        case 'last90days':
          const last90days = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
          state.dateRange = {
            start: last90days.toISOString().split('T')[0],
            end: today.toISOString().split('T')[0],
          };
          break;
        case 'thisMonth':
          const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          state.dateRange = {
            start: thisMonthStart.toISOString().split('T')[0],
            end: today.toISOString().split('T')[0],
          };
          break;
        case 'lastMonth':
          const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
          state.dateRange = {
            start: lastMonthStart.toISOString().split('T')[0],
            end: lastMonthEnd.toISOString().split('T')[0],
          };
          break;
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch user engagement
    builder
      .addCase(fetchUserEngagementAsync.pending, (state) => {
        state.isLoadingEngagement = true;
        state.error = null;
      })
      .addCase(fetchUserEngagementAsync.fulfilled, (state, action) => {
        state.isLoadingEngagement = false;
        state.userEngagement = action.payload;
        state.lastUpdate = new Date().toISOString();
      })
      .addCase(fetchUserEngagementAsync.rejected, (state, action) => {
        state.isLoadingEngagement = false;
        state.error = action.payload as string;
      });

    // Fetch feature usage
    builder
      .addCase(fetchFeatureUsageAsync.pending, (state) => {
        state.isLoadingFeatures = true;
        state.error = null;
      })
      .addCase(fetchFeatureUsageAsync.fulfilled, (state, action) => {
        state.isLoadingFeatures = false;
        state.featureUsage = action.payload;
      })
      .addCase(fetchFeatureUsageAsync.rejected, (state, action) => {
        state.isLoadingFeatures = false;
        state.error = action.payload as string;
      });

    // Fetch business metrics
    builder
      .addCase(fetchBusinessMetricsAsync.pending, (state) => {
        state.isLoadingBusiness = true;
        state.error = null;
      })
      .addCase(fetchBusinessMetricsAsync.fulfilled, (state, action) => {
        state.isLoadingBusiness = false;
        state.businessMetrics = action.payload;
      })
      .addCase(fetchBusinessMetricsAsync.rejected, (state, action) => {
        state.isLoadingBusiness = false;
        state.error = action.payload as string;
      });

    // Fetch performance analytics
    builder
      .addCase(fetchPerformanceAnalyticsAsync.pending, (state) => {
        state.isLoadingPerformance = true;
        state.error = null;
      })
      .addCase(fetchPerformanceAnalyticsAsync.fulfilled, (state, action) => {
        state.isLoadingPerformance = false;
        state.performanceAnalytics = action.payload;
      })
      .addCase(fetchPerformanceAnalyticsAsync.rejected, (state, action) => {
        state.isLoadingPerformance = false;
        state.error = action.payload as string;
      });

    // Fetch custom reports
    builder
      .addCase(fetchCustomReportsAsync.pending, (state) => {
        state.isLoadingReports = true;
        state.error = null;
      })
      .addCase(fetchCustomReportsAsync.fulfilled, (state, action) => {
        state.isLoadingReports = false;
        state.customReports = action.payload;
      })
      .addCase(fetchCustomReportsAsync.rejected, (state, action) => {
        state.isLoadingReports = false;
        state.error = action.payload as string;
      });

    // Create custom report
    builder
      .addCase(createCustomReportAsync.fulfilled, (state, action) => {
        state.customReports.push(action.payload);
      });

    // Export data
    builder
      .addCase(exportDataAsync.pending, (state) => {
        state.isExporting = true;
        state.exportProgress = 0;
        state.error = null;
      })
      .addCase(exportDataAsync.fulfilled, (state) => {
        state.isExporting = false;
        state.exportProgress = 100;
      })
      .addCase(exportDataAsync.rejected, (state, action) => {
        state.isExporting = false;
        state.exportProgress = 0;
        state.error = action.payload as string;
      });
  },
});

export const {
  setDateRange,
  setFilters,
  updateFilter,
  clearFilters,
  setComparisonEnabled,
  setComparisonPeriod,
  setSelectedReport,
  setExportProgress,
  setRealTimeEnabled,
  updateLastUpdate,
  clearError,
  setPresetDateRange,
} = analyticsSlice.actions;

export default analyticsSlice.reducer;