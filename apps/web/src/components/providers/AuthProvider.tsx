import { useRouter } from 'next/router'
import { ReactNode, useEffect } from 'react'

// Store
import { useAppDispatch, useAppSelector } from '@/store'
import {
  fetchCurrentUser,
  selectAuthLoading,
  selectIsAuthenticated,
  selectToken,
  updateLastActivity
} from '@/store/slices/authSlice'

// Config
import { appConfig } from '@/config/app'

interface AuthProviderProps {
  children: ReactNode
}

// Public routes that don't require authentication
const publicRoutes = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/privacy',
  '/terms',
]

// Routes that should redirect authenticated users
const guestOnlyRoutes = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
]

export function AuthProvider({ children }: AuthProviderProps) {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const token = useAppSelector(selectToken)
  const isLoading = useAppSelector(selectAuthLoading)

  // Check if current route is public
  const isPublicRoute = publicRoutes.some(route => {
    if (route === '/') return router.pathname === '/'
    return router.pathname.startsWith(route)
  })

  // Check if current route is guest-only
  const isGuestOnlyRoute = guestOnlyRoutes.some(route => 
    router.pathname.startsWith(route)
  )

  // Initialize authentication state
  useEffect(() => {
    if (token && !isAuthenticated) {
      dispatch(fetchCurrentUser())
    }
  }, [dispatch, token, isAuthenticated])

  // Handle route protection
  useEffect(() => {
    if (isLoading) return // Wait for auth check to complete

    if (!isAuthenticated && !isPublicRoute) {
      // Redirect to login if not authenticated and trying to access protected route
      const returnUrl = router.asPath !== '/' ? router.asPath : '/dashboard'
      router.replace(`/login?returnUrl=${encodeURIComponent(returnUrl)}`)
    } else if (isAuthenticated && isGuestOnlyRoute) {
      // Redirect to dashboard if authenticated and trying to access guest-only route
      const returnUrl = router.query.returnUrl as string
      router.replace(returnUrl && returnUrl !== '/' ? returnUrl : '/dashboard')
    }
  }, [isAuthenticated, isLoading, isPublicRoute, isGuestOnlyRoute, router])

  // Track user activity for session management
  useEffect(() => {
    if (!isAuthenticated) return

    const handleActivity = () => {
      dispatch(updateLastActivity())
    }

    // Track various user activities
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true })
    })

    // Initial activity update
    handleActivity()

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity)
      })
    }
  }, [dispatch, isAuthenticated])

  // Session timeout check
  useEffect(() => {
    if (!isAuthenticated || !token) return

    const checkSessionTimeout = () => {
      const lastActivity = localStorage.getItem('lastActivity')
      if (lastActivity) {
        const timeSinceLastActivity = Date.now() - parseInt(lastActivity)
        if (timeSinceLastActivity > appConfig.auth.sessionTimeout) {
          // Session expired, redirect to login
          router.replace('/login?reason=session-expired')
        }
      }
    }

    // Check session timeout every minute
    const interval = setInterval(checkSessionTimeout, 60000)

    return () => clearInterval(interval)
  }, [isAuthenticated, token, router])

  // Auto-refresh token
  useEffect(() => {
    if (!isAuthenticated || !token) return

    // Refresh token 5 minutes before expiration
    const refreshInterval = setInterval(() => {
      // This would decode the JWT and check expiration
      // For now, we'll refresh every 30 minutes
      dispatch(fetchCurrentUser())
    }, 30 * 60 * 1000) // 30 minutes

    return () => clearInterval(refreshInterval)
  }, [dispatch, isAuthenticated, token])

  return <>{children}</>
}