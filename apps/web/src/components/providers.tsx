"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { DemoModeBanner } from "@/components/layout/demo-mode-banner";
import { TourProvider, TourButton } from "@/components/tour/tour-provider";
import { RichToastProvider } from "@/components/ui/use-toast";
import { KeyboardProvider } from "@/components/keyboard/keyboard-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { DemoModeProvider } from "@/lib/demo-mode";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 seconds
            retry: (failureCount, error) => {
              // Don't retry on 4xx errors
              if (error && typeof error === "object" && "status" in error) {
                const status = (error as { status: number }).status;
                if (status >= 400 && status < 500) return false;
              }
              return failureCount < 3;
            },
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: false,
          },
        },
      })
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <KeyboardProvider>
            <TourProvider>
              <RichToastProvider>
                <DemoModeProvider>
                  <DemoModeBanner />
                  {children}
                  <TourButton />
                </DemoModeProvider>
              </RichToastProvider>
            </TourProvider>
          </KeyboardProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

