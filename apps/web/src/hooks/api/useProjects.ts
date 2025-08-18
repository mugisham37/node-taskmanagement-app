import { appConfig } from '@/config/app';
import { trpc } from '@/lib/trpc';
import { toast } from 'react-hot-toast';

export function useProjects() {
  const utils = trpc.useUtils();

  // Queries
  const {
    data: projects,
    isLoading: isLoadingProjects,
    error: projectsError,
  } = trpc.projects.list.useQuery(
    {
      limit: appConfig.ui.maxPageSize,
    },
    {
      staleTime: appConfig.cache.staleTime,
    }
  );

  const getProject = (id: string) => {
    return trpc.projects.getById.useQuery(
      { id },
      {
        enabled: !!id,
        staleTime: appConfig.cache.staleTime,
      }
    );
  };

  const getProjectTasks = (projectId: string) => {
    return trpc.tasks.list.useInfiniteQuery(
      {
        projectId,
        limit: appConfig.ui.pageSize,
      },
      {
        enabled: !!projectId,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        staleTime: appConfig.cache.staleTime,
      }
    );
  };

  // Mutations
  const createProjectMutation = trpc.projects.create.useMutation({
    onMutate: async (newProject) => {
      await utils.projects.list.cancel();

      const previousProjects = utils.projects.list.getData();

      utils.projects.list.setData(
        { limit: appConfig.ui.maxPageSize },
        (old) => {
          if (!old) return { items: [], total: 0 };
          
          const newProjectWithId = {
            ...newProject,
            id: `temp-${Date.now()}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            tasksCount: 0,
          };

          return {
            items: [newProjectWithId, ...old.items],
            total: old.total + 1,
          };
        }
      );

      return { previousProjects };
    },
    onError: (error, newProject, context) => {
      if (context?.previousProjects) {
        utils.projects.list.setData(
          { limit: appConfig.ui.maxPageSize },
          context.previousProjects
        );
      }
      toast.error(error.message || 'Failed to create project');
    },
    onSuccess: () => {
      toast.success('Project created successfully');
    },
    onSettled: () => {
      utils.projects.list.invalidate();
    },
  });

  const updateProjectMutation = trpc.projects.update.useMutation({
    onMutate: async (updatedProject) => {
      await utils.projects.list.cancel();
      await utils.projects.getById.cancel({ id: updatedProject.id });

      const previousProjects = utils.projects.list.getData();
      const previousProject = utils.projects.getById.getData({ id: updatedProject.id });

      // Optimistically update list
      utils.projects.list.setData(
        { limit: appConfig.ui.maxPageSize },
        (old) => {
          if (!old) return { items: [], total: 0 };
          
          return {
            ...old,
            items: old.items.map((project) =>
              project.id === updatedProject.id
                ? { ...project, ...updatedProject, updatedAt: new Date() }
                : project
            ),
          };
        }
      );

      // Optimistically update single project
      utils.projects.getById.setData(
        { id: updatedProject.id },
        (old) => old ? { ...old, ...updatedProject, updatedAt: new Date() } : undefined
      );

      return { previousProjects, previousProject };
    },
    onError: (error, updatedProject, context) => {
      if (context?.previousProjects) {
        utils.projects.list.setData(
          { limit: appConfig.ui.maxPageSize },
          context.previousProjects
        );
      }
      if (context?.previousProject) {
        utils.projects.getById.setData({ id: updatedProject.id }, context.previousProject);
      }
      toast.error(error.message || 'Failed to update project');
    },
    onSuccess: () => {
      toast.success('Project updated successfully');
    },
    onSettled: (data, error, variables) => {
      utils.projects.list.invalidate();
      utils.projects.getById.invalidate({ id: variables.id });
    },
  });

  const deleteProjectMutation = trpc.projects.delete.useMutation({
    onMutate: async (projectId) => {
      await utils.projects.list.cancel();

      const previousProjects = utils.projects.list.getData();

      utils.projects.list.setData(
        { limit: appConfig.ui.maxPageSize },
        (old) => {
          if (!old) return { items: [], total: 0 };
          
          return {
            ...old,
            items: old.items.filter((project) => project.id !== projectId),
            total: old.total - 1,
          };
        }
      );

      return { previousProjects };
    },
    onError: (error, projectId, context) => {
      if (context?.previousProjects) {
        utils.projects.list.setData(
          { limit: appConfig.ui.maxPageSize },
          context.previousProjects
        );
      }
      toast.error(error.message || 'Failed to delete project');
    },
    onSuccess: () => {
      toast.success('Project deleted successfully');
    },
    onSettled: () => {
      utils.projects.list.invalidate();
    },
  });

  // Helper functions
  const createProject = (projectData: {
    name: string;
    description?: string;
    color?: string;
  }) => {
    return createProjectMutation.mutateAsync(projectData);
  };

  const updateProject = (id: string, updates: Partial<{
    name: string;
    description: string;
    color: string;
    status: 'active' | 'completed' | 'archived';
  }>) => {
    return updateProjectMutation.mutateAsync({ id, ...updates });
  };

  const deleteProject = (id: string) => {
    return deleteProjectMutation.mutateAsync(id);
  };

  return {
    // Data
    projects: projects?.items ?? [],
    isLoadingProjects,
    projectsError,
    
    // Single project queries
    getProject,
    getProjectTasks,
    
    // Actions
    createProject,
    updateProject,
    deleteProject,
    
    // Mutation states
    isCreatingProject: createProjectMutation.isLoading,
    isUpdatingProject: updateProjectMutation.isLoading,
    isDeletingProject: deleteProjectMutation.isLoading,
    
    // Errors
    createProjectError: createProjectMutation.error,
    updateProjectError: updateProjectMutation.error,
    deleteProjectError: deleteProjectMutation.error,
  };
}