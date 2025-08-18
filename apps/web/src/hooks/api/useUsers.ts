import { appConfig } from '@/config/app';
import { trpc } from '@/lib/trpc';
import { toast } from 'react-hot-toast';

export function useUsers() {
  const utils = trpc.useUtils();

  // Queries
  const {
    data: users,
    isLoading: isLoadingUsers,
    error: usersError,
  } = trpc.users.list.useQuery(
    {
      limit: appConfig.ui.maxPageSize,
    },
    {
      staleTime: appConfig.cache.staleTime,
    }
  );

  const getUser = (id: string) => {
    return trpc.users.getById.useQuery(
      { id },
      {
        enabled: !!id,
        staleTime: appConfig.cache.staleTime,
      }
    );
  };

  const getCurrentUserProfile = () => {
    return trpc.users.profile.useQuery(
      undefined,
      {
        staleTime: appConfig.cache.staleTime,
      }
    );
  };

  // Mutations
  const updateProfileMutation = trpc.users.updateProfile.useMutation({
    onMutate: async (updatedProfile) => {
      await utils.users.profile.cancel();

      const previousProfile = utils.users.profile.getData();

      utils.users.profile.setData(
        undefined,
        (old) => old ? { ...old, ...updatedProfile, updatedAt: new Date() } : undefined
      );

      return { previousProfile };
    },
    onError: (error, updatedProfile, context) => {
      if (context?.previousProfile) {
        utils.users.profile.setData(undefined, context.previousProfile);
      }
      toast.error(error.message || 'Failed to update profile');
    },
    onSuccess: () => {
      toast.success('Profile updated successfully');
    },
    onSettled: () => {
      utils.users.profile.invalidate();
      utils.auth.me.invalidate();
    },
  });

  const updateUserMutation = trpc.users.update.useMutation({
    onMutate: async (updatedUser) => {
      await utils.users.list.cancel();
      await utils.users.getById.cancel({ id: updatedUser.id });

      const previousUsers = utils.users.list.getData();
      const previousUser = utils.users.getById.getData({ id: updatedUser.id });

      // Optimistically update list
      utils.users.list.setData(
        { limit: appConfig.ui.maxPageSize },
        (old) => {
          if (!old) return { items: [], total: 0 };
          
          return {
            ...old,
            items: old.items.map((user) =>
              user.id === updatedUser.id
                ? { ...user, ...updatedUser, updatedAt: new Date() }
                : user
            ),
          };
        }
      );

      // Optimistically update single user
      utils.users.getById.setData(
        { id: updatedUser.id },
        (old) => old ? { ...old, ...updatedUser, updatedAt: new Date() } : undefined
      );

      return { previousUsers, previousUser };
    },
    onError: (error, updatedUser, context) => {
      if (context?.previousUsers) {
        utils.users.list.setData(
          { limit: appConfig.ui.maxPageSize },
          context.previousUsers
        );
      }
      if (context?.previousUser) {
        utils.users.getById.setData({ id: updatedUser.id }, context.previousUser);
      }
      toast.error(error.message || 'Failed to update user');
    },
    onSuccess: () => {
      toast.success('User updated successfully');
    },
    onSettled: (data, error, variables) => {
      utils.users.list.invalidate();
      utils.users.getById.invalidate({ id: variables.id });
    },
  });

  const deleteUserMutation = trpc.users.delete.useMutation({
    onMutate: async (userId) => {
      await utils.users.list.cancel();

      const previousUsers = utils.users.list.getData();

      utils.users.list.setData(
        { limit: appConfig.ui.maxPageSize },
        (old) => {
          if (!old) return { items: [], total: 0 };
          
          return {
            ...old,
            items: old.items.filter((user) => user.id !== userId),
            total: old.total - 1,
          };
        }
      );

      return { previousUsers };
    },
    onError: (error, userId, context) => {
      if (context?.previousUsers) {
        utils.users.list.setData(
          { limit: appConfig.ui.maxPageSize },
          context.previousUsers
        );
      }
      toast.error(error.message || 'Failed to delete user');
    },
    onSuccess: () => {
      toast.success('User deleted successfully');
    },
    onSettled: () => {
      utils.users.list.invalidate();
    },
  });

  // Helper functions
  const updateProfile = (profileData: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    avatar: string;
    timezone: string;
    language: string;
  }>) => {
    return updateProfileMutation.mutateAsync(profileData);
  };

  const updateUser = (id: string, updates: Partial<{
    firstName: string;
    lastName: string;
    email: string;
    role: 'user' | 'admin';
    status: 'active' | 'inactive' | 'suspended';
  }>) => {
    return updateUserMutation.mutateAsync({ id, ...updates });
  };

  const deleteUser = (id: string) => {
    return deleteUserMutation.mutateAsync(id);
  };

  return {
    // Data
    users: users?.items ?? [],
    isLoadingUsers,
    usersError,
    
    // Single user queries
    getUser,
    getCurrentUserProfile,
    
    // Actions
    updateProfile,
    updateUser,
    deleteUser,
    
    // Mutation states
    isUpdatingProfile: updateProfileMutation.isLoading,
    isUpdatingUser: updateUserMutation.isLoading,
    isDeletingUser: deleteUserMutation.isLoading,
    
    // Errors
    updateProfileError: updateProfileMutation.error,
    updateUserError: updateUserMutation.error,
    deleteUserError: deleteUserMutation.error,
  };
}