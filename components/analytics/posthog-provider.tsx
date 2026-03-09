'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { initAnalytics, track } from '@/lib/analytics';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize PostHog once on mount
  useEffect(() => {
    initAnalytics();
  }, []);

  // Track route changes as pageviews
  useEffect(() => {
    if (pathname) {
      track('$pageview', {
        $current_url: window.location.href,
        $pathname: pathname,
      });
    }
  }, [pathname, searchParams]);

  return <>{children}</>;
}
