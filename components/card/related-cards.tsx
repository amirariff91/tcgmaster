import Link from 'next/link';
import { CardImage } from '@/components/card/card-image';
import { FormattedPrice } from '@/components/ui/formatted-price';
import { formatDisplayNumber, splitCardName } from '@/lib/utils';

export interface RelatedCard {
  id: string;
  slug: string;
  name: string;
  number: string;
  image_url: string | null;
  local_image_url: string | null;
  /** Latest featured price in cents, as stored on cards.price_cache_ttl. */
  price_cache_ttl: number | null;
}

interface RelatedCardsProps {
  cards: RelatedCard[];
  gameSlug: string;
  setSlug: string;
  setName: string;
}

/**
 * Lateral navigation out of a card page. Before this the only way off a card was the
 * breadcrumb, which made every card a dead end for browsing.
 */
export function RelatedCards({ cards, gameSlug, setSlug, setName }: RelatedCardsProps) {
  if (cards.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">More from {setName}</h2>
        <Link
          href={`/${gameSlug}/${setSlug}`}
          className="shrink-0 text-[13px] font-medium text-zinc-400 transition-colors hover:text-white"
        >
          View all
        </Link>
      </div>

      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {cards.map((related) => {
          const { baseName } = splitCardName(related.name);
          const price = related.price_cache_ttl ? related.price_cache_ttl / 100 : null;

          return (
            <li key={related.id}>
              <Link
                href={`/${gameSlug}/${setSlug}/${related.slug}`}
                className="group block rounded-xl border border-white/10 bg-[#0b1329]/80 p-2 backdrop-blur-sm transition-colors hover:border-white/25 hover:bg-white/5"
              >
                <CardImage
                  src={related.local_image_url || related.image_url}
                  alt={baseName}
                  size="sm"
                  className="w-full rounded-lg"
                />
                <p className="mt-2 truncate text-[12px] font-semibold text-white" title={baseName}>
                  {baseName}
                </p>
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[10px] font-medium tracking-wider text-zinc-500">
                    {formatDisplayNumber(gameSlug, related.number)}
                  </span>
                  {price !== null && (
                    <FormattedPrice
                      price={price}
                      className="text-[11px] font-bold tabular-nums text-orange-400"
                    />
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
