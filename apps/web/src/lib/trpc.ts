import { appConfig } from '@/config/app'
import type { AppRouter } from '@taskmanagement/types/api'
import { httpBatchLink, loggerLink, splitLink, wsLink } from '@trpc/client'
import { createTRPCNext } from '@trpc/next'
import { createTRPCReact } from '@trpc/react-query'
import { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import superjson from 'superjson'

// Create tRPC React hooks
export const trpc = createTRPCReact<AppRouter>()

// Create tRPC Next.js client
export const trpcNext = createTRPCNext<AppRouter>({
  config({ ctx }) {
    return {
      transformer: superjson,
      links: [
        loggerLink({
          enabled: (opts) =>
            appConfig.isDevelopment ||
            (opts.direction === 'down' && opts.result instanceof Error),
        }),
        splitLink({
          condition(op) {
            return op.type === 'subscription'
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
                : ctx?.req?.headers?.authorization?.replace('Bearer ', '')

              return {
                authorization: token ? `Bearer ${token}` : '',
                'x-client-type': 'web',
              }
            },
          }),
        }),
      ],
      queryClientConfig: {
        defaultOptions: {
          queries: {
            staleTime: appConfig.cache.staleTime,
            cacheTime: appConfig.cache.cacheTime,
            retry: (failureCount: number, error: any) => {
              // Don't retry on 4xx errors
              if (error?.data?.httpStatus >= 400 && error?.data?.httpStatus < 500) {
                return false
              }
              return failureCount < appConfig.api.retries
            },
            retryDelay: (attemptIndex: number) => 
              Math.min(appConfig.api.retryDelay * Math.pow(2, attemptIndex), 30000),
          },
          mutations: {
            retry: false,
          },
        },
      },
    }
  },
  ssr: false, // We'll handle SSR manually where needed
})

// Type inference helpers
export type RouterInputs = inferRouterInputs<AppRouter>
export type RouterOutputs = inferRouterOutputs<AppRouter>

// Utility function to get tRPC client for server-side usage
export function createTRPCClient(token?: string) {
  return trpc.createClient({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: `${appConfig.apiUrl}/trpc`,
        headers: {
          authorization: token ? `Bearer ${token}` : '',
          'x-client-type': 'web-server',
        },
      }),
    ],
  })
}