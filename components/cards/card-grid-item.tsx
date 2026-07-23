'use client';

import Link from 'next/link';
import Image from 'next/image';
import cloudflareImageLoader, { isImageCdnEnabled } from '@/lib/images/cloudflare-loader';
import { Check } from 'lucide-react';
import { cn, splitCardName } from '@/lib/utils';
import { type MockCard, pokemonTypeColors, rarityColors } from '@/lib/mock-data';
import { QuickAddDropdown } from './quick-add-dropdown';
import { useCurrencyContext } from '@/lib/currency-context';
import { trackCardClicked } from '@/lib/analytics';

interface CardGridItemProps {
  card: MockCard;
  gameSlug: string;
  setSlug: string;
  isOwned?: boolean;
  isLoggedIn?: boolean;
  onQuickAdd?: (cardId: string, grade: string) => Promise<void>;
  className?: string;
}

export function CardGridItem({
  card,
  gameSlug,
  setSlug,
  isOwned = false,
  isLoggedIn = false,
  onQuickAdd,
  className,
}: CardGridItemProps) {
  const { format } = useCurrencyContext();
  const href = `/${gameSlug}/${setSlug}/${card.slug}`;
  const { baseName: cleanName } = splitCardName(card.name);

  // Get placeholder color based on type (Pokemon) or rarity
  const getPlaceholderColor = () => {
    if (card.type && pokemonTypeColors[card.type]) {
      return pokemonTypeColors[card.type];
    }
    return rarityColors[card.rarity] || 'bg-zinc-200';
  };

  // Format price change
  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  };

  const handleClick = () => {
    trackCardClicked(gameSlug, setSlug, card.slug, card.name, card.prices.raw);
  };

  // Get rarity display
  const rarityDisplay: Record<string, string> = {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    'holo-rare': 'Holo Rare',
    'ultra-rare': 'Ultra Rare',
  };

  return (
    <div className={cn('group relative', className)}>
      <Link
        href={href}
        onClick={handleClick}
        className={cn(
          'flex gap-3 p-3 rounded-lg',
          'bg-[#0b1329]/80 backdrop-blur-sm border border-white/10',
          'hover:border-white/20 hover:bg-white/5 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-[#060c18]'
        )}
      >
        {/* Card Image / Placeholder */}
        <div className="relative flex-shrink-0">
          {(card.local_image_url || card.image_url) ? (
            <Image
              src={card.local_image_url || card.image_url || ''}
              alt={cleanName}
              width={80}
              height={112}
              className="w-20 h-28 object-cover rounded"
              loading="lazy"
              loader={cloudflareImageLoader}
              unoptimized={!isImageCdnEnabled}
            />
          ) : (
            <div
              className={cn(
                'w-20 h-28 rounded flex items-center justify-center',
                getPlaceholderColor()
              )}
            >
              <span className="text-2xl font-bold text-white/80">
                {cleanName.charAt(0)}
              </span>
            </div>
          )}

          {/* Owned indicator */}
          {isOwned && (
            <div
              className={cn(
                'absolute -top-1 -right-1',
                'w-5 h-5 rounded-full',
                'bg-emerald-500 text-white',
                'flex items-center justify-center',
                'shadow-sm'
              )}
            >
              <Check className="h-3 w-3" />
            </div>
          )}
        </div>

        {/* Card Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-zinc-400 font-medium">
                {card.number}
              </p>
              <h3 className="font-semibold text-white truncate">
                {cleanName}
              </h3>
              <p className="text-xs text-zinc-400">
                {rarityDisplay[card.rarity] || card.rarity}
              </p>
            </div>

            {/* Quick Add Button */}
            {isLoggedIn && (
              <div onClick={(e) => e.preventDefault()}>
                <QuickAddDropdown
                  cardId={card.id}
                  cardName={card.name}
                  onAdd={onQuickAdd}
                />
              </div>
            )}
          </div>

          {/* Prices */}
          <div className="mt-2 pt-2 border-t border-white/10">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <span className="text-xs text-zinc-400">Raw: </span>
                <span className="font-medium text-white">
                  {format(card.prices.raw)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-zinc-400">PSA 10: </span>
                <span className="font-medium text-orange-400">
                  {format(card.prices.psa10)}
                </span>
              </div>
            </div>

            {/* Price Change */}
            <div className="mt-1">
              <span
                className={cn(
                  'text-xs font-medium',
                  card.change24h >= 0 ? 'text-emerald-600' : 'text-red-600'
                )}
              >
                {formatChange(card.change24h)} (24h)
              </span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

// Skeleton loader for card grid item
export function CardGridItemSkeleton() {
  return (
    <div className="flex gap-3 p-3 rounded-lg bg-[#0b1329]/80 backdrop-blur-sm border border-white/10">
      {/* Image skeleton */}
      <div className="w-20 h-28 rounded bg-white/10 animate-pulse" />

      {/* Content skeleton */}
      <div className="flex-1">
        <div className="space-y-2">
          <div className="h-3 w-12 bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
          <div className="h-3 w-16 bg-white/10 rounded animate-pulse" />
        </div>

        <div className="mt-4 pt-2 border-t border-white/10 space-y-2">
          <div className="flex justify-between">
            <div className="h-3 w-16 bg-white/10 rounded animate-pulse" />
            <div className="h-3 w-20 bg-white/5 rounded animate-pulse" />
          </div>
          <div className="h-3 w-14 bg-white/10 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
