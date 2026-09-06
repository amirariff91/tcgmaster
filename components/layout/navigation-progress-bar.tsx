'use client';

import * as React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isVisible, setIsVisible] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Complete and hide progress bar when route finishes changing
  React.useEffect(() => {
    if (isVisible) {
      setProgress(100);
      const hideTimer = setTimeout(() => {
        setIsVisible(false);
        setProgress(0);
      }, 250);
      return () => clearTimeout(hideTimer);
    }
  }, [pathname, searchParams]);

  // Intercept clicks on internal links to start progress instantly (< 1ms)
  React.useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a');

      if (!anchor) return;

      const href = anchor.getAttribute('href');
      const targetAttr = anchor.getAttribute('target');

      // Only trigger for standard left clicks on internal relative links or same origin
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        (targetAttr && targetAttr !== '_self') ||
        !href ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      ) {
        return;
      }

      try {
        const url = new URL(href, window.location.href);
        if (url.origin === window.location.origin) {
          // Check if it's the exact same page & search params (ignore if nothing to load)
          if (url.pathname === window.location.pathname && url.search === window.location.search) {
            return;
          }

          // Start instant progress
          setIsVisible(true);
          setProgress(25);

          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            setProgress((prev) => {
              if (prev >= 88) {
                if (timerRef.current) clearInterval(timerRef.current);
                return prev;
              }
              return prev + (88 - prev) * 0.2;
            });
          }, 150);
        }
      } catch (e) {
        // Not a valid URL, ignore
      }
    };

    document.addEventListener('click', handleClick, { capture: true });

    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!isVisible && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none bg-transparent overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-cyan-400 shadow-[0_0_12px_rgba(249,115,22,0.8)] transition-all ease-out duration-200"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transitionProperty: 'width, opacity',
        }}
      />
    </div>
  );
}
