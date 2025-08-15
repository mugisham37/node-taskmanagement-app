"use client";

import { Toaster } from "@taskmanagement/ui";

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}