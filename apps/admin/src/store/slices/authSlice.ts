import { authService } from '@/services/authService';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LoginCredentials, User } from '@taskmanagement/types';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  mfaRequired: boolean;
  mfaToken: string | null;
  sessionExpiry: number | null;
  permissions: string[];
  roles: string[];
}

const initialState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  mfaRequired: false,
  mfaToken: null,
  sessionExpiry: null,
  permissions: [],
  roles: [],
};

// Async thunks
export const loginAsync = createAsyncThunk(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const result = await authService.login(credentials);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const verifyMFAAsync = createAsyncThunk(
  'auth/verifyMFA',
  async ({ token, mfaCode }: { token: string; mfaCode: string }, { rejectWithValue }) => {
    try {
      const result = await authService.verifyMFA(token, mfaCode);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const refreshTokenAsync = createAsyncThunk(
  'auth/refreshToken',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      if (!state.auth.refreshToken) {
        throw new Error('No refresh token available');
      }
      const result = await authService.refreshToken(state.auth.refreshToken);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const logoutAsync = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const getCurrentUserAsync = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const user = await authService.getCurrentUser();
      return user;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearMFA: (state) => {
      state.mfaRequired = false;
      state.mfaToken = null;
    },
    updatePermissions: (state, action: PayloadAction<string[]>) => {
      state.permissions = action.payload;
    },
    updateRoles: (state, action: PayloadAction<string[]>) => {
      state.roles = action.payload;
    },
    setSessionExpiry: (state, action: PayloadAction<number>) => {
      state.sessionExpiry = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Login
    builder
      .addCase(loginAsync.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginAsync.fulfilled, (state, action) => {
        state.isLoading = false;
        const { user, token, refreshToken, mfaRequired, mfaToken } = action.payload;
        
        if (mfaRequired) {
          state.mfaRequired = true;
          state.mfaToken = mfaToken;
        } else {
          state.user = user;
          state.token = token;
          state.refreshToken = refreshToken;
          state.isAuthenticated = true;
          state.permissions = user.permissions || [];
          state.roles = user.roles || [];
        }
      })
      .addCase(loginAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // MFA Verification
    builder
      .addCase(verifyMFAAsync.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(verifyMFAAsync.fulfilled, (state, action) => {
        state.isLoading = false;
        state.mfaRequired = false;
        state.mfaToken = null;
        
        const { user, token, refreshToken } = action.payload;
        state.user = user;
        state.token = token;
        state.refreshToken = refreshToken;
        state.isAuthenticated = true;
        state.permissions = user.permissions || [];
        state.roles = user.roles || [];
      })
      .addCase(verifyMFAAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Refresh Token
    builder
      .addCase(refreshTokenAsync.fulfilled, (state, action) => {
        const { token, refreshToken } = action.payload;
        state.token = token;
        state.refreshToken = refreshToken;
      })
      .addCase(refreshTokenAsync.rejected, (state) => {
        // Token refresh failed, logout user
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        state.permissions = [];
        state.roles = [];
      });

    // Logout
    builder
      .addCase(logoutAsync.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        state.mfaRequired = false;
        state.mfaToken = null;
        state.permissions = [];
        state.roles = [];
        state.sessionExpiry = null;
      });

    // Get Current User
    builder
      .addCase(getCurrentUserAsync.fulfilled, (state, action) => {
        state.user = action.payload;
        state.permissions = action.payload.permissions || [];
        state.roles = action.payload.roles || [];
      });
  },
});

export const { clearError, clearMFA, updatePermissions, updateRoles, setSessionExpiry } = authSlice.actions;
export default authSlice.reducer;