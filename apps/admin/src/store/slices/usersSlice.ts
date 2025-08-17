import { userService } from '@/services/userService';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Permission, QueryParams, Role, User } from '@taskmanagement/types';

interface UsersState {
  users: User[];
  selectedUsers: string[];
  currentUser: User | null;
  roles: Role[];
  permissions: Permission[];
  
  // Pagination and filtering
  totalUsers: number;
  currentPage: number;
  pageSize: number;
  searchQuery: string;
  filters: {
    status?: 'active' | 'inactive' | 'suspended';
    role?: string;
    createdAfter?: string;
    createdBefore?: string;
  };
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  
  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isBulkOperating: boolean;
  
  // Error states
  error: string | null;
  validationErrors: Record<string, string>;
  
  // Bulk operations
  bulkOperation: {
    type: 'activate' | 'deactivate' | 'delete' | 'assign_role' | null;
    progress: number;
    total: number;
    completed: number;
    failed: number;
  };
}

const initialState: UsersState = {
  users: [],
  selectedUsers: [],
  currentUser: null,
  roles: [],
  permissions: [],
  totalUsers: 0,
  currentPage: 1,
  pageSize: 25,
  searchQuery: '',
  filters: {},
  sortBy: 'createdAt',
  sortOrder: 'desc',
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  isBulkOperating: false,
  error: null,
  validationErrors: {},
  bulkOperation: {
    type: null,
    progress: 0,
    total: 0,
    completed: 0,
    failed: 0,
  },
};

// Async thunks
export const fetchUsersAsync = createAsyncThunk(
  'users/fetchUsers',
  async (params: QueryParams, { rejectWithValue }) => {
    try {
      const result = await userService.getUsers(params);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchUserByIdAsync = createAsyncThunk(
  'users/fetchUserById',
  async (userId: string, { rejectWithValue }) => {
    try {
      const user = await userService.getUserById(userId);
      return user;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const createUserAsync = createAsyncThunk(
  'users/createUser',
  async (userData: Partial<User>, { rejectWithValue }) => {
    try {
      const user = await userService.createUser(userData);
      return user;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateUserAsync = createAsyncThunk(
  'users/updateUser',
  async ({ userId, userData }: { userId: string; userData: Partial<User> }, { rejectWithValue }) => {
    try {
      const user = await userService.updateUser(userId, userData);
      return user;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteUserAsync = createAsyncThunk(
  'users/deleteUser',
  async (userId: string, { rejectWithValue }) => {
    try {
      await userService.deleteUser(userId);
      return userId;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchRolesAsync = createAsyncThunk(
  'users/fetchRoles',
  async (_, { rejectWithValue }) => {
    try {
      const roles = await userService.getRoles();
      return roles;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchPermissionsAsync = createAsyncThunk(
  'users/fetchPermissions',
  async (_, { rejectWithValue }) => {
    try {
      const permissions = await userService.getPermissions();
      return permissions;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const bulkUpdateUsersAsync = createAsyncThunk(
  'users/bulkUpdateUsers',
  async (
    { userIds, operation, data }: { userIds: string[]; operation: string; data?: any },
    { rejectWithValue, dispatch }
  ) => {
    try {
      const result = await userService.bulkUpdateUsers(userIds, operation, data);
      
      // Update progress
      dispatch(updateBulkProgress({
        total: userIds.length,
        completed: result.successful.length,
        failed: result.failed.length,
      }));
      
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    // Selection actions
    selectUser: (state, action: PayloadAction<string>) => {
      if (!state.selectedUsers.includes(action.payload)) {
        state.selectedUsers.push(action.payload);
      }
    },
    deselectUser: (state, action: PayloadAction<string>) => {
      state.selectedUsers = state.selectedUsers.filter(id => id !== action.payload);
    },
    selectAllUsers: (state) => {
      state.selectedUsers = state.users.map(user => user.id);
    },
    deselectAllUsers: (state) => {
      state.selectedUsers = [];
    },
    toggleUserSelection: (state, action: PayloadAction<string>) => {
      const userId = action.payload;
      if (state.selectedUsers.includes(userId)) {
        state.selectedUsers = state.selectedUsers.filter(id => id !== userId);
      } else {
        state.selectedUsers.push(userId);
      }
    },
    
    // Filter and search actions
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
      state.currentPage = 1; // Reset to first page
    },
    setFilters: (state, action: PayloadAction<typeof initialState.filters>) => {
      state.filters = action.payload;
      state.currentPage = 1; // Reset to first page
    },
    updateFilter: (state, action: PayloadAction<{ key: string; value: any }>) => {
      const { key, value } = action.payload;
      if (value === null || value === undefined || value === '') {
        delete state.filters[key as keyof typeof state.filters];
      } else {
        (state.filters as any)[key] = value;
      }
      state.currentPage = 1; // Reset to first page
    },
    clearFilters: (state) => {
      state.filters = {};
      state.searchQuery = '';
      state.currentPage = 1;
    },
    
    // Pagination actions
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload;
    },
    setPageSize: (state, action: PayloadAction<number>) => {
      state.pageSize = action.payload;
      state.currentPage = 1; // Reset to first page
    },
    
    // Sorting actions
    setSorting: (state, action: PayloadAction<{ sortBy: string; sortOrder: 'asc' | 'desc' }>) => {
      state.sortBy = action.payload.sortBy;
      state.sortOrder = action.payload.sortOrder;
    },
    
    // Bulk operation actions
    startBulkOperation: (state, action: PayloadAction<'activate' | 'deactivate' | 'delete' | 'assign_role'>) => {
      state.bulkOperation.type = action.payload;
      state.bulkOperation.progress = 0;
      state.bulkOperation.total = state.selectedUsers.length;
      state.bulkOperation.completed = 0;
      state.bulkOperation.failed = 0;
      state.isBulkOperating = true;
    },
    updateBulkProgress: (state, action: PayloadAction<{ total: number; completed: number; failed: number }>) => {
      const { total, completed, failed } = action.payload;
      state.bulkOperation.total = total;
      state.bulkOperation.completed = completed;
      state.bulkOperation.failed = failed;
      state.bulkOperation.progress = Math.round((completed + failed) / total * 100);
    },
    completeBulkOperation: (state) => {
      state.bulkOperation.type = null;
      state.bulkOperation.progress = 0;
      state.isBulkOperating = false;
      state.selectedUsers = [];
    },
    
    // Error actions
    clearError: (state) => {
      state.error = null;
    },
    clearValidationErrors: (state) => {
      state.validationErrors = {};
    },
  },
  extraReducers: (builder) => {
    // Fetch users
    builder
      .addCase(fetchUsersAsync.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUsersAsync.fulfilled, (state, action) => {
        state.isLoading = false;
        state.users = action.payload.data;
        state.totalUsers = action.payload.total;
      })
      .addCase(fetchUsersAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch user by ID
    builder
      .addCase(fetchUserByIdAsync.fulfilled, (state, action) => {
        state.currentUser = action.payload;
      });

    // Create user
    builder
      .addCase(createUserAsync.pending, (state) => {
        state.isCreating = true;
        state.error = null;
        state.validationErrors = {};
      })
      .addCase(createUserAsync.fulfilled, (state, action) => {
        state.isCreating = false;
        state.users.unshift(action.payload);
        state.totalUsers += 1;
      })
      .addCase(createUserAsync.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.payload as string;
      });

    // Update user
    builder
      .addCase(updateUserAsync.pending, (state) => {
        state.isUpdating = true;
        state.error = null;
        state.validationErrors = {};
      })
      .addCase(updateUserAsync.fulfilled, (state, action) => {
        state.isUpdating = false;
        const index = state.users.findIndex(user => user.id === action.payload.id);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
        if (state.currentUser?.id === action.payload.id) {
          state.currentUser = action.payload;
        }
      })
      .addCase(updateUserAsync.rejected, (state, action) => {
        state.isUpdating = false;
        state.error = action.payload as string;
      });

    // Delete user
    builder
      .addCase(deleteUserAsync.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deleteUserAsync.fulfilled, (state, action) => {
        state.isDeleting = false;
        state.users = state.users.filter(user => user.id !== action.payload);
        state.totalUsers -= 1;
        state.selectedUsers = state.selectedUsers.filter(id => id !== action.payload);
      })
      .addCase(deleteUserAsync.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.payload as string;
      });

    // Fetch roles
    builder
      .addCase(fetchRolesAsync.fulfilled, (state, action) => {
        state.roles = action.payload;
      });

    // Fetch permissions
    builder
      .addCase(fetchPermissionsAsync.fulfilled, (state, action) => {
        state.permissions = action.payload;
      });

    // Bulk update users
    builder
      .addCase(bulkUpdateUsersAsync.fulfilled, (state, action) => {
        state.isBulkOperating = false;
        // Refresh users list after bulk operation
        // This would typically trigger a refetch
      })
      .addCase(bulkUpdateUsersAsync.rejected, (state, action) => {
        state.isBulkOperating = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  selectUser,
  deselectUser,
  selectAllUsers,
  deselectAllUsers,
  toggleUserSelection,
  setSearchQuery,
  setFilters,
  updateFilter,
  clearFilters,
  setCurrentPage,
  setPageSize,
  setSorting,
  startBulkOperation,
  updateBulkProgress,
  completeBulkOperation,
  clearError,
  clearValidationErrors,
} = usersSlice.actions;

export default usersSlice.reducer;