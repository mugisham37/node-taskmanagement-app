import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { CreateProjectData, Project, ProjectFilters, UpdateProjectData } from '@taskmanagement/types'

// Types
interface ProjectsState {
  projects: Project[]
  selectedProject: Project | null
  isLoading: boolean
  error: string | null
  filters: ProjectFilters
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

// Initial state
const initialState: ProjectsState = {
  projects: [],
  selectedProject: null,
  isLoading: false,
  error: null,
  filters: {},
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },
  sortBy: 'createdAt',
  sortOrder: 'desc',
}

// Async thunks
export const fetchProjects = createAsyncThunk(
  'projects/fetchProjects',
  async (params: {
    page?: number
    limit?: number
    filters?: ProjectFilters
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  } = {}, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams({
        page: (params.page || 1).toString(),
        limit: (params.limit || 20).toString(),
        sortBy: params.sortBy || 'createdAt',
        sortOrder: params.sortOrder || 'desc',
        ...params.filters,
      })

      const response = await fetch(`/api/projects?${queryParams}`)
      
      if (!response.ok) {
        const error = await response.json()
        return rejectWithValue(error.message || 'Failed to fetch projects')
      }

      const data = await response.json()
      return data
    } catch (error) {
      return rejectWithValue('Network error occurred')
    }
  }
)

export const fetchProjectById = createAsyncThunk(
  'projects/fetchProjectById',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`)
      
      if (!response.ok) {
        const error = await response.json()
        return rejectWithValue(error.message || 'Failed to fetch project')
      }

      const data = await response.json()
      return data
    } catch (error) {
      return rejectWithValue('Network error occurred')
    }
  }
)

export const createProject = createAsyncThunk(
  'projects/createProject',
  async (projectData: CreateProjectData, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      })

      if (!response.ok) {
        const error = await response.json()
        return rejectWithValue(error.message || 'Failed to create project')
      }

      const data = await response.json()
      return data
    } catch (error) {
      return rejectWithValue('Network error occurred')
    }
  }
)

export const updateProject = createAsyncThunk(
  'projects/updateProject',
  async ({ projectId, updates }: { projectId: string; updates: UpdateProjectData }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const error = await response.json()
        return rejectWithValue(error.message || 'Failed to update project')
      }

      const data = await response.json()
      return data
    } catch (error) {
      return rejectWithValue('Network error occurred')
    }
  }
)

export const deleteProject = createAsyncThunk(
  'projects/deleteProject',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        return rejectWithValue(error.message || 'Failed to delete project')
      }

      return projectId
    } catch (error) {
      return rejectWithValue('Network error occurred')
    }
  }
)

export const addProjectMember = createAsyncThunk(
  'projects/addProjectMember',
  async ({ projectId, userId, role }: { projectId: string; userId: string; role: string }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role }),
      })

      if (!response.ok) {
        const error = await response.json()
        return rejectWithValue(error.message || 'Failed to add project member')
      }

      const data = await response.json()
      return data
    } catch (error) {
      return rejectWithValue('Network error occurred')
    }
  }
)

export const removeProjectMember = createAsyncThunk(
  'projects/removeProjectMember',
  async ({ projectId, userId }: { projectId: string; userId: string }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/members/${userId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        return rejectWithValue(error.message || 'Failed to remove project member')
      }

      return { projectId, userId }
    } catch (error) {
      return rejectWithValue('Network error occurred')
    }
  }
)

// Projects slice
const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    setSelectedProject: (state, action: PayloadAction<Project | null>) => {
      state.selectedProject = action.payload
    },
    setFilters: (state, action: PayloadAction<ProjectFilters>) => {
      state.filters = action.payload
    },
    updateFilter: (state, action: PayloadAction<{ key: string; value: any }>) => {
      state.filters = {
        ...state.filters,
        [action.payload.key]: action.payload.value,
      }
    },
    clearFilters: (state) => {
      state.filters = {}
    },
    setSorting: (state, action: PayloadAction<{ sortBy: string; sortOrder: 'asc' | 'desc' }>) => {
      state.sortBy = action.payload.sortBy
      state.sortOrder = action.payload.sortOrder
    },
    setPagination: (state, action: PayloadAction<{ page: number; limit: number }>) => {
      state.pagination.page = action.payload.page
      state.pagination.limit = action.payload.limit
    },
    optimisticUpdateProject: (state, action: PayloadAction<{ projectId: string; updates: Partial<Project> }>) => {
      const { projectId, updates } = action.payload
      const projectIndex = state.projects.findIndex(project => project.id === projectId)
      if (projectIndex !== -1) {
        state.projects[projectIndex] = { ...state.projects[projectIndex], ...updates }
      }
      if (state.selectedProject?.id === projectId) {
        state.selectedProject = { ...state.selectedProject, ...updates }
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch projects
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.isLoading = false
        state.projects = action.payload.projects
        state.pagination = action.payload.pagination
        state.error = null
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Fetch project by ID
    builder
      .addCase(fetchProjectById.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchProjectById.fulfilled, (state, action) => {
        state.isLoading = false
        state.selectedProject = action.payload
        state.error = null
      })
      .addCase(fetchProjectById.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Create project
    builder
      .addCase(createProject.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.isLoading = false
        state.projects.unshift(action.payload)
        state.error = null
      })
      .addCase(createProject.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Update project
    builder
      .addCase(updateProject.fulfilled, (state, action) => {
        const updatedProject = action.payload
        const projectIndex = state.projects.findIndex(project => project.id === updatedProject.id)
        if (projectIndex !== -1) {
          state.projects[projectIndex] = updatedProject
        }
        if (state.selectedProject?.id === updatedProject.id) {
          state.selectedProject = updatedProject
        }
      })
      .addCase(updateProject.rejected, (state, action) => {
        state.error = action.payload as string
      })

    // Delete project
    builder
      .addCase(deleteProject.fulfilled, (state, action) => {
        const projectId = action.payload
        state.projects = state.projects.filter(project => project.id !== projectId)
        if (state.selectedProject?.id === projectId) {
          state.selectedProject = null
        }
      })
      .addCase(deleteProject.rejected, (state, action) => {
        state.error = action.payload as string
      })

    // Add project member
    builder
      .addCase(addProjectMember.fulfilled, (state, action) => {
        const updatedProject = action.payload
        const projectIndex = state.projects.findIndex(project => project.id === updatedProject.id)
        if (projectIndex !== -1) {
          state.projects[projectIndex] = updatedProject
        }
        if (state.selectedProject?.id === updatedProject.id) {
          state.selectedProject = updatedProject
        }
      })
      .addCase(addProjectMember.rejected, (state, action) => {
        state.error = action.payload as string
      })

    // Remove project member
    builder
      .addCase(removeProjectMember.fulfilled, (state, action) => {
        const { projectId, userId } = action.payload
        const projectIndex = state.projects.findIndex(project => project.id === projectId)
        if (projectIndex !== -1 && state.projects[projectIndex].members) {
          state.projects[projectIndex].members = state.projects[projectIndex].members?.filter(
            member => member.userId !== userId
          )
        }
        if (state.selectedProject?.id === projectId && state.selectedProject.members) {
          state.selectedProject.members = state.selectedProject.members.filter(
            member => member.userId !== userId
          )
        }
      })
      .addCase(removeProjectMember.rejected, (state, action) => {
        state.error = action.payload as string
      })
  },
})

// Export actions
export const {
  clearError,
  setSelectedProject,
  setFilters,
  updateFilter,
  clearFilters,
  setSorting,
  setPagination,
  optimisticUpdateProject,
} = projectsSlice.actions

// Selectors
export const selectProjects = (state: { projects: ProjectsState }) => state.projects.projects
export const selectSelectedProject = (state: { projects: ProjectsState }) => state.projects.selectedProject
export const selectProjectsLoading = (state: { projects: ProjectsState }) => state.projects.isLoading
export const selectProjectsError = (state: { projects: ProjectsState }) => state.projects.error
export const selectProjectsFilters = (state: { projects: ProjectsState }) => state.projects.filters
export const selectProjectsPagination = (state: { projects: ProjectsState }) => state.projects.pagination
export const selectProjectsSorting = (state: { projects: ProjectsState }) => ({
  sortBy: state.projects.sortBy,
  sortOrder: state.projects.sortOrder,
})

// Export reducer
export default projectsSlice.reducer