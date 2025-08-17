import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  projectId?: string;
  assigneeId?: string;
  createdBy: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  attachments: string[];
  comments: number;
  subtasks: string[];
}

interface TasksState {
  tasks: Task[];
  currentTask: Task | null;
  isLoading: boolean;
  error: string | null;
  filters: {
    status?: Task['status'];
    priority?: Task['priority'];
    assigneeId?: string;
    projectId?: string;
    search?: string;
  };
  sortBy: 'dueDate' | 'priority' | 'createdAt' | 'title';
  sortOrder: 'asc' | 'desc';
}

const initialState: TasksState = {
  tasks: [],
  currentTask: null,
  isLoading: false,
  error: null,
  filters: {},
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

// Mock data
const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Design user interface',
    description: 'Create wireframes and mockups for the new feature',
    status: 'TODO',
    priority: 'HIGH',
    projectId: 'project-1',
    assigneeId: 'user-1',
    createdBy: 'user-2',
    dueDate: '2024-02-15T00:00:00Z',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    tags: ['design', 'ui'],
    attachments: [],
    comments: 3,
    subtasks: [],
  },
  {
    id: '2',
    title: 'Implement authentication',
    description: 'Add login and registration functionality',
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    projectId: 'project-1',
    assigneeId: 'user-1',
    createdBy: 'user-1',
    dueDate: '2024-02-20T00:00:00Z',
    createdAt: '2024-01-16T09:00:00Z',
    updatedAt: '2024-01-18T14:30:00Z',
    tags: ['backend', 'auth'],
    attachments: [],
    comments: 1,
    subtasks: ['subtask-1', 'subtask-2'],
  },
];

// Async thunks
export const fetchTasks = createAsyncThunk(
  'tasks/fetchTasks',
  async (filters?: Partial<TasksState['filters']>, { rejectWithValue }) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      let filteredTasks = [...mockTasks];
      
      if (filters?.status) {
        filteredTasks = filteredTasks.filter(task => task.status === filters.status);
      }
      
      if (filters?.priority) {
        filteredTasks = filteredTasks.filter(task => task.priority === filters.priority);
      }
      
      if (filters?.projectId) {
        filteredTasks = filteredTasks.filter(task => task.projectId === filters.projectId);
      }
      
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        filteredTasks = filteredTasks.filter(task => 
          task.title.toLowerCase().includes(searchLower) ||
          task.description?.toLowerCase().includes(searchLower)
        );
      }
      
      return filteredTasks;
    } catch (error) {
      return rejectWithValue('Failed to fetch tasks');
    }
  }
);

export const fetchTaskById = createAsyncThunk(
  'tasks/fetchTaskById',
  async (taskId: string, { rejectWithValue }) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const task = mockTasks.find(t => t.id === taskId);
      if (!task) {
        throw new Error('Task not found');
      }
      
      return task;
    } catch (error) {
      return rejectWithValue('Failed to fetch task');
    }
  }
);

export const createTask = createAsyncThunk(
  'tasks/createTask',
  async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'comments'>, { rejectWithValue }) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const newTask: Task = {
        ...taskData,
        id: `task-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        comments: 0,
      };
      
      return newTask;
    } catch (error) {
      return rejectWithValue('Failed to create task');
    }
  }
);

export const updateTask = createAsyncThunk(
  'tasks/updateTask',
  async ({ taskId, updates }: { taskId: string; updates: Partial<Task> }, { rejectWithValue }) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const updatedTask = {
        ...updates,
        id: taskId,
        updatedAt: new Date().toISOString(),
      };
      
      return updatedTask;
    } catch (error) {
      return rejectWithValue('Failed to update task');
    }
  }
);

export const deleteTask = createAsyncThunk(
  'tasks/deleteTask',
  async (taskId: string, { rejectWithValue }) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return taskId;
    } catch (error) {
      return rejectWithValue('Failed to delete task');
    }
  }
);

const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setFilters: (state, action: PayloadAction<Partial<TasksState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = {};
    },
    setSorting: (state, action: PayloadAction<{ sortBy: TasksState['sortBy']; sortOrder: TasksState['sortOrder'] }>) => {
      state.sortBy = action.payload.sortBy;
      state.sortOrder = action.payload.sortOrder;
    },
    setCurrentTask: (state, action: PayloadAction<Task | null>) => {
      state.currentTask = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Fetch tasks
    builder
      .addCase(fetchTasks.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tasks = action.payload;
      })
      .addCase(fetchTasks.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch task by ID
    builder
      .addCase(fetchTaskById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTaskById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentTask = action.payload;
      })
      .addCase(fetchTaskById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Create task
    builder
      .addCase(createTask.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createTask.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tasks.unshift(action.payload);
      })
      .addCase(createTask.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Update task
    builder
      .addCase(updateTask.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateTask.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.tasks.findIndex(task => task.id === action.payload.id);
        if (index !== -1) {
          state.tasks[index] = { ...state.tasks[index], ...action.payload };
        }
        if (state.currentTask?.id === action.payload.id) {
          state.currentTask = { ...state.currentTask, ...action.payload };
        }
      })
      .addCase(updateTask.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Delete task
    builder
      .addCase(deleteTask.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteTask.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tasks = state.tasks.filter(task => task.id !== action.payload);
        if (state.currentTask?.id === action.payload) {
          state.currentTask = null;
        }
      })
      .addCase(deleteTask.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setFilters, clearFilters, setSorting, setCurrentTask } = tasksSlice.actions;
export default tasksSlice.reducer;