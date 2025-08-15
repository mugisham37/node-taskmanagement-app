import { createTRPCNext } from "@trpc/next";
import { httpBatchLink, loggerLink } from "@trpc/client";
import { type AppRouter } from "@taskmanagement/server/trpc/router";
import superjson from "superjson";

const getBaseUrl = () => {
  if (typeof window !== "undefined") return ""; // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
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
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          headers() {
            const token = typeof window !== "undefined" ? localStorage.getItem("auth-token") : null;
            return {
              authorization: token ? `Bearer ${token}` : "",
            };
          },
        }),
      ],
      queryClientConfig: {
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            cacheTime: 10 * 60 * 1000, // 10 minutes
            retry: 3,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 1,
          },
        },
      },
    };
  },
  ssr: false,
});

export type RouterInputs = AppRouter["_def"]["_config"]["$types"]["input"];
export type RouterOutputs = AppRouter["_def"]["_config"]["$types"]["output"];