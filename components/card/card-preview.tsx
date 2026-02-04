'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn, getRarityDisplay } from '@/lib/utils';
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
  set?: {
    id?: string;
    name: string;
    slug: string;
  };
  current_price?: number;
  price_change_24h?: number;
  confidence?: PriceConfidence;
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

  if (variant === 'list') {
    return (
      <Link href={href} className={cn('block', className)}>
        <div className="flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-zinc-50">
          <CardImage src={card.image_url} alt={card.name} size="sm" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-zinc-900  truncate">
              {card.name}
            </h3>
            <p className="text-sm text-zinc-500 truncate">
              {card.set?.name} - #{card.number}
            </p>
          </div>
          <div className="text-right">
            {card.current_price !== undefined ? (
              <>
                <p className="font-bold text-zinc-900 ">
                  {format(card.current_price)}
                </p>
                {card.price_change_24h !== undefined && (
                  <PriceChangeIndicator change={card.price_change_24h} />
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-400">No price data</p>
            )}
          </div>
        </div>
      </Link>
    );
  }

  if (variant === 'compact') {
    return (
      <Link href={href} className={cn('block', className)}>
        <div className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-zinc-50">
          <CardImage src={card.image_url} alt={card.name} size="sm" />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-zinc-900  truncate text-sm">
              {card.name}
            </h3>
            {card.current_price !== undefined && (
              <p className="text-sm font-semibold text-zinc-700 ">
                {format(card.current_price)}
              </p>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={href} className={cn('block', className)}>
      <Card className="group overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1">
        <div className="p-4">
          <div className="relative mx-auto mb-4 w-fit">
            <CardImage src={card.image_url} alt={card.name} size="lg" />
            {card.rarity && (
              <Badge
                variant="secondary"
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap"
              >
                {getRarityDisplay(card.rarity)}
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <div>
              <h3 className="font-semibold text-zinc-900  truncate group-hover:text-blue-600 ">
                {card.name}
              </h3>
              <p className="text-sm text-zinc-500 truncate">
                {card.set?.name} - #{card.number}
              </p>
            </div>

            {card.current_price !== undefined ? (
              <div className="flex items-end justify-between">
                <span className="text-xl font-bold text-zinc-900 ">
                  {format(card.current_price)}
                </span>
                {card.price_change_24h !== undefined && card.price_change_24h !== 0 && (
                  <PriceChangeIndicator change={card.price_change_24h} />
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">No price data available</p>
            )}
          </div>
        </div>
      </Card>
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
