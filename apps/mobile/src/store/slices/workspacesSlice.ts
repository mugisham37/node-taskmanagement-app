import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  members: string[];
  settings: {
    isPublic: boolean;
    allowInvites: boolean;
    defaultRole: 'viewer' | 'member' | 'admin';
  };
  createdAt: string;
  updatedAt: string;
}

interface WorkspacesState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: WorkspacesState = {
  workspaces: [],
  currentWorkspace: null,
  isLoading: false,
  error: null,
};

// Mock data
const mockWorkspaces: Workspace[] = [
  {
    id: 'workspace-1',
    name: 'Personal Workspace',
    description: 'My personal projects and tasks',
    ownerId: 'user-1',
    members: ['user-1'],
    settings: {
      isPublic: false,
      allowInvites: false,
      defaultRole: 'member',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'workspace-2',
    name: 'Team Alpha',
    description: 'Development team workspace',
    ownerId: 'user-1',
    members: ['user-1', 'user-2', 'user-3'],
    settings: {
      isPublic: false,
      allowInvites: true,
      defaultRole: 'member',
    },
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
];

export const fetchWorkspaces = createAsyncThunk(
  'workspaces/fetchWorkspaces',
  async (_, { rejectWithValue }) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      return mockWorkspaces;
    } catch (error) {
      return rejectWithValue('Failed to fetch workspaces');
    }
  }
);

export const createWorkspace = createAsyncThunk(
  'workspaces/createWorkspace',
  async (workspaceData: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>, { rejectWithValue }) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const newWorkspace: Workspace = {
        ...workspaceData,
        id: `workspace-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      return newWorkspace;
    } catch (error) {
      return rejectWithValue('Failed to create workspace');
    }
  }
);

const workspacesSlice = createSlice({
  name: 'workspaces',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCurrentWorkspace: (state, action: PayloadAction<Workspace | null>) => {
      state.currentWorkspace = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Fetch workspaces
    builder
      .addCase(fetchWorkspaces.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchWorkspaces.fulfilled, (state, action) => {
        state.isLoading = false;
        state.workspaces = action.payload;
        if (!state.currentWorkspace && action.payload.length > 0) {
          state.currentWorkspace = action.payload[0];
        }
      })
      .addCase(fetchWorkspaces.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Create workspace
    builder
      .addCase(createWorkspace.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createWorkspace.fulfilled, (state, action) => {
        state.isLoading = false;
        state.workspaces.push(action.payload);
      })
      .addCase(createWorkspace.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setCurrentWorkspace } = workspacesSlice.actions;
export default workspacesSlice.reducer;