'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface AutoRefreshProps {
  interval?: number;
}

export function AutoRefresh({ interval = 15000 }: AutoRefreshProps) {
  const router = useRouter();
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const scheduleNextRefresh = () => {
      timer = setTimeout(async () => {
        if (!isRefreshingRef.current) {
          isRefreshingRef.current = true;
          try {
            router.refresh();
          } finally {
            isRefreshingRef.current = false;
          }
        }
        scheduleNextRefresh();
      }, interval);
    };

    scheduleNextRefresh();

    return () => clearTimeout(timer);
  }, [interval, router]);

  return null;
}
