'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface CardImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  priority?: boolean;
  blurDataURL?: string;
  showPlaceholderText?: boolean;
}

const sizeConfig = {
  sm: { className: 'w-16 sm:w-20' },
  md: { className: 'w-24 sm:w-28 md:w-32' },
  lg: { className: 'w-40 sm:w-48 md:w-52' },
  xl: { className: 'w-56 sm:w-64 md:w-72' },
  hero: { className: 'w-full max-w-sm sm:max-w-md' },
};

// Default blur placeholder (10x14px gradient)
const DEFAULT_BLUR_PLACEHOLDER =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjZDRkNGQ4Ii8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjYTFhMWFhIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNnKSIvPjwvc3ZnPg==';

// Placeholder component for missing or errored images (defined at module level)
interface PlaceholderProps {
  showText?: boolean;
  alt: string;
  className?: string;
  sizeClassName: string;
}

function Placeholder({ showText = true, alt, className, sizeClassName }: PlaceholderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-lg bg-gradient-to-br from-zinc-200 to-zinc-300',
        sizeClassName,
        className
      )}
      style={{ aspectRatio: '5/7' }}
      role="img"
      aria-label={`Placeholder for ${alt}`}
    >
      {showText && (
        <span className="text-4xl text-zinc-400 select-none" aria-hidden="true">
          ?
        </span>
      )}
    </div>
  );
}

// Loading skeleton with shimmer effect (defined at module level)
function LoadingSkeleton({ alt, className, sizeClassName }: Omit<PlaceholderProps, 'showText'>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg bg-gradient-to-br from-zinc-200 to-zinc-300',
        sizeClassName,
        className
      )}
      style={{ aspectRatio: '5/7' }}
      role="img"
      aria-label={`Loading ${alt}`}
    >
      <div className="absolute inset-0 animate-shimmer" />
    </div>
  );
}

export function CardImage({
  src,
  alt,
  className,
  size = 'md',
  priority = false,
  blurDataURL,
  showPlaceholderText = true,
}: CardImageProps) {
  const [loadingState, setLoadingState] = React.useState<'loading' | 'loaded' | 'error'>(
    src ? 'loading' : 'error'
  );
  const config = sizeConfig[size];

  // Reset loading state when src changes
  React.useEffect(() => {
    if (src) {
      setLoadingState('loading');
    } else {
      setLoadingState('error');
    }
  }, [src]);

  // Show placeholder if no source
  if (!src) {
    return (
      <Placeholder
        showText={showPlaceholderText}
        alt={alt}
        className={className}
        sizeClassName={config.className}
      />
    );
  }

  // Show error state
  if (loadingState === 'error') {
    return (
      <Placeholder
        showText={showPlaceholderText}
        alt={alt}
        className={className}
        sizeClassName={config.className}
      />
    );
  }

  return (
    <div className={cn('relative overflow-hidden rounded-lg', config.className, className)}>
      {/* Show loading skeleton while image loads */}
      {loadingState === 'loading' && (
        <div className="absolute inset-0 z-10">
          <LoadingSkeleton alt={alt} className={className} sizeClassName={config.className} />
        </div>
      )}

      {/* The actual image with blur-up transition */}
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        placeholder={blurDataURL ? 'blur' : 'empty'}
        blurDataURL={blurDataURL || DEFAULT_BLUR_PLACEHOLDER}
        unoptimized={src.startsWith('http')}
        onLoad={() => setLoadingState('loaded')}
        onError={() => setLoadingState('error')}
        className={cn(
          'h-auto w-full object-contain transition-all duration-300',
          loadingState === 'loading' && 'opacity-0 scale-105',
          loadingState === 'loaded' && 'opacity-100 scale-100'
        )}
        style={{ aspectRatio: '5/7' }}
        sizes={
          size === 'hero'
            ? '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 384px'
            : size === 'xl'
            ? '(max-width: 640px) 224px, (max-width: 768px) 256px, 288px'
            : '(max-width: 640px) 80px, (max-width: 768px) 112px, 128px'
        }
      />
    </div>
  );
}

// Lazy-loaded variant that only loads when visible
interface LazyCardImageProps extends CardImageProps {
  rootMargin?: string;
  threshold?: number;
}

export function LazyCardImage({
  rootMargin = '100px',
  threshold = 0.1,
  ...props
}: LazyCardImageProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const config = sizeConfig[props.size || 'md'];

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold }
    );

    const el = containerRef.current;
    if (el) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  if (!isVisible) {
    return (
      <div
        ref={containerRef}
        className={cn(
          'relative overflow-hidden rounded-lg bg-gradient-to-br from-zinc-200 to-zinc-300',
          config.className,
          props.className
        )}
        style={{ aspectRatio: '5/7' }}
      >
        <div className="absolute inset-0 animate-shimmer" />
      </div>
    );
  }

  return <CardImage {...props} />;
}

// Thumbnail variant optimized for small sizes in lists
interface CardThumbnailProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  name?: string;
}

export function CardThumbnail({ src, alt, className, name }: CardThumbnailProps) {
  const [hasError, setHasError] = React.useState(false);

  // Show letter avatar for missing images
  if (!src || hasError) {
    const initial = (name || alt)?.[0]?.toUpperCase() || '?';
    return (
      <div
        className={cn(
          'flex h-12 w-10 items-center justify-center rounded bg-gradient-to-br from-zinc-200 to-zinc-300',
          className
        )}
        role="img"
        aria-label={`${alt} thumbnail`}
      >
        <span className="text-sm font-semibold text-zinc-500 select-none">
          {initial}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('relative h-12 w-10 overflow-hidden rounded', className)}>
      <Image
        src={src}
        alt={alt}
        width={40}
        height={56}
        onError={() => setHasError(true)}
        className="h-full w-full object-cover"
        unoptimized={src.startsWith('http')}
      />
    </div>
  );
}

// Higher-order component for image error boundary
interface CardImageWithErrorBoundaryProps extends CardImageProps {
  fallback?: React.ReactNode;
}

export function CardImageWithErrorBoundary({
  fallback,
  ...props
}: CardImageWithErrorBoundaryProps) {
  const [hasError, setHasError] = React.useState(false);
  const config = sizeConfig[props.size || 'md'];

  if (hasError) {
    return (
      fallback || (
        <div
          className={cn(
            'flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50',
            config.className,
            props.className
          )}
          style={{ aspectRatio: '5/7' }}
        >
          <span className="text-3xl text-zinc-400">!</span>
          <span className="mt-1 text-xs text-zinc-500 text-center px-2">{props.alt}</span>
        </div>
      )
    );
  }

  return (
    <CardImageErrorBoundary onError={() => setHasError(true)}>
      <CardImage {...props} />
    </CardImageErrorBoundary>
  );
}

// Simple error boundary for catching render errors
class CardImageErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}
