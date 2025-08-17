import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED' | 'ON_HOLD';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  ownerId: string;
  members: string[];
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  progress: number;
  taskCount: number;
  completedTaskCount: number;
}

interface ProjectsState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  filters: {
    status?: Project['status'];
    priority?: Project['priority'];
    ownerId?: string;
    search?: string;
  };
}

const initialState: ProjectsState = {
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,
  filters: {},
};

// Mock data
const mockProjects: Project[] = [
  {
    id: 'project-1',
    name: 'Mobile App Development',
    description: 'Develop a cross-platform mobile application',
    status: 'ACTIVE',
    priority: 'HIGH',
    ownerId: 'user-1',
    members: ['user-1', 'user-2', 'user-3'],
    startDate: '2024-01-01T00:00:00Z',
    endDate: '2024-06-30T00:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-18T00:00:00Z',
    tags: ['mobile', 'react-native'],
    progress: 65,
    taskCount: 24,
    completedTaskCount: 16,
  },
  {
    id: 'project-2',
    name: 'Website Redesign',
    description: 'Redesign the company website with modern UI/UX',
    status: 'ACTIVE',
    priority: 'MEDIUM',
    ownerId: 'user-2',
    members: ['user-2', 'user-4'],
    startDate: '2024-02-01T00:00:00Z',
    endDate: '2024-04-30T00:00:00Z',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-18T00:00:00Z',
    tags: ['web', 'design'],
    progress: 30,
    taskCount: 18,
    completedTaskCount: 5,
  },
];

// Async thunks
export const fetchProjects = createAsyncThunk(
  'projects/fetchProjects',
  async (filters?: Partial<ProjectsState['filters']>, { rejectWithValue }) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      let filteredProjects = [...mockProjects];
      
      if (filters?.status) {
        filteredProjects = filteredProjects.filter(project => project.status === filters.status);
      }
      
      if (filters?.priority) {
        filteredProjects = filteredProjects.filter(project => project.priority === filters.priority);
      }
      
      if (filters?.ownerId) {
        filteredProjects = filteredProjects.filter(project => project.ownerId === filters.ownerId);
      }
      
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        filteredProjects = filteredProjects.filter(project => 
          project.name.toLowerCase().includes(searchLower) ||
          project.description?.toLowerCase().includes(searchLower)
        );
      }
      
      return filteredProjects;
    } catch (error) {
      return rejectWithValue('Failed to fetch projects');
    }
  }
);

export const fetchProjectById = createAsyncThunk(
  'projects/fetchProjectById',
  async (projectId: string, { rejectWithValue }) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const project = mockProjects.find(p => p.id === projectId);
      if (!project) {
        throw new Error('Project not found');
      }
      
      return project;
    } catch (error) {
      return rejectWithValue('Failed to fetch project');
    }
  }
);

export const createProject = createAsyncThunk(
  'projects/createProject',
  async (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'progress' | 'taskCount' | 'completedTaskCount'>, { rejectWithValue }) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const newProject: Project = {
        ...projectData,
        id: `project-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        progress: 0,
        taskCount: 0,
        completedTaskCount: 0,
      };
      
      return newProject;
    } catch (error) {
      return rejectWithValue('Failed to create project');
    }
  }
);

export const updateProject = createAsyncThunk(
  'projects/updateProject',
  async ({ projectId, updates }: { projectId: string; updates: Partial<Project> }, { rejectWithValue }) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const updatedProject = {
        ...updates,
        id: projectId,
        updatedAt: new Date().toISOString(),
      };
      
      return updatedProject;
    } catch (error) {
      return rejectWithValue('Failed to update project');
    }
  }
);

export const deleteProject = createAsyncThunk(
  'projects/deleteProject',
  async (projectId: string, { rejectWithValue }) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return projectId;
    } catch (error) {
      return rejectWithValue('Failed to delete project');
    }
  }
);

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setFilters: (state, action: PayloadAction<Partial<ProjectsState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = {};
    },
    setCurrentProject: (state, action: PayloadAction<Project | null>) => {
      state.currentProject = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Fetch projects
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.isLoading = false;
        state.projects = action.payload;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch project by ID
    builder
      .addCase(fetchProjectById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProjectById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentProject = action.payload;
      })
      .addCase(fetchProjectById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Create project
    builder
      .addCase(createProject.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.isLoading = false;
        state.projects.unshift(action.payload);
      })
      .addCase(createProject.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Update project
    builder
      .addCase(updateProject.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateProject.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.projects.findIndex(project => project.id === action.payload.id);
        if (index !== -1) {
          state.projects[index] = { ...state.projects[index], ...action.payload };
        }
        if (state.currentProject?.id === action.payload.id) {
          state.currentProject = { ...state.currentProject, ...action.payload };
        }
      })
      .addCase(updateProject.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Delete project
    builder
      .addCase(deleteProject.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.isLoading = false;
        state.projects = state.projects.filter(project => project.id !== action.payload);
        if (state.currentProject?.id === action.payload) {
          state.currentProject = null;
        }
      })
      .addCase(deleteProject.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setFilters, clearFilters, setCurrentProject } = projectsSlice.actions;
export default projectsSlice.reducer;