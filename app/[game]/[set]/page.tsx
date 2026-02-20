import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSetBySlug, getRelatedSets, mockSets } from '@/lib/mock-data';
import { SetPageClient } from './set-page-client';
import { createClient } from '@/lib/supabase/server';
import type { MockSet, MockCard } from '@/lib/mock-data';

interface SetPageProps {
  params: Promise<{
    game: string;
    set: string;
  }>;
  searchParams: Promise<{
    q?: string;
    sort?: string;
  }>;
}

// Fetch set + cards from Supabase
async function getSetFromDB(gameSlug: string, setSlug: string): Promise<MockSet | null> {
  try {
    const supabase = await createClient();

    // Fetch set with game info (use any to avoid Supabase join typing issues)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: setData, error: setError } = await (supabase as any)
      .from('sets')
      .select(`
        id, name, slug, release_date, card_count, image_url,
        games!inner ( id, name, slug, display_name )
      `)
      .eq('slug', setSlug)
      .eq('games.slug', gameSlug)
      .single();

    if (setError || !setData) return null;

    const game = setData.games as {
      id: string; name: string; slug: string; display_name: string;
    };

    // Fetch all cards for this set with price cache (any to bypass join typing)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cardsData } = await (supabase as any)
      .from('cards')
      .select(`
        id, name, slug, number, rarity, artist, image_url, description,
        price_cache ( raw_prices, graded_prices )
      `)
      .eq('set_id', setData.id)
      .order('number');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cards: MockCard[] = (cardsData || []).map((c: {
      id: string;
      name: string;
      slug: string;
      number: string;
      rarity: string | null;
      artist: string | null;
      image_url: string | null;
      description: string | null;
      price_cache: Array<{
        raw_prices: Record<string, number | null> | null;
        graded_prices: Record<string, { average: number | null } | null> | null;
      }> | null;
    }) => {
      const pc = Array.isArray(c.price_cache) ? c.price_cache[0] : c.price_cache;
      const raw = pc?.raw_prices;
      const graded = pc?.graded_prices;

      const rarity = c.rarity as MockCard['rarity'] || 'common';

      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        number: c.number,
        rarity,
        image_url: c.image_url,
        prices: {
          raw: raw?.nearMint ?? null,
          psa7: graded?.psa7?.average ?? null,
          psa8: graded?.psa8?.average ?? null,
          psa9: graded?.psa9?.average ?? null,
          psa10: graded?.psa10?.average ?? null,
        },
        change24h: 0,
      };
    });

    // Compute avg_price from raw NM prices of holos
    const validPrices = cards
      .map(c => c.prices.raw)
      .filter((p): p is number => p !== null && p > 0);
    const avg_price = validPrices.length > 0
      ? Math.round(validPrices.reduce((a, b) => a + b, 0) / validPrices.length)
      : 0;

    const setDescriptions: Record<string, string> = {
      'base-set': 'The original Pokémon TCG set from 1999. Home to Charizard, Blastoise, and Venusaur — the most iconic vintage cards in existence.',
      'jungle': 'The second Pokémon TCG expansion featuring jungle Pokémon including Scyther, Pinsir, and Jolteon.',
      'fossil': 'The third expansion featuring prehistoric fossil Pokémon including Gengar, Lapras, and Aerodactyl.',
      'base-set-2': 'A reprint set combining cards from Base Set and Jungle. Highly collectible for its nostalgic value.',
      'team-rocket': 'Features the villainous Team Rocket and their Dark Pokémon including Dark Charizard and Dark Blastoise.',
      'neo-genesis': 'The first Neo era set introducing Johto Pokémon. Features Lugia — one of the rarest cards ever printed.',
    };

    return {
      id: setData.id,
      name: setData.name,
      slug: setData.slug,
      game: game.display_name,
      gameSlug: game.slug,
      release_date: setData.release_date || '1999-01-01',
      card_count: setData.card_count || cards.length,
      description: setDescriptions[setSlug] || `Complete price guide for ${setData.name}.`,
      avg_price,
      trending: ['base-set', 'neo-genesis', 'team-rocket'].includes(setSlug),
      cards,
      related_sets: [],
    };
  } catch (e) {
    console.error('Failed to fetch set from DB:', e);
    return null;
  }
}

// Generate static params from both Supabase slugs (via mock fallback)
export async function generateStaticParams() {
  const params: { game: string; set: string }[] = [];
  Object.values(mockSets).forEach((set) => {
    params.push({ game: set.gameSlug, set: set.slug });
  });
  return params;
}

export async function generateMetadata({ params }: SetPageProps): Promise<Metadata> {
  const { game, set: setSlug } = await params;

  // Try DB first, fall back to mock
  const setData = await getSetFromDB(game, setSlug) || getSetBySlug(game, setSlug);

  if (!setData) return { title: 'Set Not Found | TCGMaster' };

  const title = `${setData.name} - ${setData.game} Cards | TCGMaster`;
  const description = `Complete price guide for ${setData.name} (${setData.game}). Track prices for ${setData.card_count} cards including Raw and PSA graded values.`;

  return {
    title,
    description,
    openGraph: { title, description, type: 'website', siteName: 'TCGMaster' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export const revalidate = 3600;

export default async function SetPage({ params, searchParams }: SetPageProps) {
  const { game, set: setSlug } = await params;
  const { q, sort } = await searchParams;

  // Try real DB first, fall back to mock data
  let setData = await getSetFromDB(game, setSlug);
  const fromDB = !!setData;

  if (!setData) {
    setData = getSetBySlug(game, setSlug);
  }

  if (!setData) notFound();

  // For related sets, use mock data (we don't have a DB relation for this yet)
  const relatedSets = getRelatedSets(setSlug);

  // If we got data from DB but no cards, supplement with mock cards + real set metadata
  if (fromDB && setData.cards.length === 0) {
    const mockVersion = getSetBySlug(game, setSlug);
    if (mockVersion) {
      setData = { ...setData, cards: mockVersion.cards };
    }
  }

  return (
    <SetPageClient
      setData={setData}
      relatedSets={relatedSets}
      gameSlug={game}
      initialQuery={q}
      initialSort={sort}
    />
  );
}
