'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BackToTopProps {
  /** Number of screens to scroll before showing the button */
  showAfterScreens?: number;
  className?: string;
}

export function BackToTop({ showAfterScreens = 2, className }: BackToTopProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      // Calculate threshold based on viewport height
      const threshold = window.innerHeight * showAfterScreens;
      const scrolled = window.scrollY;

      setIsVisible(scrolled > threshold);
    }

    // Check initial state
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showAfterScreens]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      className={cn(
        'fixed bottom-6 right-6 z-40',
        'flex items-center justify-center',
        'w-12 h-12 rounded-full',
        'bg-zinc-900 text-white',
        'shadow-lg shadow-zinc-900/20',
        'hover:bg-zinc-800',
        'focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2',
        'transition-all duration-200',
        'animate-in fade-in-0 zoom-in-95 duration-200',
        className
      )}
      aria-label="Back to top"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
