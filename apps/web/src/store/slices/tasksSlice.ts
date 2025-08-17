import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { CreateTaskData, Task, TaskFilters, UpdateTaskData } from '@taskmanagement/types'

// Types
interface TasksState {
  tasks: Task[]
  selectedTask: Task | null
  isLoading: boolean
  error: string | null
  filters: TaskFilters
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
const initialState: TasksState = {
  tasks: [],
  selectedTask: null,
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
export const fetchTasks = createAsyncThunk(
  'tasks/fetchTasks',
  async (params: {
    page?: number
    limit?: number
    filters?: TaskFilters
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

      const response = await fetch(`/api/tasks?${queryParams}`)
      
      if (!response.ok) {
        const error = await response.json()
        return rejectWithValue(error.message || 'Failed to fetch tasks')
      }

      const data = await response.json()
      return data
    } catch (error) {
      return rejectWithValue('Network error occurred')
    }
  }
)

export const fetchTaskById = createAsyncThunk(
  'tasks/fetchTaskById',
  async (taskId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`)
      
      if (!response.ok) {
        const error = await response.json()
        return rejectWithValue(error.message || 'Failed to fetch task')
      }

      const data = await response.json()
      return data
    } catch (error) {
      return rejectWithValue('Network error occurred')
    }
  }
)

export const createTask = createAsyncThunk(
  'tasks/createTask',
  async (taskData: CreateTaskData, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      })

      if (!response.ok) {
        const error = await response.json()
        return rejectWithValue(error.message || 'Failed to create task')
      }

      const data = await response.json()
      return data
    } catch (error) {
      return rejectWithValue('Network error occurred')
    }
  }
)

export const updateTask = createAsyncThunk(
  'tasks/updateTask',
  async ({ taskId, updates }: { taskId: string; updates: UpdateTaskData }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const error = await response.json()
        return rejectWithValue(error.message || 'Failed to update task')
      }

      const data = await response.json()
      return data
    } catch (error) {
      return rejectWithValue('Network error occurred')
    }
  }
)

export const deleteTask = createAsyncThunk(
  'tasks/deleteTask',
  async (taskId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        return rejectWithValue(error.message || 'Failed to delete task')
      }

      return taskId
    } catch (error) {
      return rejectWithValue('Network error occurred')
    }
  }
)

export const assignTask = createAsyncThunk(
  'tasks/assignTask',
  async ({ taskId, userId }: { taskId: string; userId: string }, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) {
        const error = await response.json()
        return rejectWithValue(error.message || 'Failed to assign task')
      }

      const data = await response.json()
      return data
    } catch (error) {
      return rejectWithValue('Network error occurred')
    }
  }
)

export const completeTask = createAsyncThunk(
  'tasks/completeTask',
  async (taskId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/complete`, {
        method: 'POST',
      })

      if (!response.ok) {
        const error = await response.json()
        return rejectWithValue(error.message || 'Failed to complete task')
      }

      const data = await response.json()
      return data
    } catch (error) {
      return rejectWithValue('Network error occurred')
    }
  }
)

// Tasks slice
const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    setSelectedTask: (state, action: PayloadAction<Task | null>) => {
      state.selectedTask = action.payload
    },
    setFilters: (state, action: PayloadAction<TaskFilters>) => {
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
    optimisticUpdateTask: (state, action: PayloadAction<{ taskId: string; updates: Partial<Task> }>) => {
      const { taskId, updates } = action.payload
      const taskIndex = state.tasks.findIndex(task => task.id === taskId)
      if (taskIndex !== -1) {
        state.tasks[taskIndex] = { ...state.tasks[taskIndex], ...updates }
      }
      if (state.selectedTask?.id === taskId) {
        state.selectedTask = { ...state.selectedTask, ...updates }
      }
    },
    revertOptimisticUpdate: (state, action: PayloadAction<string>) => {
      // This would revert optimistic updates if the API call fails
      // Implementation depends on how you want to handle rollbacks
    },
  },
  extraReducers: (builder) => {
    // Fetch tasks
    builder
      .addCase(fetchTasks.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.isLoading = false
        state.tasks = action.payload.tasks
        state.pagination = action.payload.pagination
        state.error = null
      })
      .addCase(fetchTasks.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Fetch task by ID
    builder
      .addCase(fetchTaskById.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchTaskById.fulfilled, (state, action) => {
        state.isLoading = false
        state.selectedTask = action.payload
        state.error = null
      })
      .addCase(fetchTaskById.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Create task
    builder
      .addCase(createTask.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(createTask.fulfilled, (state, action) => {
        state.isLoading = false
        state.tasks.unshift(action.payload)
        state.error = null
      })
      .addCase(createTask.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Update task
    builder
      .addCase(updateTask.fulfilled, (state, action) => {
        const updatedTask = action.payload
        const taskIndex = state.tasks.findIndex(task => task.id === updatedTask.id)
        if (taskIndex !== -1) {
          state.tasks[taskIndex] = updatedTask
        }
        if (state.selectedTask?.id === updatedTask.id) {
          state.selectedTask = updatedTask
        }
      })
      .addCase(updateTask.rejected, (state, action) => {
        state.error = action.payload as string
      })

    // Delete task
    builder
      .addCase(deleteTask.fulfilled, (state, action) => {
        const taskId = action.payload
        state.tasks = state.tasks.filter(task => task.id !== taskId)
        if (state.selectedTask?.id === taskId) {
          state.selectedTask = null
        }
      })
      .addCase(deleteTask.rejected, (state, action) => {
        state.error = action.payload as string
      })

    // Assign task
    builder
      .addCase(assignTask.fulfilled, (state, action) => {
        const updatedTask = action.payload
        const taskIndex = state.tasks.findIndex(task => task.id === updatedTask.id)
        if (taskIndex !== -1) {
          state.tasks[taskIndex] = updatedTask
        }
        if (state.selectedTask?.id === updatedTask.id) {
          state.selectedTask = updatedTask
        }
      })
      .addCase(assignTask.rejected, (state, action) => {
        state.error = action.payload as string
      })

    // Complete task
    builder
      .addCase(completeTask.fulfilled, (state, action) => {
        const updatedTask = action.payload
        const taskIndex = state.tasks.findIndex(task => task.id === updatedTask.id)
        if (taskIndex !== -1) {
          state.tasks[taskIndex] = updatedTask
        }
        if (state.selectedTask?.id === updatedTask.id) {
          state.selectedTask = updatedTask
        }
      })
      .addCase(completeTask.rejected, (state, action) => {
        state.error = action.payload as string
      })
  },
})

// Export actions
export const {
  clearError,
  setSelectedTask,
  setFilters,
  updateFilter,
  clearFilters,
  setSorting,
  setPagination,
  optimisticUpdateTask,
  revertOptimisticUpdate,
} = tasksSlice.actions

// Selectors
export const selectTasks = (state: { tasks: TasksState }) => state.tasks.tasks
export const selectSelectedTask = (state: { tasks: TasksState }) => state.tasks.selectedTask
export const selectTasksLoading = (state: { tasks: TasksState }) => state.tasks.isLoading
export const selectTasksError = (state: { tasks: TasksState }) => state.tasks.error
export const selectTasksFilters = (state: { tasks: TasksState }) => state.tasks.filters
export const selectTasksPagination = (state: { tasks: TasksState }) => state.tasks.pagination
export const selectTasksSorting = (state: { tasks: TasksState }) => ({
  sortBy: state.tasks.sortBy,
  sortOrder: state.tasks.sortOrder,
})

// Export reducer
export default tasksSlice.reducer