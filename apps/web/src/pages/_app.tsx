import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ThemeProvider } from 'next-themes'
import type { AppProps } from 'next/app'
import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'

// Store
import { persistor, store } from '@/store'

// Styles
import '@/styles/globals.css'

// Components
import { AuthProvider } from '@/components/providers/AuthProvider'
import { WebSocketProvider } from '@/components/providers/WebSocketProvider'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

// Utils
import { appConfig } from '@/config/app'

function MyApp({ Component, pageProps }: AppProps) {
  // Create a client
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: appConfig.cache.staleTime,
            cacheTime: appConfig.cache.cacheTime,
            retry: (failureCount, error: any) => {
              // Don't retry on 4xx errors
              if (error?.status >= 400 && error?.status < 500) {
                return false
              }
              return failureCount < 3
            },
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 1,
          },
        },
      })
  )

  return (
    <ErrorBoundary>
      <Provider store={store}>
        <PersistGate loading={<LoadingSpinner />} persistor={persistor}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider
              attribute="class"
              defaultTheme={appConfig.theme.defaultTheme}
              storageKey={appConfig.theme.storageKey}
              enableSystem
            >
              <AuthProvider>
                <WebSocketProvider>
                  <Component {...pageProps} />
                  
                  {/* Global UI Components */}
                  <Toaster
                    position="top-right"
                    toastOptions={{
                      duration: appConfig.ui.toastDuration,
                      style: {
                        background: 'var(--toast-bg)',
                        color: 'var(--toast-color)',
                        border: '1px solid var(--toast-border)',
                      },
                    }}
                  />
                  
                  {/* Development Tools */}
                  {appConfig.isDevelopment && (
                    <ReactQueryDevtools initialIsOpen={false} />
                  )}
                </WebSocketProvider>
              </AuthProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  )
}

export default MyApp