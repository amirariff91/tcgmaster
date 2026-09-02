import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import { connection } from 'next/server';
import { ArrowRight, Search, TrendingUp } from 'lucide-react';
import { SearchBar } from '@/components/search/search-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatPrice, formatSetName, splitCardName } from '@/lib/utils';
import { latestRecordedAt } from '@/lib/pricing/price-labels';
// Cookie-free anon client keeps this route statically renderable (see card page).
import { dbQuery } from '@/lib/db/client';
import { Badge } from '@/components/ui/badge';

interface GameData {
  id: string;
  name: string;
  slug: string;
  display_name: string;
}

interface SetRow {
  id: string;
  name: string;
  slug: string;
  release_date: string | null;
  card_count: number | null;
}

interface SetPriceRow {
  card_id: string;
  headline_cents: number | null;
  cards: {
    set_id: string;
  };
}

interface TopPriceRow {
  card_id: string;
  headline_cents: number | null;
  cards: {
    id: string;
    name: string;
    slug: string;
    sets: {
      name: string;
      slug: string;
    };
  };
}

interface LatestPriceRow {
  card_id: string;
  source_prices: unknown;
}

interface GamePageData {
  game: GameData;
  sets: Array<SetRow & { avg_price: number | null }>;
  total_cards: number;
  total_sets: number;
  top_cards: Array<{
    id: string;
    name: string;
    set: string;
    slug: string;
    set_slug: string;
    price: number;
  }>;
  latest_price_update: string | null;
}

function getHeadlinePrice(headlineCents: unknown): number | null {
  if (typeof headlineCents === 'number' && Number.isFinite(headlineCents) && headlineCents > 0) {
    return headlineCents / 100;
  }

  return null;
}

async function getAllSets(gameId: string): Promise<SetRow[]> {
  return dbQuery<SetRow>(`
    SELECT id, name, slug, release_date::text AS release_date, card_count
    FROM sets
    WHERE game_id = $1
    ORDER BY release_date DESC NULLS LAST, name, id
  `, [gameId]);
}

async function getAllSetPrices(gameId: string): Promise<SetPriceRow[]> {
  return dbQuery<SetPriceRow>(`
    SELECT
      p.card_id,
      p.headline_cents,
      json_build_object('set_id', c.set_id) AS cards
    FROM card_price_current p
    JOIN cards c ON c.id = p.card_id
    JOIN sets s ON s.id = c.set_id
    WHERE s.game_id = $1
      AND p.headline_cents > 0
    ORDER BY p.card_id
  `, [gameId]);
}

async function getAllCurrentPriceRows(gameId: string): Promise<LatestPriceRow[]> {
  return dbQuery<LatestPriceRow>(`
    SELECT p.card_id, p.source_prices
    FROM card_price_current p
    JOIN cards c ON c.id = p.card_id
    JOIN sets s ON s.id = c.set_id
    WHERE s.game_id = $1
    ORDER BY p.card_id
  `, [gameId]);
}

async function getGameBySlug(gameSlug: string): Promise<GameData | null> {
  const rows = await dbQuery<GameData>(`
    SELECT id, name, slug, display_name
    FROM games
    WHERE slug = $1
    LIMIT 1
  `, [gameSlug]);

  return rows[0] || null;
}

async function getGamePageData(gameSlug: string): Promise<GamePageData | null> {
  const gameData = await getGameBySlug(gameSlug);

  if (!gameData) return null;

  const [sets, cardsCountRows, topPriceRows, latestPriceRows, setPrices] = await Promise.all([
    getAllSets(gameData.id),
    dbQuery<{ count: number }>(`
      SELECT COUNT(*)::int AS count
      FROM cards c
      JOIN sets s ON s.id = c.set_id
      WHERE s.game_id = $1
    `, [gameData.id]),
    dbQuery<TopPriceRow>(`
      SELECT
        p.card_id,
        p.headline_cents,
        json_build_object(
          'id', c.id,
          'name', c.name,
          'slug', c.slug,
          'sets', json_build_object(
            'name', s.name,
            'slug', s.slug
          )
        ) AS cards
      FROM card_price_current p
      JOIN cards c ON c.id = p.card_id
      JOIN sets s ON s.id = c.set_id
      WHERE s.game_id = $1
        AND p.headline_cents > 0
      ORDER BY p.headline_cents DESC, p.card_id
      LIMIT 3
    `, [gameData.id]),
    getAllCurrentPriceRows(gameData.id),
    getAllSetPrices(gameData.id),
  ]);

  const priceTotalsBySet = new Map<string, { count: number; total: number }>();

  for (const row of setPrices) {
    const price = getHeadlinePrice(row.headline_cents);
    if (price === null) continue;

    const totals = priceTotalsBySet.get(row.cards.set_id) || { count: 0, total: 0 };
    totals.count += 1;
    totals.total += price;
    priceTotalsBySet.set(row.cards.set_id, totals);
  }

  const topCards = topPriceRows.flatMap((row) => {
    const price = getHeadlinePrice(row.headline_cents);
    if (price === null) return [];

    return [{
      id: row.cards.id,
      name: row.cards.name,
      set: row.cards.sets.name,
      slug: row.cards.slug,
      set_slug: row.cards.sets.slug,
      price,
    }];
  });
  const latestPriceUpdate = latestPriceRows.reduce<string | null>((latest, row) => {
    const candidate = latestRecordedAt(row.source_prices);
    if (!candidate) return latest;

    if (!latest || Date.parse(candidate) > Date.parse(latest)) return candidate;
    return latest;
  }, null);

  return {
    game: gameData,
    sets: sets.map((set) => {
      const totals = priceTotalsBySet.get(set.id);
      const avg_price = totals
        ? totals.total / totals.count
        : null;

      return { ...set, avg_price };
    }),
    total_cards: cardsCountRows[0]?.count || 0,
    total_sets: sets.length,
    top_cards: topCards,
    latest_price_update: latestPriceUpdate,
  };
}

interface PageProps {
  params: Promise<{
    game: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { game } = await params;
  let gameData: GameData | null = null;
  try {
    gameData = await getGameBySlug(game);
  } catch (error) {
    // Metadata is best-effort so a build-time DB outage does not fail the route.
    console.error('Failed to load game metadata:', error);
    await connection();
  }

  if (!gameData) {
    return { title: 'Not Found' };
  }

  return {
    title: `${gameData.display_name} Price Guide`,
    description: `Explore ${gameData.display_name} card prices and set data.`,
  };
}

// This route had neither revalidate nor generateStaticParams, so the cookie-free client
// swap alone left it rendering per request. Both are needed for a dynamic segment to
// join the ISR path in Next 16.
export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}

export default async function GamePage({ params }: PageProps) {
  const { game } = await params;
  let gamePageData: GamePageData | null = null;
  try {
    gamePageData = await getGamePageData(game);
  } catch (error) {
    console.error('Failed to load game page:', error);
  }

  if (!gamePageData) {
    notFound();
  }

  const {
    game: gameData,
    sets,
    total_cards: totalCards,
    total_sets: totalSets,
    top_cards: topCards,
    latest_price_update: latestPriceUpdate,
  } = gamePageData;
  const description = `Explore ${gameData.display_name} card prices and set data.`;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-white">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-4">
              {totalCards.toLocaleString()} cards tracked
            </Badge>
            <h1 className="mb-4 text-4xl font-bold tracking-tight text-zinc-900 md:text-5xl">
              {gameData.display_name} Price Guide
            </h1>
            <p className="mb-8 text-lg text-zinc-600">
              {description}
            </p>
            <div className="mx-auto max-w-xl">
              <SearchBar
                size="lg"
                placeholder={`Search ${gameData.name} cards...`}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-12 lg:grid-cols-3">
          {/* Sets List */}
          <div className="lg:col-span-2">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-zinc-900">
                Sets
              </h2>
              <span className="text-sm text-zinc-500">
                {totalSets} sets
              </span>
            </div>

            <div className="space-y-3">
              {sets.map((set) => (
                <Link
                  key={set.id}
                  href={`/${game}/${set.slug}`}
                  className="group flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-300 hover:shadow-md"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-zinc-100">
                    <span className="text-2xl font-bold text-zinc-400">
                      {formatSetName(set.name).charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-zinc-900 group-hover:text-blue-600 truncate" title={formatSetName(set.name)}>
                        {formatSetName(set.name)}
                      </h3>
                    </div>
                    <p className="text-sm text-zinc-500">
                      {set.card_count === null ? 'No Data Yet' : `${set.card_count} cards`} | Released {set.release_date?.slice(0, 4) || 'Unknown'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-zinc-900">
                      {set.avg_price === null ? 'No Data Yet' : formatPrice(set.avg_price)}
                    </p>
                    <p className="text-sm text-zinc-500">avg. price</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-zinc-400 transition-transform group-hover:translate-x-1" />
                </Link>
              ))}
            </div>

            <div className="mt-6 text-center">
              <Button variant="outline">
                View All Sets
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Top Cards */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  Top Cards
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {topCards.length === 0 ? (
                  <p className="py-2 text-sm text-zinc-500">
                    No cards with price data yet.
                  </p>
                ) : topCards.map((card, index) => (
                  <Link
                    key={card.id}
                    href={`/${game}/${card.set_slug}/${card.slug}`}
                    className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-zinc-50"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-500">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-zinc-900">
                        {splitCardName(card.name).baseName}
                      </p>
                      <p className="text-sm text-zinc-500">{card.set}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-zinc-900">
                        {formatPrice(card.price)}
                      </p>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Total Cards</dt>
                    <dd className="font-semibold text-zinc-900">
                      {totalCards.toLocaleString()}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Total Sets</dt>
                    <dd className="font-semibold text-zinc-900">
                      {totalSets}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Last Price Update</dt>
                    <dd className="font-semibold text-zinc-900">
                      {latestPriceUpdate ? formatDate(latestPriceUpdate) : 'No Data Yet'}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* CTA */}
            <Card className="border-2 border-dashed">
              <CardContent className="pt-6 text-center">
                <Search className="mx-auto h-8 w-8 text-zinc-400" />
                <h3 className="mt-2 font-semibold text-zinc-900">
                  Can&apos;t find a card?
                </h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Use our search to find any card in our database.
                </p>
                <Link href={`/search?game=${game}`}>
                  <Button className="mt-4" size="sm">
                    Advanced Search
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
