'use client';

import * as React from 'react';
import { resolveCardImageUrl } from '@/lib/images/cloudflare-loader';

interface DeckBannerImageProps {
  src: string | null | undefined;
  alt: string;
}

export function DeckBannerImage({ src, alt }: DeckBannerImageProps) {
  const [hasError, setHasError] = React.useState(false);
  const resolved = src ? resolveCardImageUrl(src) || src : null;

  if (!resolved || hasError) {
    const initial = alt ? alt.trim().charAt(0).toUpperCase() : '?';
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-850 to-zinc-950 flex items-center justify-center">
        <span className="text-xl font-black text-white/20 select-none">{initial}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      onError={() => setHasError(true)}
      className="w-full h-full object-cover object-top opacity-85 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
      loading="lazy"
    />
  );
}
