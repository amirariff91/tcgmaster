/**
 * Trending Score Calculator
 * Implements the combined weighted scoring algorithm
 */

import { dbQuery } from '@/lib/db/client';
import { createServerClient } from '@/lib/supabase/client';
import { redis } from '@/lib/redis/client';

// Type definitions for Postgres query results
interface TrendingScoreRow {
  card_id: string;
  price_change_24h: number | null;
  volume_24h: number | null;
  search_count_24h: number | null;
  social_mentions_24h: number | null;
  combined_score: number;
  cards: {
    id: string;
    name: string;
    slug: string;
    image_url: string | null;
    local_image_url: string | null;
    sets: {
      name: string;
      slug: string;
      games: { slug: string };
    };
  };
}

interface CardIdRow {
  id: string;
}

export interface PriceHistoryRow {
  id: string;
  card_id: string;
  price: number;
  recorded_at: string;
  variant_id: string | null;
  grading_company_id: string | null;
  grade: string;
  source: string;
}

interface SearchAnalyticsRow {
  id: string;
  card_id: string;
  created_at: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// A baseline is valid only when it is 23-25 hours older than the latest tick.
// Outside this strict +/- 1 hour tolerance, returning null is safer than
// labelling a materially different interval as a 24-hour price change.
const PRICE_BASELINE_TOLERANCE_MS = 60 * 60 * 1000;
const QUERY_PAGE_SIZE = 1000;
const CARD_PAGE_SIZE = 500;
const CARD_BATCH_SIZE = 100;
const BATCH_CONCURRENCY = 4;

// Weights for trending score calculation
const WEIGHTS = {
  priceChange: 0.3,
  volume: 0.25,
  searches: 0.25,
  social: 0.2,
};

export interface TrendingCard {
  cardId: string;
  cardName: string;
  setName: string;
  setSlug: string;
  slug: string;
  imageUrl: string | null;
  currentPrice: number | null;
  priceChange24h: number | null;
  volume24h: number | null;
  searchCount24h: number | null;
  socialMentions24h: number | null;
  combinedScore: number;
  game: string;
}

/**
 * Calculate trending score for a card
 */
export function calculateTrendingScore(
  priceChange24h: number | null,
  volume24h: number | null,
  searchCount24h: number | null,
  socialMentions24h: number | null
): number {
  const signals = [
    priceChange24h === null
      ? null
      : {
          value: Math.min(Math.abs(priceChange24h) / 50, 1),
          weight: WEIGHTS.priceChange,
        },
    volume24h === null
      ? null
      : {
          value: Math.min(Math.max(volume24h, 0) / 100, 1),
          weight: WEIGHTS.volume,
        },
    searchCount24h === null
      ? null
      : {
          value: Math.min(Math.max(searchCount24h, 0) / 1000, 1),
          weight: WEIGHTS.searches,
        },
    socialMentions24h === null
      ? null
      : {
          value: Math.min(Math.max(socialMentions24h, 0) / 50, 1),
          weight: WEIGHTS.social,
        },
  ].filter((signal): signal is { value: number; weight: number } => signal !== null);

  if (signals.length === 0) return 0;

  const availableWeight = signals.reduce((total, signal) => total + signal.weight, 0);
  const weightedScore = signals.reduce(
    (total, signal) => total + signal.value * signal.weight,
    0
  );

  // Re-normalize over metrics that were actually measured. Missing metrics
  // carry no positive or negative signal and therefore do not depress a card's
  // score as though a measured zero had been observed.
  return weightedScore / availableWeight;
}

function isSamePriceSeries(
  left: PriceHistoryRow,
  right: PriceHistoryRow
): boolean {
  return (
    left.source === right.source &&
    left.variant_id === right.variant_id &&
    left.grading_company_id === right.grading_company_id &&
    left.grade === right.grade
  );
}

/**
 * Compare the card's latest observation with the closest observation to 24
 * hours earlier in the exact same source/variant/grading-company/grade series.
 * The baseline must be 23-25 hours older; otherwise there is no honest 24-hour
 * comparison and the result is null.
 */
export function calculatePriceChange24h(
  priceHistory: PriceHistoryRow[]
): number | null {
  const latest = [...priceHistory].sort((left, right) => {
    const recordedAtDifference =
      Date.parse(right.recorded_at) - Date.parse(left.recorded_at);

    return recordedAtDifference || right.id.localeCompare(left.id);
  })[0];

  if (!latest) return null;

  const latestRecordedAt = Date.parse(latest.recorded_at);
  if (!Number.isFinite(latestRecordedAt) || !Number.isFinite(latest.price)) {
    return null;
  }

  let baseline: PriceHistoryRow | null = null;
  let baselineRecordedAt = Number.NEGATIVE_INFINITY;
  let closestDistanceFromTarget = Number.POSITIVE_INFINITY;

  for (const candidate of priceHistory) {
    if (
      candidate.id === latest.id ||
      !isSamePriceSeries(candidate, latest) ||
      !Number.isFinite(candidate.price) ||
      candidate.price <= 0
    ) {
      continue;
    }

    const candidateRecordedAt = Date.parse(candidate.recorded_at);
    if (!Number.isFinite(candidateRecordedAt) || candidateRecordedAt >= latestRecordedAt) {
      continue;
    }

    const candidateAge = latestRecordedAt - candidateRecordedAt;
    const distanceFromTarget = Math.abs(candidateAge - DAY_MS);
    if (distanceFromTarget > PRICE_BASELINE_TOLERANCE_MS) continue;

    if (
      distanceFromTarget < closestDistanceFromTarget ||
      (distanceFromTarget === closestDistanceFromTarget &&
        (candidateRecordedAt > baselineRecordedAt ||
          (candidateRecordedAt === baselineRecordedAt &&
            candidate.id.localeCompare(baseline?.id || '') > 0)))
    ) {
      baseline = candidate;
      baselineRecordedAt = candidateRecordedAt;
      closestDistanceFromTarget = distanceFromTarget;
    }
  }

  if (!baseline) return null;

  const change = ((latest.price - baseline.price) / baseline.price) * 100;
  return Number.isFinite(change) ? change : null;
}

function chunkCards(cards: CardIdRow[]): CardIdRow[][] {
  const batches: CardIdRow[][] = [];

  for (let index = 0; index < cards.length; index += CARD_BATCH_SIZE) {
    batches.push(cards.slice(index, index + CARD_BATCH_SIZE));
  }

  return batches;
}

async function fetchAllEligibleCards(): Promise<CardIdRow[]> {
  const cards: CardIdRow[] = [];
  let lastId: string | null = null;

  for (;;) {
    const page: CardIdRow[] = await dbQuery<CardIdRow>(`
      SELECT id
      FROM cards
      WHERE last_price_fetch IS NOT NULL
        AND ($1::uuid IS NULL OR id > $1::uuid)
      ORDER BY id
      LIMIT $2
    `, [lastId, CARD_PAGE_SIZE]);
    cards.push(...page);
    if (page.length < CARD_PAGE_SIZE) break;
    lastId = page[page.length - 1].id;
  }

  return cards;
}

async function fetchPriceHistoryForCards(
  cardIds: string[],
  snapshotAt: string
): Promise<PriceHistoryRow[]> {
  const rows: PriceHistoryRow[] = [];
  let lastId: string | null = null;

  for (;;) {
    const page: PriceHistoryRow[] = await dbQuery<PriceHistoryRow>(`
      SELECT
        id,
        card_id,
        price::float8 AS price,
        recorded_at,
        variant_id,
        grading_company_id,
        grade,
        source
      FROM price_history
      WHERE card_id = ANY($1::uuid[])
        AND recorded_at <= $2
        AND ($3::uuid IS NULL OR id > $3::uuid)
      ORDER BY id
      LIMIT $4
    `, [cardIds, snapshotAt, lastId, QUERY_PAGE_SIZE]);
    rows.push(...page);
    if (page.length < QUERY_PAGE_SIZE) break;
    lastId = page[page.length - 1].id;
  }

  return rows;
}

async function fetchSearchCountsForCards(
  cardIds: string[],
  windowStart: string,
  snapshotAt: string
): Promise<Map<string, number>> {
  const rows: SearchAnalyticsRow[] = [];
  let lastId: string | null = null;

  for (;;) {
    const page: SearchAnalyticsRow[] = await dbQuery<SearchAnalyticsRow>(`
      SELECT id, card_id, created_at
      FROM search_analytics
      WHERE card_id = ANY($1::uuid[])
        AND created_at >= $2
        AND created_at <= $3
        AND ($4::uuid IS NULL OR id > $4::uuid)
      ORDER BY id
      LIMIT $5
    `, [cardIds, windowStart, snapshotAt, lastId, QUERY_PAGE_SIZE]);
    rows.push(...page);
    if (page.length < QUERY_PAGE_SIZE) break;
    lastId = page[page.length - 1].id;
  }

  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.card_id, (counts.get(row.card_id) || 0) + 1);
  }

  return counts;
}

/**
 * Get top trending cards
 */
export async function getTrendingCards(
  limit: number = 10,
  game?: string
): Promise<TrendingCard[]> {
  try {
    const rows = await dbQuery<TrendingScoreRow>(`
      SELECT
        ts.card_id,
        ts.price_change_24h::float8 AS price_change_24h,
        ts.volume_24h::float8 AS volume_24h,
        ts.search_count_24h,
        ts.social_mentions_24h,
        ts.combined_score::float8 AS combined_score,
        json_build_object(
          'id', c.id,
          'name', c.name,
          'slug', c.slug,
          'image_url', c.image_url,
          'local_image_url', c.local_image_url,
          'sets', json_build_object(
            'name', s.name,
            'slug', s.slug,
            'games', json_build_object('slug', g.slug)
          )
        ) AS cards
      FROM trending_scores ts
      JOIN cards c ON c.id = ts.card_id
      JOIN sets s ON s.id = c.set_id
      JOIN games g ON g.id = s.game_id
      ${game ? 'WHERE g.slug = $2' : ''}
      ORDER BY ts.combined_score DESC NULLS LAST
      LIMIT $1
    `, game ? [limit, game] : [limit]);

    return rows.map((row) => {
    const card = Array.isArray(row.cards) ? row.cards[0] : row.cards;
    const set = card?.sets;
    const gameData = set?.games;

    return {
      cardId: row.card_id,
      cardName: card?.name || '',
      setName: set?.name || '',
      setSlug: set?.slug || '',
      slug: card?.slug || '',
      imageUrl: card?.local_image_url || card?.image_url || null,
      currentPrice: null, // Would need to join card_price_current
      priceChange24h: row.price_change_24h,
      volume24h: row.volume_24h,
      searchCount24h: row.search_count_24h,
      socialMentions24h: row.social_mentions_24h,
      combinedScore: row.combined_score,
      game: gameData?.slug || 'pokemon',
    };
    });
  } catch (error) {
    console.error('Error fetching trending cards:', error);
    return [];
  }
}

/**
 * Get market movers (biggest gainers and losers)
 */
export async function getMarketMovers(
  limit: number = 5
): Promise<{
  gainers: TrendingCard[];
  losers: TrendingCard[];
}> {
  try {
    const baseQuery = `
      SELECT
        ts.card_id,
        ts.price_change_24h::float8 AS price_change_24h,
        ts.volume_24h::float8 AS volume_24h,
        ts.search_count_24h,
        ts.social_mentions_24h,
        ts.combined_score::float8 AS combined_score,
        json_build_object(
          'id', c.id,
          'name', c.name,
          'slug', c.slug,
          'image_url', c.image_url,
          'local_image_url', c.local_image_url,
          'sets', json_build_object(
            'name', s.name,
            'slug', s.slug,
            'games', json_build_object('slug', g.slug)
          )
        ) AS cards
      FROM trending_scores ts
      JOIN cards c ON c.id = ts.card_id
      JOIN sets s ON s.id = c.set_id
      JOIN games g ON g.id = s.game_id
    `;
    const [gainersData, losersData] = await Promise.all([
      dbQuery<TrendingScoreRow>(`${baseQuery}
        WHERE ts.price_change_24h > 0
        ORDER BY ts.price_change_24h DESC
        LIMIT $1
      `, [limit]),
      dbQuery<TrendingScoreRow>(`${baseQuery}
        WHERE ts.price_change_24h < 0
        ORDER BY ts.price_change_24h ASC
        LIMIT $1
      `, [limit]),
    ]);

  const mapToTrending = (row: TrendingScoreRow): TrendingCard => {
    const card = Array.isArray(row.cards) ? row.cards[0] : row.cards;
    const set = card?.sets;
    const gameData = set?.games;

    return {
      cardId: row.card_id,
      cardName: card?.name || '',
      setName: set?.name || '',
      setSlug: set?.slug || '',
      slug: card?.slug || '',
      imageUrl: card?.local_image_url || card?.image_url || null,
      currentPrice: null,
      priceChange24h: row.price_change_24h,
      volume24h: row.volume_24h,
      searchCount24h: row.search_count_24h,
      socialMentions24h: row.social_mentions_24h,
      combinedScore: row.combined_score,
      game: gameData?.slug || 'pokemon',
    };
  };

  return {
    gainers: gainersData.map(mapToTrending),
    losers: losersData.map(mapToTrending),
  };
  } catch (error) {
    console.error('Error fetching market movers:', error);
    return { gainers: [], losers: [] };
  }
}

/**
 * Update trending scores for all cards
 * Called by Inngest job
 */
export async function updateAllTrendingScores(): Promise<{
  eligible: number;
  processed: number;
  updated: number;
  errors: string[];
}> {
  const supabase = createServerClient();
  const errors: string[] = [];
  let eligible = 0;
  let processed = 0;
  let updated = 0;

  try {
    // Stable pagination is required here: PostgREST otherwise returns only its
    // first 1,000 rows and silently excludes the rest of the catalog.
    const cards = await fetchAllEligibleCards();
    eligible = cards.length;

    if (cards.length === 0) {
      return { eligible: 0, processed: 0, updated: 0, errors: [] };
    }

    const snapshotAt = new Date().toISOString();
    const searchWindowStart = new Date(
      Date.parse(snapshotAt) - DAY_MS
    ).toISOString();
    const cardBatches = chunkCards(cards);

    console.info(
      `[trending] Processing ${eligible} eligible cards in ${cardBatches.length} ` +
        `batches (size ${CARD_BATCH_SIZE}, concurrency ${BATCH_CONCURRENCY})`
    );

    for (
      let batchIndex = 0;
      batchIndex < cardBatches.length;
      batchIndex += BATCH_CONCURRENCY
    ) {
      const concurrentBatches = cardBatches.slice(
        batchIndex,
        batchIndex + BATCH_CONCURRENCY
      );
      const batchResults = await Promise.all(
        concurrentBatches.map(async (batch, concurrentIndex) => {
          const absoluteBatchIndex = batchIndex + concurrentIndex + 1;
          const cardIds = batch.map((card) => card.id);
          try {
            const [priceHistoryResult, searchCountsResult] = await Promise.allSettled([
              fetchPriceHistoryForCards(cardIds, snapshotAt),
              fetchSearchCountsForCards(
                cardIds,
                searchWindowStart,
                snapshotAt
              ),
            ]);

            const historyByCard = new Map<string, PriceHistoryRow[]>();
            if (priceHistoryResult.status === 'fulfilled') {
              for (const row of priceHistoryResult.value) {
                const history = historyByCard.get(row.card_id) || [];
                history.push(row);
                historyByCard.set(row.card_id, history);
              }
            } else {
              errors.push(
                `Batch ${absoluteBatchIndex} price history: ${
                  priceHistoryResult.reason instanceof Error
                    ? priceHistoryResult.reason.message
                    : 'Unknown error'
                }`
              );
            }

            let searchCounts: Map<string, number> | null = null;
            if (searchCountsResult.status === 'fulfilled') {
              searchCounts = searchCountsResult.value;
            } else {
              errors.push(
                `Batch ${absoluteBatchIndex} search analytics: ${
                  searchCountsResult.reason instanceof Error
                    ? searchCountsResult.reason.message
                    : 'Unknown error'
                }`
              );
            }

            const calculatedAt = new Date().toISOString();
            const scoreRows = batch.map((card) => {
              const priceChange24h =
                priceHistoryResult.status === 'fulfilled'
                  ? calculatePriceChange24h(historyByCard.get(card.id) || [])
                  : null;
              const searchCount24h = searchCounts?.get(card.id) ??
                (searchCounts === null ? null : 0);

              // There is no sales-volume or social-mentions ingestion. Null
              // records that these metrics are unknown; zero would falsely claim
              // that the integrations measured no activity.
              const volume24h = null;
              const socialMentions24h = null;

              return {
                card_id: card.id,
                price_change_24h: priceChange24h,
                volume_24h: volume24h,
                search_count_24h: searchCount24h,
                social_mentions_24h: socialMentions24h,
                combined_score: calculateTrendingScore(
                  priceChange24h,
                  volume24h,
                  searchCount24h,
                  socialMentions24h
                ),
                calculated_at: calculatedAt,
              };
            });

            // Generated database types predate the confirmed nullable columns.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: upsertError } = await (supabase.from('trending_scores') as any)
              .upsert(scoreRows, { onConflict: 'card_id' });

            if (upsertError) {
              errors.push(`Batch ${absoluteBatchIndex} upsert: ${upsertError.message}`);
              return { processed: batch.length, updated: 0 };
            }

            return { processed: batch.length, updated: batch.length };
          } catch (error) {
            errors.push(
              `Batch ${absoluteBatchIndex}: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`
            );
            return { processed: batch.length, updated: 0 };
          }
        })
      );

      processed += batchResults.reduce(
        (total, result) => total + result.processed,
        0
      );
      updated += batchResults.reduce(
        (total, result) => total + result.updated,
        0
      );

      console.info(
        `[trending] Processed ${processed}/${eligible} cards; ` +
          `${updated} rows updated; ${errors.length} errors`
      );
    }

    if (processed !== eligible) {
      errors.push(
        `Processed-card mismatch: expected ${eligible}, processed ${processed}`
      );
    }

    if (updated !== eligible) {
      console.error(
        `[trending] Incomplete update: ${updated}/${eligible} rows updated`
      );
    } else {
      console.info(`[trending] Completed update for all ${eligible} eligible cards`);
    }

    if (errors.length > 0) {
      console.error(`[trending] Completed with ${errors.length} errors`);
    }

    if (updated === eligible && errors.length === 0) {
      try {
        // Publish a new cache only after a fully successful catalog update.
        const trending = await getTrendingCards(20);
        await redis.set('trending:cards', trending, { ex: 15 * 60 });
      } catch (error) {
        errors.push(
          `Trending cache: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    } else {
      console.error('[trending] Skipping cache publish after incomplete update');
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return { eligible, processed, updated, errors };
}
