'use client';

import { adminConfig } from '@/config/app.config';
import { ADMIN_ONLY_ROUTES, ADMIN_ROUTES, PUBLIC_ROUTES } from '@/config/routes.config';
import { useAppDispatch, useAppSelector } from '@/store';
import { getCurrentUserAsync, refreshTokenAsync } from '@/store/slices/authSlice';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();
  
  const { 
    isAuthenticated, 
    token, 
    refreshToken, 
    user, 
    roles,
    sessionExpiry,
    isLoading 
  } = useAppSelector((state) => state.auth);

  // Check if current route is public
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  
  // Check if current route requires admin privileges
  const isAdminOnlyRoute = ADMIN_ONLY_ROUTES.some(route => 
    pathname.startsWith(route.replace('[id]', ''))
  );

  // Check if user has admin role
  const hasAdminRole = roles.some(role => 
    adminConfig.auth.adminRoles.includes(role)
  );

  // Initialize authentication state
  useEffect(() => {
    const initAuth = async () => {
      // If we have a token but no user, try to get current user
      if (token && !user && !isLoading) {
        try {
          await dispatch(getCurrentUserAsync()).unwrap();
        } catch (error) {
          console.error('Failed to get current user:', error);
          // Token might be invalid, redirect to login
          if (!isPublicRoute) {
            router.replace(ADMIN_ROUTES.AUTH.LOGIN);
          }
        }
      }
    };

    initAuth();
  }, [dispatch, token, user, isLoading, router, isPublicRoute]);

  // Handle token refresh
  useEffect(() => {
    if (!refreshToken || !sessionExpiry) return;

    const refreshTokenBeforeExpiry = () => {
      const now = Date.now();
      const timeUntilExpiry = sessionExpiry - now;
      
      // Refresh token 5 minutes before expiry
      if (timeUntilExpiry <= 5 * 60 * 1000 && timeUntilExpiry > 0) {
        dispatch(refreshTokenAsync());
      }
    };

    // Check immediately
    refreshTokenBeforeExpiry();

    // Set up interval to check periodically
    const interval = setInterval(refreshTokenBeforeExpiry, 60 * 1000); // Check every minute

    return () => clearInterval(interval);
  }, [dispatch, refreshToken, sessionExpiry]);

  // Handle route protection
  useEffect(() => {
    if (isLoading) return;

    // Redirect unauthenticated users from protected routes
    if (!isAuthenticated && !isPublicRoute) {
      router.replace(ADMIN_ROUTES.AUTH.LOGIN);
      return;
    }

    // Redirect authenticated users from auth pages
    if (isAuthenticated && isPublicRoute && pathname !== ADMIN_ROUTES.AUTH.LOGOUT) {
      router.replace(ADMIN_ROUTES.DASHBOARD.OVERVIEW);
      return;
    }

    // Check admin-only routes
    if (isAuthenticated && isAdminOnlyRoute && !hasAdminRole) {
      // Redirect to dashboard if user doesn't have admin privileges
      router.replace(ADMIN_ROUTES.DASHBOARD.OVERVIEW);
      return;
    }
  }, [
    isAuthenticated, 
    isLoading, 
    isPublicRoute, 
    isAdminOnlyRoute, 
    hasAdminRole, 
    pathname, 
    router
  ]);

  // Handle session timeout
  useEffect(() => {
    if (!isAuthenticated || !sessionExpiry) return;

    const checkSessionTimeout = () => {
      const now = Date.now();
      if (now >= sessionExpiry) {
        // Session expired, redirect to login
        router.replace(ADMIN_ROUTES.AUTH.LOGIN);
      }
    };

    // Check immediately
    checkSessionTimeout();

    // Set up interval to check session timeout
    const interval = setInterval(checkSessionTimeout, 30 * 1000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated, sessionExpiry, router]);

  // Handle user activity tracking for session timeout
  useEffect(() => {
    if (!isAuthenticated) return;

    let inactivityTimer: NodeJS.Timeout;

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      
      inactivityTimer = setTimeout(() => {
        // User has been inactive, redirect to login
        router.replace(ADMIN_ROUTES.AUTH.LOGIN);
      }, adminConfig.security.inactivityTimeout);
    };

    const handleUserActivity = () => {
      resetInactivityTimer();
    };

    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, true);
    });

    // Start the timer
    resetInactivityTimer();

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity, true);
      });
    };
  }, [isAuthenticated, router]);

  return <>{children}</>;
}