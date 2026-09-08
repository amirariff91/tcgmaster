'use client';

import * as React from 'react';
import { resolveCardImageUrl } from '@/lib/images/cloudflare-loader';

interface LeaderAvatarProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
}

export function LeaderAvatar({ src, alt, className = 'w-11 h-11' }: LeaderAvatarProps) {
  const [hasError, setHasError] = React.useState(false);
  const resolvedSrc = src ? resolveCardImageUrl(src) || src : null;

  if (!resolvedSrc || hasError) {
    const initial = alt ? alt.trim().charAt(0).toUpperCase() : '?';
    return (
      <div className={`relative shrink-0 ${className} rounded-full overflow-hidden border border-white/15 shadow-md bg-gradient-to-br from-zinc-800 to-zinc-950 flex items-center justify-center`}>
        <span className="text-xs font-black text-amber-400 select-none">{initial}</span>
      </div>
    );
  }

  return (
    <div className={`relative shrink-0 ${className} rounded-full overflow-hidden border border-white/10 shadow-md bg-black/80`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolvedSrc}
        alt={alt}
        onError={() => setHasError(true)}
        className="w-full h-full object-cover object-top group-hover:scale-110 transition-transform duration-500"
        loading="lazy"
      />
    </div>
  );
}
