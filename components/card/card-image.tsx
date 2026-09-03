'use client';

import * as React from 'react';
import Image from 'next/image';
import cloudflareImageLoader, { isImageCdnEnabled, resolveCardImageUrl } from '@/lib/images/cloudflare-loader';
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
        'relative flex flex-col items-center justify-between p-4 rounded-xl bg-gradient-to-b from-[#131d36] via-[#0d1629] to-[#080d19] border border-white/10 shadow-lg overflow-hidden group/placeholder',
        sizeClassName,
        className
      )}
      style={{ aspectRatio: '5/7' }}
      role="img"
      aria-label={`Placeholder for ${alt}`}
    >
      {/* Holographic foil shimmer lines */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-500/10 via-transparent to-purple-500/10 pointer-events-none" />
      <div className="absolute -inset-[100%] opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

      {/* Top Header Badge */}
      <div className="w-full flex items-center justify-between z-10 opacity-60">
        <span className="text-[10px] font-mono tracking-widest uppercase text-teal-400 font-bold">TCG</span>
        <div className="w-1.5 h-1.5 rounded-full bg-teal-400/80 animate-pulse" />
      </div>

      {/* Center Sphere Emblem */}
      <div className="relative flex flex-col items-center justify-center my-auto z-10">
        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/15 flex items-center justify-center shadow-[inset_0_0_12px_rgba(255,255,255,0.05)] group-hover/placeholder:border-teal-400/40 transition-colors">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500/20 to-blue-600/20 flex items-center justify-center">
            <span className="text-xl font-black text-white/90 select-none tracking-tight">
              {alt ? alt.trim().charAt(0).toUpperCase() : '?'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Card Title */}
      {showText && (
        <div className="w-full text-center z-10 px-1">
          <p className="text-[11px] font-semibold text-zinc-300 truncate w-full tracking-wide">
            {alt || 'Unknown Card'}
          </p>
          <p className="text-[9px] text-zinc-500 uppercase tracking-wider font-mono mt-0.5">
            Original Scan Pending
          </p>
        </div>
      )}
    </div>
  );
}

// Loading skeleton with shimmer effect (defined at module level)
function LoadingSkeleton({ alt, className, sizeClassName }: Omit<PlaceholderProps, 'showText'>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg bg-white/5 border border-white/10',
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
  const imgRef = React.useRef<HTMLImageElement>(null);

  // Reset loading state when src changes or check if already cached
  React.useEffect(() => {
    if (src) {
      // If the image is restored from BFCache, it might already be fully loaded
      if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
        setLoadingState('loaded');
      } else {
        setLoadingState('loading');
      }
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
        <div
          className="absolute inset-0 z-10"
          style={{ aspectRatio: '5/7' }}
        >
          <LoadingSkeleton alt={alt} className={className} sizeClassName={config.className} />
        </div>
      )}

      {/* The actual image — use width/height (not fill) so parent needs no explicit height */}
      <Image
        ref={imgRef}
        src={resolveCardImageUrl(src) || src}
        alt={alt}
        width={500}
        height={700}
        priority={priority}
        placeholder={blurDataURL ? 'blur' : 'empty'}
        blurDataURL={blurDataURL || DEFAULT_BLUR_PLACEHOLDER}
        loader={cloudflareImageLoader}
        unoptimized={!isImageCdnEnabled}
        onLoad={() => setLoadingState('loaded')}
        onError={() => setLoadingState('error')}
        className={cn(
          'w-full h-auto object-contain rounded-lg transition-all duration-300 [image-rendering:-webkit-optimize-contrast] [image-rendering:crisp-edges]',
          loadingState === 'loading' && 'opacity-0 scale-105',
          loadingState === 'loaded' && 'opacity-100 scale-100'
        )}
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
          'relative overflow-hidden rounded-lg bg-white/5 border border-white/10',
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
          'flex h-12 w-10 items-center justify-center rounded bg-white/5 border border-white/10',
          className
        )}
        role="img"
        aria-label={`${alt} thumbnail`}
      >
        <span className="text-sm font-semibold text-zinc-400 select-none">
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
        loader={cloudflareImageLoader}
        unoptimized={!isImageCdnEnabled}
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
            'flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/10 bg-white/5',
            config.className,
            props.className
          )}
          style={{ aspectRatio: '5/7' }}
        >
          <span className="text-3xl text-zinc-600">!</span>
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
