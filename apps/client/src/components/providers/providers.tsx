"use client";

import { AuthProvider } from "./auth-provider";
import { ErrorProvider } from "./error-provider";
import { PerformanceProvider } from "./performance-provider";
import { RealtimeProvider } from "./realtime-provider";
import { ThemeProvider } from "./theme-provider";
import { ToastProvider } from "./toast-provider";
import { TRPCProvider } from "./trpc-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorProvider>
      <PerformanceProvider>
        <ThemeProvider>
          <TRPCProvider>
            <AuthProvider>
              <RealtimeProvider>
                <ToastProvider>
                  {children}
                </ToastProvider>
              </RealtimeProvider>
            </AuthProvider>
          </TRPCProvider>
        </ThemeProvider>
      </PerformanceProvider>
    </ErrorProvider>
  );
}