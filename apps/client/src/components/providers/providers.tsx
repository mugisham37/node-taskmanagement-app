"use client";

import { TRPCProvider } from "./trpc-provider";
import { AuthProvider } from "./auth-provider";
import { ThemeProvider } from "./theme-provider";
import { ToastProvider } from "./toast-provider";
import { RealtimeProvider } from "./realtime-provider";
import { ErrorProvider } from "./error-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorProvider>
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
    </ErrorProvider>
  );
}