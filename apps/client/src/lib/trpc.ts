import { type AppRouter } from "@taskmanagement/server/trpc/router";
import { getCacheManager } from "@taskmanagement/shared/cache";
import { httpBatchLink, loggerLink, splitLink, unstable_httpSubscriptionLink } from "@trpc/client";
import { createTRPCNext } from "@trpc/next";
import superjson from "superjson";

const getBaseUrl = () => {
  if (typeof window !== "undefined") return ""; // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
};

// Enhanced HTTP link with caching
const createCachedHttpLink = () => {
  const cacheManager = getCacheManager();
  
  return httpBatchLink({
    url: `${getBaseUrl()}/api/trpc`,
    maxURLLength: 2083,
    headers() {
      const token = typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;
      return {
        authorization: token ? `Bearer ${token}` : "",
        'x-client-cache': cacheManager ? 'enabled' : 'disabled',
      };
    },
    fetch: async (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = init?.method || 'GET';
      
      // Only cache GET requests
      if (method === 'GET' && cacheManager) {
        const cacheKey = `trpc:${url}`;
        
        // Try cache first for GET requests
        const cached = await cacheManager.get(cacheKey);
        if (cached) {
          return new Response(JSON.stringify(cached), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        
        // Fetch from network and cache
        const response = await fetch(input, init);
        if (response.ok) {
          const data = await response.clone().json();
          await cacheManager.set(cacheKey, data, 300); // 5 minutes
        }
        return response;
      }
      
      return fetch(input, init);
    },
  });
};

export const trpc = createTRPCNext<AppRouter>({
  config() {
    return {
      transformer: superjson,
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error),
        }),
        splitLink({
          condition: (op) => op.type === 'subscription',
          true: unstable_httpSubscriptionLink({
            url: `${getBaseUrl()}/api/trpc`,
          }),
          false: createCachedHttpLink(),
        }),
      ],
      queryClientConfig: {
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
            retry: (failureCount, error: any) => {
              // Don't retry on 4xx errors
              if (error?.data?.httpStatus >= 400 && error?.data?.httpStatus < 500) {
                return false;
              }
              return failureCount < 3;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            refetchOnMount: true,
            // Enable background refetching
            refetchInterval: (data, query) => {
              // Refetch active queries every 5 minutes
              return query.state.isError ? false : 5 * 60 * 1000;
            },
            // Network mode for offline support
            networkMode: 'offlineFirst',
          },
          mutations: {
            retry: 1,
            networkMode: 'offlineFirst',
            onError: (error) => {
              console.error('Mutation error:', error);
            },
          },
        },
      },
    };
  },
  ssr: false,
});

// Enhanced query invalidation
export const invalidateQueries = async (pattern: string) => {
  const queryClient = trpc.useContext().client;
  const cacheManager = getCacheManager();
  
  // Invalidate React Query cache
  await queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey.join(':');
      return new RegExp(pattern.replace(/\*/g, '.*')).test(key);
    },
  });
  
  // Invalidate server cache
  if (cacheManager) {
    await cacheManager.invalidateQueries(pattern);
  }
};

// Prefetch utilities
export const prefetchQuery = async (
  queryKey: any[],
  queryFn: () => Promise<any>,
  options: { staleTime?: number } = {}
) => {
  const queryClient = trpc.useContext().client;
  
  return queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime: options.staleTime || 5 * 60 * 1000,
  });
};

// Cache warming utilities
export const warmCache = async (userId: string) => {
  const cacheManager = getCacheManager();
  if (!cacheManager) return;
  
  await cacheManager.warmUserData(userId);
};

export type RouterInputs = AppRouter["_def"]["_config"]["$types"]["input"];
export type RouterOutputs = AppRouter["_def"]["_config"]["$types"]["output"];