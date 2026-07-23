'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn, getRarityDisplay, splitCardName } from '@/lib/utils';
import { useCurrencyContext } from '@/lib/currency-context';
import { CardImage } from './card-image';
import { PriceChangeIndicator } from './price-display';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { Rarity, PriceConfidence } from '@/types';

// Simplified interface for card preview data
interface CardPreviewData {
  id: string;
  name: string;
  slug: string;
  number: string;
  rarity?: Rarity | string | null;
  image_url?: string | null;
  local_image_url?: string | null;
  set?: {
    id?: string;
    name: string;
    slug: string;
  };
  current_price?: number;
  price_change_24h?: number;
  price_confidence?: PriceConfidence | null;
}

interface CardPreviewProps {
  card: CardPreviewData;
  gameSlug: string;
  variant?: 'default' | 'compact' | 'list';
  className?: string;
}

export function CardPreview({ card, gameSlug, variant = 'default', className }: CardPreviewProps) {
  const { format } = useCurrencyContext();
  const href = `/${gameSlug}/${card.set?.slug ?? 'unknown'}/${card.slug}`;
  const { baseName: cleanName } = splitCardName(card.name);

  if (variant === 'list') {
    return (
      <Link href={href} className={cn('block', className)}>
        <div className="flex items-center gap-4 rounded-lg p-3 transition-all duration-200 hover:bg-white/5 hover:border-orange-500/30 border border-transparent">
          <CardImage src={card.local_image_url || card.image_url} alt={cleanName} size="sm" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate">
              {cleanName}
            </h3>
            <p className="text-sm text-zinc-400 truncate">
              {card.set?.name} - #{card.number}
            </p>
          </div>
          <div className="text-right">
            {card.current_price !== undefined ? (
              <>
                <p className="font-bold text-orange-400">
                  {format(card.current_price)}
                </p>
                {card.price_change_24h !== undefined && (
                  <PriceChangeIndicator change={card.price_change_24h} />
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-500">Price : Unavailable</p>
            )}
          </div>
        </div>
      </Link>
    );
  }

  if (variant === 'compact') {
    return (
      <Link href={href} className={cn('block', className)}>
        <div className="flex items-center gap-3 rounded-lg p-2 transition-all duration-200 hover:bg-white/5 border border-transparent hover:border-orange-500/30">
          <CardImage src={card.local_image_url || card.image_url} alt={cleanName} size="sm" />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-white truncate text-sm">
              {cleanName}
            </h3>
            {card.current_price !== undefined && (
              <p className="text-sm font-semibold text-orange-400">
                {format(card.current_price)}
              </p>
            )}
          </div>
        </div>
      </Link>
    );
  }


  return (
    <Link href={`/${gameSlug}/${card.set?.slug || 'unknown'}/${card.slug}`}>
      <div className={cn(
        "group relative flex flex-col h-full bg-[#0a1120] rounded-[6px] border border-white/5 p-[10px]",
        "hover:border-orange-500/30 hover:bg-[#0c1527] transition-all duration-300",
        className
      )}>
        
        {/* Top: Image Area */}
        <div className="relative w-[130px] mx-auto aspect-[5/7]">
          {card.price_confidence && (
            <Badge 
              variant="outline" 
              className="absolute -top-2 -left-2 z-10 scale-90 border-zinc-800 bg-zinc-900/90 text-[10px]"
            >
              {card.price_confidence.toUpperCase()}
            </Badge>
          )}
          
          <CardImage 
            src={card.local_image_url || card.image_url} 
            alt={cleanName} 
            className="w-full h-auto object-contain drop-shadow-md aspect-[5/7] transition-transform duration-300 group-hover:scale-105"
          />
        </div>

        {/* Bottom: Info & Price */}
        <div className="flex flex-col flex-1 mt-[7px]">
          {/* Card Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-[13px] mb-[5px] leading-tight line-clamp-2">
              {cleanName}
            </h3>
            <p className="text-[11px] text-zinc-400 mb-[5px] truncate">
              {card.set?.name}
            </p>
            <p className="text-[11px] text-zinc-500">
              {card.rarity ? getRarityDisplay(card.rarity as string) : '?'} &bull; #{card.number || '?'}
            </p>
          </div>

          {/* Price */}
          <div className="mt-[7px] flex items-end justify-between">
            <div className="flex flex-col h-5 justify-end">
              {card.current_price && card.current_price > 0 ? (
                <span className="font-bold text-orange-400 text-[13px]">
                  {format(card.current_price)}
                </span>
              ) : (
                <span className="font-medium text-zinc-500 text-[11px] uppercase tracking-wider">
                  Price : Unavailable
                </span>
              )}
            </div>
          </div>
        </div>
        
      </div>
    </Link>
  );
}

interface CardGridProps {
  cards: CardPreviewData[];
  gameSlug: string;
  className?: string;
}

export function CardGrid({ cards, gameSlug, className }: CardGridProps) {
  return (
    <div
      className={cn(
        'grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
        className
      )}
    >
      {cards.map((card) => (
        <CardPreview key={card.id} card={card} gameSlug={gameSlug} />
      ))}
    </div>
  );
}
