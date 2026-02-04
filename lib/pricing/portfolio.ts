/**
 * Portfolio Analytics Service
 */

import { createServerClient } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/database.types';

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

interface PriceCacheRow {
  raw_prices: Record<string, number>;
  graded_prices: Record<string, { average: number }>;
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
  const supabase = createServerClient();

  // Get all collection items with card and pricing data
  const { data: items, error } = await supabase
    .from('collection_items')
    .select(`
      id,
      cost_basis,
      current_value,
      grade,
      grading_company_id,
      cards!inner (
        id,
        name,
        image_url,
        local_image_url,
        sets!inner (name)
      ),
      collections!inner (
        user_id,
        type
      )
    `)
    .eq('collections.user_id', userId)
    .in('collections.type', ['personal', 'investment']);

  if (error || !items) {
    console.error('Failed to fetch portfolio:', error);
    return null;
  }

  const typedItems = items as CollectionItemRow[];

  // Calculate totals
  let totalValue = 0;
  let totalCostBasis = 0;
  const portfolioCards: PortfolioCard[] = [];
  const valueBySetMap = new Map<string, number>();
  const valueByGradeMap = new Map<string, number>();

  for (const item of typedItems) {
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
  const { count: collectionsCount } = await supabase
    .from('collections')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

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
  const supabase = createServerClient();
  const errors: string[] = [];
  let updated = 0;

  try {
    let query = supabase
      .from('collection_items')
      .select(`
        id,
        card_id,
        grade,
        grading_company_id,
        collections!inner (user_id)
      `);

    if (userId) {
      query = query.eq('collections.user_id', userId);
    }

    const { data: items } = await query;

    if (!items) return { updated: 0, errors };

    const typedItems = items as CollectionItemForUpdate[];

    for (const item of typedItems) {
      try {
        // Get current price from cache
        const { data: priceCacheData } = await supabase
          .from('price_cache')
          .select('raw_prices, graded_prices')
          .eq('card_id', item.card_id)
          .single();

        const priceCache = priceCacheData as PriceCacheRow | null;

        if (!priceCache) continue;

        let currentValue: number | null = null;
        const rawPrices = priceCache.raw_prices;
        const gradedPrices = priceCache.graded_prices;

        if (!item.grade || item.grade === 'raw') {
          currentValue = rawPrices?.nearMint || null;
        } else {
          const gradeKey = item.grade.replace('.', '');
          currentValue = gradedPrices?.[gradeKey]?.average || null;
        }

        if (currentValue !== null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('collection_items') as any)
            .update({
              current_value: currentValue,
              value_updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);

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
  const supabase = createServerClient();

  // Look for price history record closest to the date
  const targetDate = date.toISOString().split('T')[0];

  const { data } = await supabase
    .from('price_history')
    .select('price, grade, recorded_at')
    .eq('card_id', cardId)
    .lte('recorded_at', `${targetDate}T23:59:59Z`)
    .order('recorded_at', { ascending: false })
    .limit(10);

  if (!data || data.length === 0) {
    return null;
  }

  const typedData = data as PriceHistoryForDate[];

  // Filter by grade if specified
  const targetGrade = grade || 'raw';
  const matchingRecord = typedData.find((r) => r.grade === targetGrade);

  if (matchingRecord) {
    return matchingRecord.price;
  }

  // Fall back to first record if no grade match
  return typedData[0].price;
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
  const supabase = createServerClient();

  const { data: collections } = await supabase
    .from('collections')
    .select(`
      *,
      collection_items (
        cost_basis,
        current_value
      )
    `)
    .eq('user_id', userId);

  if (!collections) return [];

  const typedCollections = collections as CollectionWithItems[];

  return typedCollections.map((collection) => {
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
