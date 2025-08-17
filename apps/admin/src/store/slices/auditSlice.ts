import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId: string;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  severity: 'low' | 'medium' | 'high';
}

interface AuditState {
  logs: AuditLog[];
  isLoading: boolean;
  error: string | null;
  totalCount: number;
  currentPage: number;
  pageSize: number;
  filters: {
    action: string;
    severity: string;
    dateRange: string;
    search: string;
  };
}

const initialState: AuditState = {
  logs: [],
  isLoading: false,
  error: null,
  totalCount: 0,
  currentPage: 1,
  pageSize: 20,
  filters: {
    action: 'all',
    severity: 'all',
    dateRange: 'today',
    search: '',
  },
};

// Async thunks
export const fetchAuditLogs = createAsyncThunk(
  'audit/fetchLogs',
  async (params: { page?: number; pageSize?: number; filters?: any }) => {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockLogs: AuditLog[] = [
      {
        id: '1',
        timestamp: '2024-01-15T10:30:00Z',
        userId: 'user-123',
        userName: 'John Doe',
        action: 'USER_LOGIN',
        resource: 'Authentication',
        resourceId: 'auth-session-456',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        details: { loginMethod: '2FA', success: true },
        severity: 'low',
      },
      {
        id: '2',
        timestamp: '2024-01-15T10:25:00Z',
        userId: 'admin-456',
        userName: 'Jane Smith',
        action: 'USER_DELETE',
        resource: 'User',
        resourceId: 'user-789',
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        details: { deletedUser: 'bob.johnson@example.com', reason: 'Account violation' },
        severity: 'high',
      },
    ];

    return {
      logs: mockLogs,
      totalCount: mockLogs.length,
    };
  }
);

export const exportAuditLogs = createAsyncThunk(
  'audit/exportLogs',
  async (params: { format: 'csv' | 'json'; filters?: any }) => {
    // Mock API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Return download URL or file data
    return {
      downloadUrl: 'https://example.com/audit-logs-export.csv',
      filename: `audit-logs-${new Date().toISOString().split('T')[0]}.${params.format}`,
    };
  }
);

const auditSlice = createSlice({
  name: 'audit',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<typeof initialState.filters>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload;
    },
    setPageSize: (state, action: PayloadAction<number>) => {
      state.pageSize = action.payload;
    },
    clearFilters: (state) => {
      state.filters = {
        action: 'all',
        severity: 'all',
        dateRange: 'today',
        search: '',
      };
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch audit logs
      .addCase(fetchAuditLogs.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAuditLogs.fulfilled, (state, action) => {
        state.isLoading = false;
        state.logs = action.payload.logs;
        state.totalCount = action.payload.totalCount;
      })
      .addCase(fetchAuditLogs.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch audit logs';
      })
      // Export audit logs
      .addCase(exportAuditLogs.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(exportAuditLogs.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(exportAuditLogs.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to export audit logs';
      });
  },
});

export const { setFilters, setPage, setPageSize, clearFilters } = auditSlice.actions;
export default auditSlice.reducer;