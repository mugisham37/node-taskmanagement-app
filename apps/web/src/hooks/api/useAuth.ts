import { appConfig } from '@/config/app';
import { trpc } from '@/lib/trpc';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export function useAuth() {
  const router = useRouter();
  const utils = trpc.useUtils();

  // Queries
  const { data: user, isLoading: isLoadingUser, error: userError } = trpc.auth.me.useQuery(
    undefined,
    {
      retry: false,
      staleTime: appConfig.cache.staleTime,
    }
  );

  // Mutations
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      // Store tokens
      localStorage.setItem(appConfig.auth.tokenKey, data.token);
      if (data.refreshToken) {
        localStorage.setItem(appConfig.auth.refreshTokenKey, data.refreshToken);
      }
      
      // Invalidate user query to refetch
      utils.auth.me.invalidate();
      
      toast.success('Login successful!');
      router.push('/dashboard');
    },
    onError: (error) => {
      toast.error(error.message || 'Login failed');
    },
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || 'Registration successful!');
      router.push('/auth/verify-email');
    },
    onError: (error) => {
      toast.error(error.message || 'Registration failed');
    },
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      // Clear tokens
      localStorage.removeItem(appConfig.auth.tokenKey);
      localStorage.removeItem(appConfig.auth.refreshTokenKey);
      
      // Clear all queries
      utils.invalidate();
      
      toast.success('Logged out successfully');
      router.push('/auth/login');
    },
    onError: (error) => {
      toast.error(error.message || 'Logout failed');
    },
  });

  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || 'Password changed successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Password change failed');
    },
  });

  const resetPasswordMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || 'Password reset email sent');
    },
    onError: (error) => {
      toast.error(error.message || 'Password reset failed');
    },
  });

  const verifyEmailMutation = trpc.auth.verifyEmail.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || 'Email verified successfully');
      router.push('/auth/login');
    },
    onError: (error) => {
      toast.error(error.message || 'Email verification failed');
    },
  });

  const refreshTokenMutation = trpc.auth.refreshToken.useMutation({
    onSuccess: (data) => {
      localStorage.setItem(appConfig.auth.tokenKey, data.token);
      if (data.refreshToken) {
        localStorage.setItem(appConfig.auth.refreshTokenKey, data.refreshToken);
      }
      utils.auth.me.invalidate();
    },
  });

  // Helper functions
  const login = (credentials: { email: string; password: string }) => {
    return loginMutation.mutateAsync(credentials);
  };

  const register = (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => {
    return registerMutation.mutateAsync(userData);
  };

  const logout = () => {
    return logoutMutation.mutateAsync();
  };

  const changePassword = (passwords: {
    currentPassword: string;
    newPassword: string;
  }) => {
    return changePasswordMutation.mutateAsync(passwords);
  };

  const resetPassword = (email: string) => {
    return resetPasswordMutation.mutateAsync({ email });
  };

  const verifyEmail = (token: string) => {
    return verifyEmailMutation.mutateAsync({ token });
  };

  const refreshToken = () => {
    const refreshToken = localStorage.getItem(appConfig.auth.refreshTokenKey);
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    return refreshTokenMutation.mutateAsync({ refreshToken });
  };

  const isAuthenticated = !!user && !userError;
  const isLoading = isLoadingUser || loginMutation.isLoading || registerMutation.isLoading;

  return {
    // State
    user,
    isAuthenticated,
    isLoading,
    isLoadingUser,
    
    // Actions
    login,
    register,
    logout,
    changePassword,
    resetPassword,
    verifyEmail,
    refreshToken,
    
    // Mutation states
    isLoggingIn: loginMutation.isLoading,
    isRegistering: registerMutation.isLoading,
    isLoggingOut: logoutMutation.isLoading,
    isChangingPassword: changePasswordMutation.isLoading,
    isResettingPassword: resetPasswordMutation.isLoading,
    isVerifyingEmail: verifyEmailMutation.isLoading,
    
    // Errors
    loginError: loginMutation.error,
    registerError: registerMutation.error,
    userError,
  };
}