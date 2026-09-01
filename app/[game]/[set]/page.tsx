import { Metadata } from 'next';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { getSetBySlug, getRelatedSets } from '@/lib/mock-data';
import { SetPageClient } from './set-page-client';
// Cookie-free anon client keeps this route statically renderable (see card page).
import { dbQuery } from '@/lib/db/client';
import { formatSetName } from '@/lib/utils';
import type { MockSet, MockCard } from '@/lib/mock-data';

interface SetPageProps {
  params: Promise<{
    game: string;
    set: string;
  }>;
}

// Fetch set + cards from Postgres
async function getSetFromDB(
  gameSlug: string,
  setSlug: string,
  onError?: (error: unknown) => void,
): Promise<MockSet | null> {
  try {
    const setRows = await dbQuery(`
      SELECT
        s.id,
        s.name,
        s.slug,
        s.release_date,
        s.card_count,
        s.image_url,
        json_build_object(
          'id', g.id,
          'name', g.name,
          'slug', g.slug,
          'display_name', g.display_name
        ) AS games
      FROM sets s
      JOIN games g ON g.id = s.game_id
      WHERE s.slug = $1
        AND g.slug = $2
      LIMIT 1
    `, [setSlug, gameSlug]) as Array<{
      id: string;
      name: string;
      slug: string;
      release_date: string | null;
      card_count: number | null;
      image_url: string | null;
      games: { id: string; name: string; slug: string; display_name: string };
    }>;

    const setData = setRows[0];
    if (!setData) return null;

    const game = setData.games as {
      id: string; name: string; slug: string; display_name: string;
    };

    // JOIN the one-to-one current-price row into the same nested shape.
    const cardsData = await dbQuery(`
      SELECT
        c.id,
        c.name,
        c.slug,
        c.number,
        c.rarity,
        c.artist,
        c.image_url,
        c.local_image_url,
        c.description,
        (
          SELECT json_build_object(
            'headline_cents', cp.headline_cents,
            'graded_prices', cp.graded_prices
          )
          FROM card_price_current cp
          WHERE cp.card_id = c.id
        ) AS card_price_current
      FROM cards c
      WHERE c.set_id = $1
      ORDER BY c.number
    `, [setData.id]) as Array<{
      id: string;
      name: string;
      slug: string;
      number: string;
      rarity: string | null;
      artist: string | null;
      image_url: string | null;
      local_image_url: string | null;
      description: string | null;
      card_price_current: {
        headline_cents: number | null;
        graded_prices: Record<string, { average: number | null } | null> | null;
      } | null;
    }>;

    const cards: MockCard[] = cardsData.map((c) => {
      const currentPrice = c.card_price_current;
      const price = currentPrice?.headline_cents == null
        ? null
        : currentPrice.headline_cents / 100;
      const graded = currentPrice?.graded_prices;

      const rarity = c.rarity as MockCard['rarity'] || 'common';

      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        number: c.number,
        rarity,
        // Grid renders MockCard.image_url; prefer the cached/CDN copy (local_image_url)
        // so it moves to R2 on cutover, falling back to the source image_url.
        image_url: c.local_image_url ?? c.image_url,
        prices: {
          raw: price,
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
      name: formatSetName(setData.name),
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
    onError?.(e);
    return null;
  }
}

// Only pre-render database-backed routes when the database is reachable.
export async function generateStaticParams() {
  try {
    return await dbQuery<{ game: string; set: string }>(`
      SELECT g.slug AS game, s.slug AS set
      FROM sets s
      JOIN games g ON g.id = s.game_id
      ORDER BY g.slug, s.slug
    `);
  } catch (e) {
    console.error('Failed to generate set static params:', e);
    return [];
  }
}

export async function generateMetadata({ params }: SetPageProps): Promise<Metadata> {
  const { game, set: setSlug } = await params;

  // Try DB first, fall back to mock
  let dbFailed = false;
  const setData = await getSetFromDB(game, setSlug, () => {
    dbFailed = true;
  }) || getSetBySlug(game, setSlug) || null;

  if (dbFailed) await connection();

  if (!setData) return { title: 'Set Not Found | TCGMaster' };

  const formattedName = formatSetName(setData.name);
  const title = `${formattedName} - ${setData.game} Cards | TCGMaster`;
  const description = `Complete price guide for ${formattedName} (${setData.game}). Track prices for ${setData.card_count} cards including Raw and PSA graded values.`;

  return {
    title,
    description,
    openGraph: { title, description, type: 'website', siteName: 'TCGMaster' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export const revalidate = 3600;

export default async function SetPage({ params }: SetPageProps) {
  const { game, set: setSlug } = await params;

  // Try real DB first, fall back to mock data
  let setData = await getSetFromDB(game, setSlug);
  const fromDB = !!setData;

  if (!setData) {
    setData = getSetBySlug(game, setSlug) ?? null;
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
    />
  );
}
