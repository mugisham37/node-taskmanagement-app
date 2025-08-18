import { appConfig } from '@/config/app';
import { trpc } from '@/lib/trpc';
import { toast } from 'react-hot-toast';

export function useTasks() {
  const utils = trpc.useUtils();

  // Queries
  const {
    data: tasks,
    isLoading: isLoadingTasks,
    error: tasksError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.tasks.list.useInfiniteQuery(
    {
      limit: appConfig.ui.pageSize,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      staleTime: appConfig.cache.staleTime,
    }
  );

  const getTask = (id: string) => {
    return trpc.tasks.getById.useQuery(
      { id },
      {
        enabled: !!id,
        staleTime: appConfig.cache.staleTime,
      }
    );
  };

  // Mutations
  const createTaskMutation = trpc.tasks.create.useMutation({
    onMutate: async (newTask) => {
      // Cancel outgoing refetches
      await utils.tasks.list.cancel();

      // Snapshot previous value
      const previousTasks = utils.tasks.list.getInfiniteData();

      // Optimistically update
      utils.tasks.list.setInfiniteData(
        { limit: appConfig.ui.pageSize },
        (old) => {
          if (!old) return { pages: [], pageParams: [] };
          
          const newTaskWithId = {
            ...newTask,
            id: `temp-${Date.now()}`,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          return {
            ...old,
            pages: old.pages.map((page, index) => 
              index === 0 
                ? { ...page, items: [newTaskWithId, ...page.items] }
                : page
            ),
          };
        }
      );

      return { previousTasks };
    },
    onError: (error, newTask, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        utils.tasks.list.setInfiniteData(
          { limit: appConfig.ui.pageSize },
          context.previousTasks
        );
      }
      toast.error(error.message || 'Failed to create task');
    },
    onSuccess: (data) => {
      toast.success('Task created successfully');
    },
    onSettled: () => {
      // Always refetch after error or success
      utils.tasks.list.invalidate();
    },
  });

  const updateTaskMutation = trpc.tasks.update.useMutation({
    onMutate: async (updatedTask) => {
      await utils.tasks.list.cancel();
      await utils.tasks.getById.cancel({ id: updatedTask.id });

      const previousTasks = utils.tasks.list.getInfiniteData();
      const previousTask = utils.tasks.getById.getData({ id: updatedTask.id });

      // Optimistically update list
      utils.tasks.list.setInfiniteData(
        { limit: appConfig.ui.pageSize },
        (old) => {
          if (!old) return { pages: [], pageParams: [] };
          
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((task) =>
                task.id === updatedTask.id
                  ? { ...task, ...updatedTask, updatedAt: new Date() }
                  : task
              ),
            })),
          };
        }
      );

      // Optimistically update single task
      utils.tasks.getById.setData(
        { id: updatedTask.id },
        (old) => old ? { ...old, ...updatedTask, updatedAt: new Date() } : undefined
      );

      return { previousTasks, previousTask };
    },
    onError: (error, updatedTask, context) => {
      if (context?.previousTasks) {
        utils.tasks.list.setInfiniteData(
          { limit: appConfig.ui.pageSize },
          context.previousTasks
        );
      }
      if (context?.previousTask) {
        utils.tasks.getById.setData({ id: updatedTask.id }, context.previousTask);
      }
      toast.error(error.message || 'Failed to update task');
    },
    onSuccess: () => {
      toast.success('Task updated successfully');
    },
    onSettled: (data, error, variables) => {
      utils.tasks.list.invalidate();
      utils.tasks.getById.invalidate({ id: variables.id });
    },
  });

  const deleteTaskMutation = trpc.tasks.delete.useMutation({
    onMutate: async (taskId) => {
      await utils.tasks.list.cancel();

      const previousTasks = utils.tasks.list.getInfiniteData();

      utils.tasks.list.setInfiniteData(
        { limit: appConfig.ui.pageSize },
        (old) => {
          if (!old) return { pages: [], pageParams: [] };
          
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((task) => task.id !== taskId),
            })),
          };
        }
      );

      return { previousTasks };
    },
    onError: (error, taskId, context) => {
      if (context?.previousTasks) {
        utils.tasks.list.setInfiniteData(
          { limit: appConfig.ui.pageSize },
          context.previousTasks
        );
      }
      toast.error(error.message || 'Failed to delete task');
    },
    onSuccess: () => {
      toast.success('Task deleted successfully');
    },
    onSettled: () => {
      utils.tasks.list.invalidate();
    },
  });

  // Helper functions
  const createTask = (taskData: {
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high';
    dueDate?: Date;
    projectId?: string;
  }) => {
    return createTaskMutation.mutateAsync(taskData);
  };

  const updateTask = (id: string, updates: Partial<{
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    status: 'todo' | 'in_progress' | 'completed';
    dueDate: Date;
    projectId: string;
  }>) => {
    return updateTaskMutation.mutateAsync({ id, ...updates });
  };

  const deleteTask = (id: string) => {
    return deleteTaskMutation.mutateAsync(id);
  };

  const loadMoreTasks = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  // Flatten paginated data
  const allTasks = tasks?.pages.flatMap((page) => page.items) ?? [];

  return {
    // Data
    tasks: allTasks,
    isLoadingTasks,
    tasksError,
    hasNextPage,
    isFetchingNextPage,
    
    // Single task query
    getTask,
    
    // Actions
    createTask,
    updateTask,
    deleteTask,
    loadMoreTasks,
    
    // Mutation states
    isCreatingTask: createTaskMutation.isLoading,
    isUpdatingTask: updateTaskMutation.isLoading,
    isDeletingTask: deleteTaskMutation.isLoading,
    
    // Errors
    createTaskError: createTaskMutation.error,
    updateTaskError: updateTaskMutation.error,
    deleteTaskError: deleteTaskMutation.error,
  };
}