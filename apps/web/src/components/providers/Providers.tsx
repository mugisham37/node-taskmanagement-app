'use client';

import { appConfig } from '@/config/app';
import { trpc } from '@/lib/trpc';
import { persistor, store } from '@/store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { httpBatchLink, loggerLink, splitLink, wsLink } from '@trpc/client';
import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import superjson from 'superjson';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: appConfig.cache.staleTime,
            cacheTime: appConfig.cache.cacheTime,
            retry: (failureCount: number, error: any) => {
              // Don't retry on 4xx errors
              if (error?.data?.httpStatus >= 400 && error?.data?.httpStatus < 500) {
                return false;
              }
              return failureCount < appConfig.api.retries;
            },
            retryDelay: (attemptIndex: number) => 
              Math.min(appConfig.api.retryDelay * Math.pow(2, attemptIndex), 30000),
          },
          mutations: {
            retry: false,
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      transformer: superjson,
      links: [
        loggerLink({
          enabled: (opts) =>
            appConfig.isDevelopment ||
            (opts.direction === 'down' && opts.result instanceof Error),
        }),
        splitLink({
          condition(op) {
            return op.type === 'subscription';
          },
          true: wsLink({
            url: appConfig.wsUrl.replace('ws://', 'ws://').replace('wss://', 'wss://') + '/trpc',
            transformer: superjson,
          }),
          false: httpBatchLink({
            url: `${appConfig.apiUrl}/trpc`,
            transformer: superjson,
            headers() {
              const token = typeof window !== 'undefined' 
                ? localStorage.getItem(appConfig.auth.tokenKey)
                : undefined;

              return {
                authorization: token ? `Bearer ${token}` : '',
                'x-client-type': 'web',
              };
            },
          }),
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Provider store={store}>
          <PersistGate loading={<div>Loading...</div>} persistor={persistor}>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#10B981',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: '#EF4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
            <ReactQueryDevtools initialIsOpen={false} />
          </PersistGate>
        </Provider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}