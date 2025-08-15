import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

// Define types locally since shared package might not be available yet
interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string;
  assigneeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

enum TaskStatus {
  TODO = "todo",
  IN_PROGRESS = "in-progress",
  DONE = "done",
}

enum TaskPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

interface TaskFilter {
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  projectId?: string;
  search?: string;
}

interface OptimisticUpdate {
  id: string;
  updates: Partial<Task>;
  timestamp: Date;
  confirmed: boolean;
}

interface ConflictData {
  taskId: string;
  localChanges: Partial<Task>;
  serverChanges: Partial<Task>;
  strategy: 'server-wins' | 'client-wins' | 'merge' | 'prompt-user';
}

interface TaskState {
  tasks: Task[];
  filters: TaskFilter;
  selectedTasks: Set<string>;
  isLoading: boolean;
  optimisticUpdates: Map<string, OptimisticUpdate>;
  conflicts: ConflictData[];

  // Actions
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  setFilters: (filters: Partial<TaskFilter>) => void;
  clearFilters: () => void;
  toggleTaskSelection: (taskId: string) => void;
  clearSelection: () => void;
  setLoading: (loading: boolean) => void;

  // Optimistic updates
  setOptimisticUpdate: (id: string, updates: Partial<Task>) => void;
  removeOptimisticUpdate: (id: string) => void;
  confirmOptimisticUpdate: (id: string) => void;

  // Conflict resolution
  handleConflict: (taskId: string, localChanges: Partial<Task>, serverChanges: Partial<Task>, strategy: ConflictData['strategy']) => void;
  resolveConflict: (taskId: string, resolution: Partial<Task>) => void;
  clearConflicts: () => void;

  // Computed
  getFilteredTasks: () => Task[];
  getTasksByStatus: (status: TaskStatus) => Task[];
  getTasksByPriority: (priority: TaskPriority) => Task[];
  getTaskWithOptimisticUpdates: (id: string) => Task | undefined;
}

export const useTaskStore = create<TaskState>()(
  devtools(
    persist(
      (set, get) => ({
        tasks: [],
        filters: {},
        selectedTasks: new Set(),
        isLoading: false,
        optimisticUpdates: new Map(),
        conflicts: [],

        setTasks: (tasks) => set({ tasks }),
        
        addTask: (task) =>
          set((state) => ({
            tasks: [...state.tasks, task],
          })),
        
        updateTask: (id, updates) =>
          set((state) => ({
            tasks: state.tasks.map((task) =>
              task.id === id ? { ...task, ...updates, updatedAt: new Date() } : task
            ),
          })),
        
        removeTask: (id) =>
          set((state) => ({
            tasks: state.tasks.filter((task) => task.id !== id),
            selectedTasks: new Set(
              [...state.selectedTasks].filter((taskId) => taskId !== id)
            ),
            optimisticUpdates: new Map(
              [...state.optimisticUpdates].filter(([key]) => key !== id)
            ),
          })),
        
        setFilters: (filters) =>
          set((state) => ({
            filters: { ...state.filters, ...filters },
          })),
        
        clearFilters: () => set({ filters: {} }),
        
        toggleTaskSelection: (taskId) =>
          set((state) => {
            const newSelection = new Set(state.selectedTasks);
            if (newSelection.has(taskId)) {
              newSelection.delete(taskId);
            } else {
              newSelection.add(taskId);
            }
            return { selectedTasks: newSelection };
          }),
        
        clearSelection: () => set({ selectedTasks: new Set() }),
        
        setLoading: (loading) => set({ isLoading: loading }),

        // Optimistic updates
        setOptimisticUpdate: (id, updates) =>
          set((state) => {
            const newOptimisticUpdates = new Map(state.optimisticUpdates);
            newOptimisticUpdates.set(id, {
              id,
              updates,
              timestamp: new Date(),
              confirmed: false,
            });
            
            return {
              optimisticUpdates: newOptimisticUpdates,
              tasks: state.tasks.map((task) =>
                task.id === id ? { ...task, ...updates, updatedAt: new Date() } : task
              ),
            };
          }),

        removeOptimisticUpdate: (id) =>
          set((state) => {
            const newOptimisticUpdates = new Map(state.optimisticUpdates);
            newOptimisticUpdates.delete(id);
            return { optimisticUpdates: newOptimisticUpdates };
          }),

        confirmOptimisticUpdate: (id) =>
          set((state) => {
            const newOptimisticUpdates = new Map(state.optimisticUpdates);
            const update = newOptimisticUpdates.get(id);
            if (update) {
              newOptimisticUpdates.set(id, { ...update, confirmed: true });
            }
            return { optimisticUpdates: newOptimisticUpdates };
          }),

        // Conflict resolution
        handleConflict: (taskId, localChanges, serverChanges, strategy) =>
          set((state) => {
            const newConflicts = [...state.conflicts];
            const existingConflictIndex = newConflicts.findIndex(c => c.taskId === taskId);
            
            const conflictData: ConflictData = {
              taskId,
              localChanges,
              serverChanges,
              strategy,
            };

            if (existingConflictIndex >= 0) {
              newConflicts[existingConflictIndex] = conflictData;
            } else {
              newConflicts.push(conflictData);
            }

            // Apply resolution strategy
            let resolvedUpdates: Partial<Task> = {};
            switch (strategy) {
              case 'server-wins':
                resolvedUpdates = serverChanges;
                break;
              case 'client-wins':
                resolvedUpdates = localChanges;
                break;
              case 'merge':
                resolvedUpdates = { ...serverChanges, ...localChanges };
                break;
              case 'prompt-user':
                // Don't auto-resolve, wait for user input
                return { conflicts: newConflicts };
            }

            return {
              conflicts: newConflicts,
              tasks: state.tasks.map((task) =>
                task.id === taskId ? { ...task, ...resolvedUpdates, updatedAt: new Date() } : task
              ),
            };
          }),

        resolveConflict: (taskId, resolution) =>
          set((state) => ({
            conflicts: state.conflicts.filter(c => c.taskId !== taskId),
            tasks: state.tasks.map((task) =>
              task.id === taskId ? { ...task, ...resolution, updatedAt: new Date() } : task
            ),
          })),

        clearConflicts: () => set({ conflicts: [] }),

        getFilteredTasks: () => {
          const { tasks, filters } = get();
          return tasks.filter((task) => {
            if (filters.status && task.status !== filters.status) return false;
            if (filters.priority && task.priority !== filters.priority) return false;
            if (filters.assigneeId && task.assigneeId !== filters.assigneeId) return false;
            if (filters.projectId && task.projectId !== filters.projectId) return false;
            if (filters.search) {
              const searchLower = filters.search.toLowerCase();
              return (
                task.title.toLowerCase().includes(searchLower) ||
                task.description?.toLowerCase().includes(searchLower)
              );
            }
            return true;
          });
        },

        getTasksByStatus: (status) => {
          const { tasks } = get();
          return tasks.filter((task) => task.status === status);
        },

        getTasksByPriority: (priority) => {
          const { tasks } = get();
          return tasks.filter((task) => task.priority === priority);
        },

        getTaskWithOptimisticUpdates: (id) => {
          const { tasks, optimisticUpdates } = get();
          const task = tasks.find(t => t.id === id);
          if (!task) return undefined;

          const optimisticUpdate = optimisticUpdates.get(id);
          if (optimisticUpdate && !optimisticUpdate.confirmed) {
            return { ...task, ...optimisticUpdate.updates };
          }

          return task;
        },
      }),
      {
        name: "task-store",
        partialize: (state) => ({
          tasks: state.tasks,
          filters: state.filters,
        }),
      }
    )
  )
);