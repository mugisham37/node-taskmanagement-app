import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AnalyticsMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  userGrowth: number;
  totalTasks: number;
  completedTasks: number;
  taskCompletionRate: number;
  averageSessionTime: number;
  pageViews: number;
  bounceRate: number;
}

interface FeatureUsage {
  feature: string;
  usage: number;
  growth: number;
}

interface UserEngagement {
  date: string;
  activeUsers: number;
  newUsers: number;
  sessions: number;
}

interface AnalyticsState {
  metrics: AnalyticsMetrics | null;
  featureUsage: FeatureUsage[];
  userEngagement: UserEngagement[];
  isLoading: boolean;
  error: string | null;
  timeRange: '1d' | '7d' | '30d' | '90d';
}

const initialState: AnalyticsState = {
  metrics: null,
  featureUsage: [],
  userEngagement: [],
  isLoading: false,
  error: null,
  timeRange: '7d',
};

// Async thunks
export const fetchAnalyticsMetrics = createAsyncThunk(
  'analytics/fetchMetrics',
  async (timeRange: string) => {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockMetrics: AnalyticsMetrics = {
      totalUsers: 12847,
      activeUsers: 8934,
      newUsers: 234,
      userGrowth: 12.5,
      totalTasks: 45678,
      completedTasks: 38901,
      taskCompletionRate: 85.2,
      averageSessionTime: 24.5,
      pageViews: 156789,
      bounceRate: 23.4,
    };

    return mockMetrics;
  }
);

export const fetchFeatureUsage = createAsyncThunk(
  'analytics/fetchFeatureUsage',
  async () => {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const mockFeatureUsage: FeatureUsage[] = [
      { feature: 'Task Management', usage: 89.5, growth: 5.2 },
      { feature: 'Project Boards', usage: 76.3, growth: 8.1 },
      { feature: 'Team Collaboration', usage: 68.7, growth: 12.3 },
      { feature: 'File Sharing', usage: 54.2, growth: -2.1 },
      { feature: 'Time Tracking', usage: 43.8, growth: 15.7 },
      { feature: 'Reporting', usage: 32.1, growth: 7.4 },
    ];

    return mockFeatureUsage;
  }
);

export const fetchUserEngagement = createAsyncThunk(
  'analytics/fetchUserEngagement',
  async () => {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const mockEngagementData: UserEngagement[] = [
      { date: '2024-01-01', activeUsers: 8234, newUsers: 145, sessions: 12456 },
      { date: '2024-01-02', activeUsers: 8456, newUsers: 167, sessions: 12789 },
      { date: '2024-01-03', activeUsers: 8123, newUsers: 134, sessions: 11987 },
      { date: '2024-01-04', activeUsers: 8678, newUsers: 189, sessions: 13234 },
      { date: '2024-01-05', activeUsers: 8934, newUsers: 234, sessions: 13567 },
    ];

    return mockEngagementData;
  }
);

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    setTimeRange: (state, action: PayloadAction<'1d' | '7d' | '30d' | '90d'>) => {
      state.timeRange = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch analytics metrics
      .addCase(fetchAnalyticsMetrics.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAnalyticsMetrics.fulfilled, (state, action) => {
        state.isLoading = false;
        state.metrics = action.payload;
      })
      .addCase(fetchAnalyticsMetrics.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch analytics metrics';
      })
      // Fetch feature usage
      .addCase(fetchFeatureUsage.fulfilled, (state, action) => {
        state.featureUsage = action.payload;
      })
      // Fetch user engagement
      .addCase(fetchUserEngagement.fulfilled, (state, action) => {
        state.userEngagement = action.payload;
      });
  },
});

export const { setTimeRange } = analyticsSlice.actions;
export default analyticsSlice.reducer;