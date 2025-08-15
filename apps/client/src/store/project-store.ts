import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

// Define types locally since shared package might not be available yet
interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

enum ProjectStatus {
  ACTIVE = "active",
  COMPLETED = "completed",
  ARCHIVED = "archived",
}

interface OptimisticUpdate {
  id: string;
  updates: Partial<Project>;
  timestamp: Date;
  confirmed: boolean;
}

interface ConflictData {
  projectId: string;
  localChanges: Partial<Project>;
  serverChanges: Partial<Project>;
  strategy: 'server-wins' | 'client-wins' | 'merge' | 'prompt-user';
}

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  optimisticUpdates: Map<string, OptimisticUpdate>;
  conflicts: ConflictData[];

  // Actions
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  removeProject: (id: string) => void;
  setCurrentProject: (project: Project | null) => void;
  setLoading: (loading: boolean) => void;

  // Optimistic updates
  setOptimisticUpdate: (id: string, updates: Partial<Project>) => void;
  removeOptimisticUpdate: (id: string) => void;
  confirmOptimisticUpdate: (id: string) => void;

  // Conflict resolution
  handleConflict: (projectId: string, localChanges: Partial<Project>, serverChanges: Partial<Project>, strategy: ConflictData['strategy']) => void;
  resolveConflict: (projectId: string, resolution: Partial<Project>) => void;
  clearConflicts: () => void;

  // Computed
  getActiveProjects: () => Project[];
  getCompletedProjects: () => Project[];
  getProjectById: (id: string) => Project | undefined;
  getProjectWithOptimisticUpdates: (id: string) => Project | undefined;
}

export const useProjectStore = create<ProjectState>()(
  devtools(
    persist(
      (set, get) => ({
        projects: [],
        currentProject: null,
        isLoading: false,
        optimisticUpdates: new Map(),
        conflicts: [],

        setProjects: (projects) => set({ projects }),
        
        addProject: (project) =>
          set((state) => ({
            projects: [...state.projects, project],
          })),
        
        updateProject: (id, updates) =>
          set((state) => ({
            projects: state.projects.map((project) =>
              project.id === id ? { ...project, ...updates, updatedAt: new Date() } : project
            ),
            currentProject:
              state.currentProject?.id === id
                ? { ...state.currentProject, ...updates, updatedAt: new Date() }
                : state.currentProject,
          })),
        
        removeProject: (id) =>
          set((state) => ({
            projects: state.projects.filter((project) => project.id !== id),
            currentProject:
              state.currentProject?.id === id ? null : state.currentProject,
            optimisticUpdates: new Map(
              [...state.optimisticUpdates].filter(([key]) => key !== id)
            ),
          })),
        
        setCurrentProject: (project) => set({ currentProject: project }),
        
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
              projects: state.projects.map((project) =>
                project.id === id ? { ...project, ...updates, updatedAt: new Date() } : project
              ),
              currentProject:
                state.currentProject?.id === id
                  ? { ...state.currentProject, ...updates, updatedAt: new Date() }
                  : state.currentProject,
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
        handleConflict: (projectId, localChanges, serverChanges, strategy) =>
          set((state) => {
            const newConflicts = [...state.conflicts];
            const existingConflictIndex = newConflicts.findIndex(c => c.projectId === projectId);
            
            const conflictData: ConflictData = {
              projectId,
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
            let resolvedUpdates: Partial<Project> = {};
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
              projects: state.projects.map((project) =>
                project.id === projectId ? { ...project, ...resolvedUpdates, updatedAt: new Date() } : project
              ),
              currentProject:
                state.currentProject?.id === projectId
                  ? { ...state.currentProject, ...resolvedUpdates, updatedAt: new Date() }
                  : state.currentProject,
            };
          }),

        resolveConflict: (projectId, resolution) =>
          set((state) => ({
            conflicts: state.conflicts.filter(c => c.projectId !== projectId),
            projects: state.projects.map((project) =>
              project.id === projectId ? { ...project, ...resolution, updatedAt: new Date() } : project
            ),
            currentProject:
              state.currentProject?.id === projectId
                ? { ...state.currentProject, ...resolution, updatedAt: new Date() }
                : state.currentProject,
          })),

        clearConflicts: () => set({ conflicts: [] }),

        getActiveProjects: () => {
          const { projects } = get();
          return projects.filter((project) => project.status === ProjectStatus.ACTIVE);
        },

        getCompletedProjects: () => {
          const { projects } = get();
          return projects.filter((project) => project.status === ProjectStatus.COMPLETED);
        },

        getProjectById: (id) => {
          const { projects } = get();
          return projects.find((project) => project.id === id);
        },

        getProjectWithOptimisticUpdates: (id) => {
          const { projects, optimisticUpdates } = get();
          const project = projects.find(p => p.id === id);
          if (!project) return undefined;

          const optimisticUpdate = optimisticUpdates.get(id);
          if (optimisticUpdate && !optimisticUpdate.confirmed) {
            return { ...project, ...optimisticUpdate.updates };
          }

          return project;
        },
      }),
      {
        name: "project-store",
        partialize: (state) => ({
          projects: state.projects,
          currentProject: state.currentProject,
        }),
      }
    )
  )
);