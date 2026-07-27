"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { AuthGate } from "@/components/layout/AuthGate";
import { ToastProvider } from "@/components/ui/Toast";

/**
 * Client-side providers: TanStack Query + the toast context.
 * Instantiated once per app via a lazy state initializer.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthGate>{children}</AuthGate>
      </ToastProvider>
    </QueryClientProvider>
  );
}
