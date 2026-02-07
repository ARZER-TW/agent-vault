"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, type ReactNode } from "react";
import { useAuthStore } from "@/lib/store/auth-store";
import { restoreAuthSession } from "@/lib/auth/zklogin";

function AuthRestorer() {
  const { isLoggedIn, restore } = useAuthStore();

  useEffect(() => {
    if (isLoggedIn) return;

    const session = restoreAuthSession();
    if (session) {
      restore(session);
    }
  }, [isLoggedIn, restore]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthRestorer />
      {children}
    </QueryClientProvider>
  );
}
