/**
 * Portfolio Analytics Service
 */

import { dbQuery } from '@/lib/db/client';
import type { Tables } from '@/lib/supabase/database.types';
import { lookupGraded, normalizeGrade } from '@/lib/pricing/grades';

// Type definitions for Supabase query results
interface CollectionItemRow {
  id: string;
  cost_basis: number | null;
  current_value: number | null;
  grade: string | null;
  grading_company_id: string | null;
  cards: {
    id: string;
    name: string;
    image_url: string | null;
    local_image_url: string | null;
    sets: { name: string };
  };
  collections: {
    user_id: string;
    type: string;
  };
}

interface CollectionItemForUpdate {
  id: string;
  card_id: string;
  grade: string | null;
  grading_company_id: string | null;
  collections: { user_id: string };
}

interface CurrentPriceRow {
  headline_cents: number | null;
  graded_prices: Record<string, { average?: number | null }>;
}

interface CollectionWithItems {
  id: string;
  user_id: string;
  name: string;
  type: 'personal' | 'investment' | 'for-sale' | 'wishlist' | 'custom';
  description: string | null;
  is_public: boolean;
  anonymous_share: boolean;
  share_token: string | null;
  total_value: number | null;
  total_cost_basis: number | null;
  items_count: number | null;
  created_at: string;
  updated_at: string;
  collection_items: Array<{
    cost_basis: number | null;
    current_value: number | null;
  }>;
}

interface PriceHistoryForDate {
  price: number;
  grade: string;
  recorded_at: string;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
  percentChange: number;
  cardsCount: number;
  collectionsCount: number;
  topPerformers: PortfolioCard[];
  worstPerformers: PortfolioCard[];
  valueBySet: Array<{ setName: string; value: number; percentage: number }>;
  valueByGrade: Array<{ grade: string; value: number; percentage: number }>;
  valueHistory: Array<{ date: string; value: number }>;
}

export interface PortfolioCard {
  id: string;
  cardName: string;
  setName: string;
  grade: string;
  costBasis: number;
  currentValue: number;
  gainLoss: number;
  percentChange: number;
  imageUrl: string | null;
}

/**
 * Get portfolio summary for a user
 */
export async function getPortfolioSummary(userId: string): Promise<PortfolioSummary | null> {
  let items: CollectionItemRow[];
  try {
    // JOIN the collection, card, and set relations into the old embedded shape.
    items = await dbQuery<CollectionItemRow>(`
      SELECT
        ci.id,
        ci.cost_basis::float8 AS cost_basis,
        ci.current_value::float8 AS current_value,
        ci.grade,
        ci.grading_company_id,
        json_build_object(
          'id', c.id,
          'name', c.name,
          'image_url', c.image_url,
          'local_image_url', c.local_image_url,
          'sets', json_build_object('name', s.name)
        ) AS cards,
        json_build_object(
          'user_id', col.user_id,
          'type', col.type
        ) AS collections
      FROM collection_items ci
      JOIN cards c ON c.id = ci.card_id
      JOIN sets s ON s.id = c.set_id
      JOIN collections col ON col.id = ci.collection_id
      WHERE col.user_id = $1
        AND col.type IN ('personal', 'investment')
    `, [userId]);
  } catch (error) {
    console.error('Failed to fetch portfolio:', error);
    return null;
  }

  // Calculate totals
  let totalValue = 0;
  let totalCostBasis = 0;
  const portfolioCards: PortfolioCard[] = [];
  const valueBySetMap = new Map<string, number>();
  const valueByGradeMap = new Map<string, number>();

  for (const item of items) {
    const card = Array.isArray(item.cards) ? item.cards[0] : item.cards;
    const set = card?.sets;
    const setName = set?.name || 'Unknown';

    const costBasis = item.cost_basis || 0;
    const currentValue = item.current_value || 0;
    const gainLoss = currentValue - costBasis;
    const percentChange = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0;

    totalValue += currentValue;
    totalCostBasis += costBasis;

    // Track by set
    valueBySetMap.set(setName, (valueBySetMap.get(setName) || 0) + currentValue);

    // Track by grade
    const gradeKey = item.grade || 'raw';
    valueByGradeMap.set(gradeKey, (valueByGradeMap.get(gradeKey) || 0) + currentValue);

    portfolioCards.push({
      id: item.id,
      cardName: card?.name || '',
      setName,
      grade: item.grade || 'raw',
      costBasis,
      currentValue,
      gainLoss,
      percentChange,
      imageUrl: card?.local_image_url || card?.image_url || null,
    });
  }

  // Sort for top/worst performers
  const sortedByPerformance = [...portfolioCards].sort((a, b) => b.percentChange - a.percentChange);

  // Get collections count
  const collectionCountRows = await dbQuery<{ count: number }>(
    'SELECT COUNT(*)::int AS count FROM collections WHERE user_id = $1',
    [userId],
  );
  const collectionsCount = collectionCountRows[0]?.count || 0;

  // Convert maps to arrays
  const valueBySet = Array.from(valueBySetMap.entries())
    .map(([setName, value]) => ({
      setName,
      value,
      percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const valueByGrade = Array.from(valueByGradeMap.entries())
    .map(([grade, value]) => ({
      grade,
      value,
      percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  return {
    totalValue,
    totalCostBasis,
    totalGainLoss: totalValue - totalCostBasis,
    percentChange: totalCostBasis > 0 ? ((totalValue - totalCostBasis) / totalCostBasis) * 100 : 0,
    cardsCount: portfolioCards.length,
    collectionsCount: collectionsCount || 0,
    topPerformers: sortedByPerformance.slice(0, 5),
    worstPerformers: sortedByPerformance.slice(-5).reverse(),
    valueBySet: valueBySet.slice(0, 10),
    valueByGrade,
    valueHistory: [], // Would need historical tracking
  };
}

/**
 * Update current values for all collection items
 * Called by Inngest job
 */
export async function updatePortfolioValues(userId?: string): Promise<{
  updated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let updated = 0;

  try {
    const typedItems = await dbQuery<CollectionItemForUpdate>(`
      SELECT
        ci.id,
        ci.card_id,
        ci.grade,
        ci.grading_company_id,
        json_build_object('user_id', c.user_id) AS collections
      FROM collection_items ci
      JOIN collections c ON c.id = ci.collection_id
      ${userId ? 'WHERE c.user_id = $1' : ''}
    `, userId ? [userId] : []);

    for (const item of typedItems) {
      try {
        // Get the single current price row for this card.
        const currentPriceRows = await dbQuery<CurrentPriceRow>(`
          SELECT headline_cents, graded_prices
          FROM card_price_current
          WHERE card_id = $1
          LIMIT 1
        `, [item.card_id]);
        const currentPrice = currentPriceRows[0] || null;

        if (!currentPrice) continue;

        let currentValue: number | null = null;
        const rawValue = currentPrice.headline_cents === null
          ? null
          : currentPrice.headline_cents / 100;
        const gradedPrices = currentPrice.graded_prices;

        const grade = normalizeGrade(item.grade);
        if (grade === 'raw') {
          currentValue = rawValue;
        } else {
          currentValue = lookupGraded(gradedPrices, grade)?.average || null;
        }

        if (currentValue !== null) {
          const updateParams = [currentValue, new Date().toISOString(), item.id];
          const updateFilter = userId
            ? `
                AND EXISTS (
                  SELECT 1
                  FROM collections c
                  WHERE c.id = ci.collection_id
                    AND c.user_id = $4
                )
              `
            : '';
          if (userId) updateParams.push(userId);

          await dbQuery(
            `
              UPDATE collection_items ci
              SET current_value = $1,
                  value_updated_at = $2
              WHERE ci.id = $3
              ${updateFilter}
            `,
            updateParams,
          );

          updated++;
        }
      } catch (err) {
        errors.push(`Item ${item.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return { updated, errors };
}

/**
 * Get historical price for a date (for auto-filling cost basis)
 */
export async function getHistoricalPrice(
  cardId: string,
  date: Date,
  grade?: string
): Promise<number | null> {
  // Look for price history record closest to the date
  const targetDate = date.toISOString().split('T')[0];

  const data = await dbQuery<PriceHistoryForDate>(`
    SELECT price::float8 AS price, grade, recorded_at
    FROM price_history
    WHERE card_id = $1
      AND recorded_at <= $2
    ORDER BY recorded_at DESC NULLS LAST
    LIMIT 10
  `, [cardId, `${targetDate}T23:59:59Z`]);

  if (!data || data.length === 0) {
    return null;
  }

  // Filter by grade if specified
  const targetGrade = grade || 'raw';
  const matchingRecord = data.find((r) => r.grade === targetGrade);

  if (matchingRecord) {
    return matchingRecord.price;
  }

  // Fall back to first record if no grade match
  return data[0].price;
}

/**
 * Calculate ROI for a card
 */
export function calculateROI(costBasis: number, currentValue: number, fees: number = 0): {
  gainLoss: number;
  percentChange: number;
  annualizedReturn?: number;
} {
  const totalCost = costBasis + fees;
  const gainLoss = currentValue - totalCost;
  const percentChange = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;

  return {
    gainLoss,
    percentChange,
  };
}

/**
 * Get collection breakdown for a user
 */
export async function getCollectionBreakdown(userId: string): Promise<Array<{
  collection: Tables<'collections'>;
  itemsCount: number;
  totalValue: number;
  totalCostBasis: number;
  gainLoss: number;
}>> {
  const collections = await dbQuery<CollectionWithItems>(`
    SELECT
      col.id,
      col.user_id,
      col.name,
      col.type,
      col.description,
      col.is_public,
      col.anonymous_share,
      col.share_token,
      col.total_value::float8 AS total_value,
      col.total_cost_basis::float8 AS total_cost_basis,
      col.items_count,
      col.created_at,
      col.updated_at,
      COALESCE((
        SELECT json_agg(json_build_object(
          'cost_basis', ci.cost_basis::float8,
          'current_value', ci.current_value::float8
        ) ORDER BY ci.id)
        FROM collection_items ci
        WHERE ci.collection_id = col.id
      ), '[]'::json) AS collection_items
    FROM collections col
    WHERE col.user_id = $1
    ORDER BY col.created_at DESC NULLS LAST
  `, [userId]);

  return collections.map((collection) => {
    const items = collection.collection_items || [];
    const totalValue = items.reduce((sum, item) => sum + (item.current_value || 0), 0);
    const totalCostBasis = items.reduce((sum, item) => sum + (item.cost_basis || 0), 0);

    return {
      collection: {
        id: collection.id,
        user_id: collection.user_id,
        name: collection.name,
        type: collection.type,
        description: collection.description,
        is_public: collection.is_public,
        anonymous_share: collection.anonymous_share,
        share_token: collection.share_token,
        total_value: collection.total_value ?? 0,
        total_cost_basis: collection.total_cost_basis ?? 0,
        items_count: collection.items_count ?? 0,
        created_at: collection.created_at,
        updated_at: collection.updated_at,
      },
      itemsCount: items.length,
      totalValue,
      totalCostBasis,
      gainLoss: totalValue - totalCostBasis,
    };
  });
}
