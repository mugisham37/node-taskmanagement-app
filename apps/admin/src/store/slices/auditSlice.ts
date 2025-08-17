import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  sessionId: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

interface SecurityEvent {
  id: string;
  timestamp: string;
  type: 'login_attempt' | 'login_success' | 'login_failure' | 'logout' | 'password_change' | 'mfa_setup' | 'mfa_disable' | 'suspicious_activity' | 'data_breach' | 'unauthorized_access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  userEmail?: string;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  notes?: string;
}

interface ComplianceReport {
  id: string;
  name: string;
  type: 'gdpr' | 'soc2' | 'hipaa' | 'pci' | 'custom';
  period: {
    start: string;
    end: string;
  };
  status: 'generating' | 'completed' | 'failed';
  generatedAt: string;
  generatedBy: string;
  fileUrl?: string;
  summary: {
    totalEvents: number;
    criticalEvents: number;
    complianceScore: number;
    violations: number;
  };
}

interface DataRetentionPolicy {
  id: string;
  name: string;
  description: string;
  dataType: 'audit_logs' | 'user_data' | 'system_logs' | 'security_events' | 'custom';
  retentionPeriod: number; // days
  archiveAfter: number; // days
  deleteAfter: number; // days
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AuditState {
  // Audit logs
  auditLogs: AuditLogEntry[];
  selectedAuditLog: AuditLogEntry | null;
  auditFilters: {
    userId?: string;
    action?: string;
    resource?: string;
    dateRange?: { start: string; end: string };
    success?: boolean;
    search?: string;
  };
  
  // Security events
  securityEvents: SecurityEvent[];
  selectedSecurityEvent: SecurityEvent | null;
  securityFilters: {
    type?: string[];
    severity?: string[];
    resolved?: boolean;
    dateRange?: { start: string; end: string };
    search?: string;
  };
  
  // Compliance reports
  complianceReports: ComplianceReport[];
  selectedReport: ComplianceReport | null;
  
  // Data retention policies
  retentionPolicies: DataRetentionPolicy[];
  selectedPolicy: DataRetentionPolicy | null;
  
  // Statistics
  auditStats: {
    totalLogs: number;
    todayLogs: number;
    failedActions: number;
    uniqueUsers: number;
    topActions: Array<{ action: string; count: number }>;
    topResources: Array<{ resource: string; count: number }>;
    activityTrend: Array<{ date: string; count: number }>;
  };
  
  securityStats: {
    totalEvents: number;
    criticalEvents: number;
    unresolvedEvents: number;
    loginAttempts: number;
    failedLogins: number;
    suspiciousActivity: number;
    eventTrend: Array<{ date: string; count: number; severity: string }>;
  };
  
  // Pagination
  auditCurrentPage: number;
  auditPageSize: number;
  auditTotalLogs: number;
  
  securityCurrentPage: number;
  securityPageSize: number;
  securityTotalEvents: number;
  
  // Sorting
  auditSortBy: string;
  auditSortOrder: 'asc' | 'desc';
  securitySortBy: string;
  securitySortOrder: 'asc' | 'desc';
  
  // Loading states
  isLoadingAuditLogs: boolean;
  isLoadingSecurityEvents: boolean;
  isLoadingReports: boolean;
  isLoadingPolicies: boolean;
  isLoadingStats: boolean;
  isGeneratingReport: boolean;
  
  // Error states
  error: string | null;
  
  // Export
  isExporting: boolean;
  exportProgress: number;
}

const initialState: AuditState = {
  auditLogs: [],
  selectedAuditLog: null,
  auditFilters: {},
  securityEvents: [],
  selectedSecurityEvent: null,
  securityFilters: {},
  complianceReports: [],
  selectedReport: null,
  retentionPolicies: [],
  selectedPolicy: null,
  auditStats: {
    totalLogs: 0,
    todayLogs: 0,
    failedActions: 0,
    uniqueUsers: 0,
    topActions: [],
    topResources: [],
    activityTrend: [],
  },
  securityStats: {
    totalEvents: 0,
    criticalEvents: 0,
    unresolvedEvents: 0,
    loginAttempts: 0,
    failedLogins: 0,
    suspiciousActivity: 0,
    eventTrend: [],
  },
  auditCurrentPage: 1,
  auditPageSize: 25,
  auditTotalLogs: 0,
  securityCurrentPage: 1,
  securityPageSize: 25,
  securityTotalEvents: 0,
  auditSortBy: 'timestamp',
  auditSortOrder: 'desc',
  securitySortBy: 'timestamp',
  securitySortOrder: 'desc',
  isLoadingAuditLogs: false,
  isLoadingSecurityEvents: false,
  isLoadingReports: false,
  isLoadingPolicies: false,
  isLoadingStats: false,
  isGeneratingReport: false,
  error: null,
  isExporting: false,
  exportProgress: 0,
};

// Async thunks
export const fetchAuditLogsAsync = createAsyncThunk(
  'audit/fetchAuditLogs',
  async (params: { page?: number; pageSize?: number; filters?: Record<string, any>; sort?: { by: string; order: string } }, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/audit/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchSecurityEventsAsync = createAsyncThunk(
  'audit/fetchSecurityEvents',
  async (params: { page?: number; pageSize?: number; filters?: Record<string, any>; sort?: { by: string; order: string } }, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/audit/security-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) throw new Error('Failed to fetch security events');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const resolveSecurityEventAsync = createAsyncThunk(
  'audit/resolveSecurityEvent',
  async ({ eventId, notes }: { eventId: string; notes?: string }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/audit/security-events/${eventId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (!response.ok) throw new Error('Failed to resolve security event');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchComplianceReportsAsync = createAsyncThunk(
  'audit/fetchComplianceReports',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/audit/compliance-reports');
      if (!response.ok) throw new Error('Failed to fetch compliance reports');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const generateComplianceReportAsync = createAsyncThunk(
  'audit/generateComplianceReport',
  async (
    params: { type: string; period: { start: string; end: string }; includeDetails: boolean },
    { rejectWithValue, dispatch }
  ) => {
    try {
      dispatch(setGeneratingReport(true));
      
      const response = await fetch('/api/audit/compliance-reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) throw new Error('Failed to generate compliance report');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    } finally {
      dispatch(setGeneratingReport(false));
    }
  }
);

export const fetchRetentionPoliciesAsync = createAsyncThunk(
  'audit/fetchRetentionPolicies',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/audit/retention-policies');
      if (!response.ok) throw new Error('Failed to fetch retention policies');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchAuditStatsAsync = createAsyncThunk(
  'audit/fetchAuditStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/audit/stats');
      if (!response.ok) throw new Error('Failed to fetch audit statistics');
      return await response.json();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const exportAuditDataAsync = createAsyncThunk(
  'audit/exportAuditData',
  async (
    params: { type: 'logs' | 'events'; format: 'csv' | 'xlsx' | 'json'; filters?: Record<string, any> },
    { rejectWithValue, dispatch }
  ) => {
    try {
      dispatch(setExportProgress(0));
      
      const response = await fetch('/api/audit/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      
      if (!response.ok) throw new Error('Failed to export audit data');
      
      // Simulate progress updates
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        dispatch(setExportProgress(progress));
        if (progress >= 100) {
          clearInterval(interval);
        }
      }, 200);
      
      return await response.blob();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const auditSlice = createSlice({
  name: 'audit',
  initialState,
  reducers: {
    // Selection actions
    setSelectedAuditLog: (state, action: PayloadAction<AuditLogEntry | null>) => {
      state.selectedAuditLog = action.payload;
    },
    
    setSelectedSecurityEvent: (state, action: PayloadAction<SecurityEvent | null>) => {
      state.selectedSecurityEvent = action.payload;
    },
    
    setSelectedReport: (state, action: PayloadAction<ComplianceReport | null>) => {
      state.selectedReport = action.payload;
    },
    
    setSelectedPolicy: (state, action: PayloadAction<DataRetentionPolicy | null>) => {
      state.selectedPolicy = action.payload;
    },
    
    // Filter actions
    setAuditFilters: (state, action: PayloadAction<typeof initialState.auditFilters>) => {
      state.auditFilters = action.payload;
      state.auditCurrentPage = 1;
    },
    
    updateAuditFilter: (state, action: PayloadAction<{ key: string; value: any }>) => {
      const { key, value } = action.payload;
      if (value === null || value === undefined || value === '') {
        delete (state.auditFilters as any)[key];
      } else {
        (state.auditFilters as any)[key] = value;
      }
      state.auditCurrentPage = 1;
    },
    
    clearAuditFilters: (state) => {
      state.auditFilters = {};
      state.auditCurrentPage = 1;
    },
    
    setSecurityFilters: (state, action: PayloadAction<typeof initialState.securityFilters>) => {
      state.securityFilters = action.payload;
      state.securityCurrentPage = 1;
    },
    
    updateSecurityFilter: (state, action: PayloadAction<{ key: string; value: any }>) => {
      const { key, value } = action.payload;
      if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
        delete (state.securityFilters as any)[key];
      } else {
        (state.securityFilters as any)[key] = value;
      }
      state.securityCurrentPage = 1;
    },
    
    clearSecurityFilters: (state) => {
      state.securityFilters = {};
      state.securityCurrentPage = 1;
    },
    
    // Pagination actions
    setAuditCurrentPage: (state, action: PayloadAction<number>) => {
      state.auditCurrentPage = action.payload;
    },
    
    setAuditPageSize: (state, action: PayloadAction<number>) => {
      state.auditPageSize = action.payload;
      state.auditCurrentPage = 1;
    },
    
    setSecurityCurrentPage: (state, action: PayloadAction<number>) => {
      state.securityCurrentPage = action.payload;
    },
    
    setSecurityPageSize: (state, action: PayloadAction<number>) => {
      state.securityPageSize = action.payload;
      state.securityCurrentPage = 1;
    },
    
    // Sorting actions
    setAuditSorting: (state, action: PayloadAction<{ sortBy: string; sortOrder: 'asc' | 'desc' }>) => {
      state.auditSortBy = action.payload.sortBy;
      state.auditSortOrder = action.payload.sortOrder;
    },
    
    setSecuritySorting: (state, action: PayloadAction<{ sortBy: string; sortOrder: 'asc' | 'desc' }>) => {
      state.securitySortBy = action.payload.sortBy;
      state.securitySortOrder = action.payload.sortOrder;
    },
    
    // Real-time updates
    addAuditLog: (state, action: PayloadAction<AuditLogEntry>) => {
      state.auditLogs.unshift(action.payload);
      state.auditTotalLogs += 1;
      
      // Update stats
      state.auditStats.totalLogs += 1;
      if (!action.payload.success) {
        state.auditStats.failedActions += 1;
      }
    },
    
    addSecurityEvent: (state, action: PayloadAction<SecurityEvent>) => {
      state.securityEvents.unshift(action.payload);
      state.securityTotalEvents += 1;
      
      // Update stats
      state.securityStats.totalEvents += 1;
      if (action.payload.severity === 'critical') {
        state.securityStats.criticalEvents += 1;
      }
      if (!action.payload.resolved) {
        state.securityStats.unresolvedEvents += 1;
      }
    },
    
    // Export actions
    setExportProgress: (state, action: PayloadAction<number>) => {
      state.exportProgress = action.payload;
    },
    
    // Report generation
    setGeneratingReport: (state, action: PayloadAction<boolean>) => {
      state.isGeneratingReport = action.payload;
    },
    
    // Error handling
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch audit logs
    builder
      .addCase(fetchAuditLogsAsync.pending, (state) => {
        state.isLoadingAuditLogs = true;
        state.error = null;
      })
      .addCase(fetchAuditLogsAsync.fulfilled, (state, action) => {
        state.isLoadingAuditLogs = false;
        state.auditLogs = action.payload.data;
        state.auditTotalLogs = action.payload.total;
      })
      .addCase(fetchAuditLogsAsync.rejected, (state, action) => {
        state.isLoadingAuditLogs = false;
        state.error = action.payload as string;
      });

    // Fetch security events
    builder
      .addCase(fetchSecurityEventsAsync.pending, (state) => {
        state.isLoadingSecurityEvents = true;
        state.error = null;
      })
      .addCase(fetchSecurityEventsAsync.fulfilled, (state, action) => {
        state.isLoadingSecurityEvents = false;
        state.securityEvents = action.payload.data;
        state.securityTotalEvents = action.payload.total;
      })
      .addCase(fetchSecurityEventsAsync.rejected, (state, action) => {
        state.isLoadingSecurityEvents = false;
        state.error = action.payload as string;
      });

    // Resolve security event
    builder
      .addCase(resolveSecurityEventAsync.fulfilled, (state, action) => {
        const index = state.securityEvents.findIndex(event => event.id === action.payload.id);
        if (index !== -1) {
          state.securityEvents[index] = action.payload;
        }
        if (state.selectedSecurityEvent?.id === action.payload.id) {
          state.selectedSecurityEvent = action.payload;
        }
        
        // Update stats
        if (action.payload.resolved) {
          state.securityStats.unresolvedEvents = Math.max(0, state.securityStats.unresolvedEvents - 1);
        }
      });

    // Fetch compliance reports
    builder
      .addCase(fetchComplianceReportsAsync.pending, (state) => {
        state.isLoadingReports = true;
        state.error = null;
      })
      .addCase(fetchComplianceReportsAsync.fulfilled, (state, action) => {
        state.isLoadingReports = false;
        state.complianceReports = action.payload;
      })
      .addCase(fetchComplianceReportsAsync.rejected, (state, action) => {
        state.isLoadingReports = false;
        state.error = action.payload as string;
      });

    // Generate compliance report
    builder
      .addCase(generateComplianceReportAsync.fulfilled, (state, action) => {
        state.complianceReports.unshift(action.payload);
      });

    // Fetch retention policies
    builder
      .addCase(fetchRetentionPoliciesAsync.pending, (state) => {
        state.isLoadingPolicies = true;
        state.error = null;
      })
      .addCase(fetchRetentionPoliciesAsync.fulfilled, (state, action) => {
        state.isLoadingPolicies = false;
        state.retentionPolicies = action.payload;
      })
      .addCase(fetchRetentionPoliciesAsync.rejected, (state, action) => {
        state.isLoadingPolicies = false;
        state.error = action.payload as string;
      });

    // Fetch audit stats
    builder
      .addCase(fetchAuditStatsAsync.pending, (state) => {
        state.isLoadingStats = true;
        state.error = null;
      })
      .addCase(fetchAuditStatsAsync.fulfilled, (state, action) => {
        state.isLoadingStats = false;
        state.auditStats = action.payload.auditStats;
        state.securityStats = action.payload.securityStats;
      })
      .addCase(fetchAuditStatsAsync.rejected, (state, action) => {
        state.isLoadingStats = false;
        state.error = action.payload as string;
      });

    // Export audit data
    builder
      .addCase(exportAuditDataAsync.pending, (state) => {
        state.isExporting = true;
        state.exportProgress = 0;
        state.error = null;
      })
      .addCase(exportAuditDataAsync.fulfilled, (state) => {
        state.isExporting = false;
        state.exportProgress = 100;
      })
      .addCase(exportAuditDataAsync.rejected, (state, action) => {
        state.isExporting = false;
        state.exportProgress = 0;
        state.error = action.payload as string;
      });
  },
});

export const {
  setSelectedAuditLog,
  setSelectedSecurityEvent,
  setSelectedReport,
  setSelectedPolicy,
  setAuditFilters,
  updateAuditFilter,
  clearAuditFilters,
  setSecurityFilters,
  updateSecurityFilter,
  clearSecurityFilters,
  setAuditCurrentPage,
  setAuditPageSize,
  setSecurityCurrentPage,
  setSecurityPageSize,
  setAuditSorting,
  setSecuritySorting,
  addAuditLog,
  addSecurityEvent,
  setExportProgress,
  setGeneratingReport,
  clearError,
} = auditSlice.actions;

export default auditSlice.reducer;