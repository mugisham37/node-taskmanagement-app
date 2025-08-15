"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { TRPCErrorHandler } from "@/lib/trpc-error-handler";
import { ClientErrorHandler } from "@/lib/error-handler";

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 10 * 60 * 1000, // 10 minutes
        retry: (failureCount, error) => {
          // Use tRPC error handler for retry logic
          const normalizedError = TRPCErrorHandler.normalizeTRPCError(error);
          
          // Don't retry validation errors or client errors
          if (normalizedError.statusCode < 500) {
            return false;
          }

          // Retry up to 3 times for server errors
          return failureCount < 3;
        },
        retryDelay: (attemptIndex) => {
          // Exponential backoff with jitter
          const baseDelay = Math.min(1000 * Math.pow(2, attemptIndex), 30000);
          return baseDelay + Math.random() * 1000;
        },
        refetchOnWindowFocus: false,
        onError: (error) => {
          // Handle query errors
          TRPCErrorHandler.createQueryErrorHandler('unknown_query')(error);
        },
      },
      mutations: {
        retry: false, // Don't retry mutations by default
        onError: (error) => {
          // Handle mutation errors
          const normalizedError = TRPCErrorHandler.normalizeTRPCError(error);
          ClientErrorHandler.handle(normalizedError, {
            type: 'mutation',
            source: 'trpc',
          });
        },
      },
    },
  }));

  const [trpcClient] = useState(() => trpc.createClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </trpc.Provider>
  );
}