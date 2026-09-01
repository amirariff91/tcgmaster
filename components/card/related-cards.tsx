import Link from 'next/link';

import { CardGridItem } from '@/components/cards/card-grid-item';
import { type MockCard } from '@/lib/mock-data';

export interface RelatedCard {
  id: string;
  slug: string;
  name: string;
  number: string;
  image_url: string | null;
  local_image_url: string | null;
  rarity?: string;
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

  const mockRarities = ['common', 'uncommon', 'rare', 'holo-rare', 'ultra-rare'] as const;

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

      <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {cards.map((related) => {
          const price = related.price_cache_ttl ? related.price_cache_ttl / 100 : null;

          const mockCard: MockCard = {
            id: related.id,
            name: related.name,
            slug: related.slug,
            number: related.number,
            rarity: related.rarity && (mockRarities as readonly string[]).includes(related.rarity)
              ? related.rarity as MockCard['rarity']
              : 'common',
            image_url: related.image_url,
            local_image_url: related.local_image_url,
            prices: {
              raw: price,
              psa7: null,
              psa8: null,
              psa9: null,
              psa10: null,
            },
            change24h: 0,
          };

          return (
            <li key={related.id}>
              <CardGridItem
                card={mockCard}
                gameSlug={gameSlug}
                setSlug={setSlug}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
