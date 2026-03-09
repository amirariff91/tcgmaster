'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Suspense, useState } from 'react';
import { CurrencyProvider } from '@/lib/currency-context';
import { PostHogProvider } from '@/components/analytics/posthog-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <CurrencyProvider>
          <Suspense>
            <PostHogProvider>{children}</PostHogProvider>
          </Suspense>
        </CurrencyProvider>
      </NuqsAdapter>
    </QueryClientProvider>
  );
}
