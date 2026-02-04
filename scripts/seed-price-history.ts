/**
 * Seed Script: Generate OHLC Price History
 *
 * Creates realistic mock OHLC price history data for cards.
 * - 90 days of daily data
 * - 2 years of weekly data (before the daily data)
 *
 * Usage:
 *   bun run scripts/seed-price-history.ts
 *
 * Environment variables required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration
const CONFIG = {
  // Number of days for daily OHLC data
  dailyDays: 90,
  // Number of weeks for weekly OHLC data (before daily data)
  weeklyWeeks: 104, // 2 years
  // Base volatility for price movement
  dailyVolatility: 0.025, // 2.5% daily
  weeklyVolatility: 0.05, // 5% weekly
  // Trend bias
  dailyTrend: 0.0005, // 0.05% daily upward bias
  // Spike probability
  spikeChance: 0.03, // 3% chance of a spike day
  spikeMultiplier: 2.5,
};

interface OHLCRecord {
  card_id: string;
  variant_id: string | null;
  grading_company_id: string | null;
  grade: string;
  period_start: string;
  period_type: 'daily' | 'weekly';
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
  is_generated: boolean;
  source: string;
}

/**
 * Generate random price movement
 */
function generatePriceMovement(
  currentPrice: number,
  volatility: number,
  trend: number,
  isSpike: boolean
): number {
  const effectiveVolatility = isSpike ? volatility * CONFIG.spikeMultiplier : volatility;
  const randomWalk = (Math.random() - 0.5) * 2 * effectiveVolatility;
  const dailyReturn = randomWalk + trend;
  return currentPrice * (1 + dailyReturn);
}

/**
 * Generate OHLC record for a single period
 */
function generateOHLC(
  cardId: string,
  grade: string,
  date: Date,
  periodType: 'daily' | 'weekly',
  openPrice: number,
  gradingCompanyId: string | null
): { record: Omit<OHLCRecord, 'card_id'>; closePrice: number } {
  const isSpike = Math.random() < CONFIG.spikeChance;
  const volatility = periodType === 'daily' ? CONFIG.dailyVolatility : CONFIG.weeklyVolatility;

  const closePrice = generatePriceMovement(openPrice, volatility, CONFIG.dailyTrend, isSpike);

  // Calculate intraday high/low with some noise
  const intradayNoise = volatility * 0.3;
  const high = Math.max(openPrice, closePrice) * (1 + Math.random() * intradayNoise);
  const low = Math.min(openPrice, closePrice) * (1 - Math.random() * intradayNoise);

  // Generate volume (correlated with price movement)
  const priceChange = Math.abs(closePrice - openPrice) / openPrice;
  const baseVolume = periodType === 'daily' ? 10 + Math.random() * 20 : 50 + Math.random() * 100;
  const volume = Math.round(baseVolume * (1 + priceChange * 5));

  return {
    record: {
      variant_id: null,
      grading_company_id: gradingCompanyId,
      grade,
      period_start: date.toISOString(),
      period_type: periodType,
      open_price: Math.max(0.01, Math.round(openPrice * 100) / 100),
      high_price: Math.max(0.01, Math.round(high * 100) / 100),
      low_price: Math.max(0.01, Math.round(low * 100) / 100),
      close_price: Math.max(0.01, Math.round(closePrice * 100) / 100),
      volume,
      is_generated: true,
      source: 'seed-script',
    },
    closePrice,
  };
}

/**
 * Generate complete OHLC history for a card/grade combination
 */
function generateCardHistory(
  cardId: string,
  grade: string,
  currentPrice: number,
  gradingCompanyId: string | null
): OHLCRecord[] {
  const records: OHLCRecord[] = [];
  const now = new Date();

  // Calculate historical starting price (work backwards from current)
  const totalDays = CONFIG.dailyDays + CONFIG.weeklyWeeks * 7;
  const annualGrowthRate = CONFIG.dailyTrend * 365;
  const yearsBack = totalDays / 365;
  let historicalPrice = currentPrice / Math.pow(1 + annualGrowthRate, yearsBack);

  // Generate weekly data first (older period)
  const weeklyStartDate = new Date(now);
  weeklyStartDate.setDate(weeklyStartDate.getDate() - CONFIG.dailyDays - CONFIG.weeklyWeeks * 7);

  let currentWeeklyPrice = historicalPrice;
  for (let w = 0; w < CONFIG.weeklyWeeks; w++) {
    const weekDate = new Date(weeklyStartDate);
    weekDate.setDate(weekDate.getDate() + w * 7);

    const { record, closePrice } = generateOHLC(
      cardId,
      grade,
      weekDate,
      'weekly',
      currentWeeklyPrice,
      gradingCompanyId
    );

    records.push({ ...record, card_id: cardId });
    currentWeeklyPrice = closePrice;
  }

  // Generate daily data (recent period)
  const dailyStartDate = new Date(now);
  dailyStartDate.setDate(dailyStartDate.getDate() - CONFIG.dailyDays);

  let currentDailyPrice = currentWeeklyPrice;
  for (let d = 0; d < CONFIG.dailyDays; d++) {
    const dayDate = new Date(dailyStartDate);
    dayDate.setDate(dayDate.getDate() + d);

    const { record, closePrice } = generateOHLC(
      cardId,
      grade,
      dayDate,
      'daily',
      currentDailyPrice,
      gradingCompanyId
    );

    records.push({ ...record, card_id: cardId });
    currentDailyPrice = closePrice;
  }

  return records;
}

/**
 * Get PSA grading company ID
 */
async function getPsaGradingCompanyId(): Promise<string | null> {
  const { data } = await supabase
    .from('grading_companies')
    .select('id')
    .eq('slug', 'psa')
    .single();

  return data?.id || null;
}

/**
 * Get cards with current prices to seed
 */
async function getCardsToSeed(): Promise<
  Array<{
    id: string;
    name: string;
    prices: Record<string, number>;
  }>
> {
  // Get cards with price cache
  const { data: cards } = await supabase
    .from('cards')
    .select(`
      id,
      name,
      price_cache (
        graded_prices
      )
    `)
    .not('price_cache', 'is', null)
    .limit(50);

  if (!cards) return [];

  return cards.map((card) => {
    const priceCache = card.price_cache as { graded_prices?: Record<string, { average?: number }> } | null;
    const gradedPrices = priceCache?.graded_prices || {};

    // Extract prices for different grades
    const prices: Record<string, number> = {
      raw: 100, // Default raw price
      '7': gradedPrices['psa7']?.average || 200,
      '8': gradedPrices['psa8']?.average || 400,
      '9': gradedPrices['psa9']?.average || 1000,
      '10': gradedPrices['psa10']?.average || 5000,
    };

    return {
      id: card.id,
      name: card.name,
      prices,
    };
  });
}

/**
 * Insert OHLC records in batches
 */
async function insertOHLCRecords(records: OHLCRecord[]): Promise<number> {
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    const { error } = await supabase.from('price_history_ohlc').upsert(batch, {
      onConflict: 'card_id,variant_id,grading_company_id,grade,period_start,period_type',
    });

    if (error) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  return inserted;
}

/**
 * Main seed function
 */
async function main() {
  console.log('Starting OHLC price history seed...\n');

  // Get PSA grading company ID
  const psaId = await getPsaGradingCompanyId();
  console.log(`PSA grading company ID: ${psaId || 'not found'}`);

  // Get cards to seed
  const cards = await getCardsToSeed();

  if (cards.length === 0) {
    console.log('\nNo cards found with price data. Creating sample data instead...');

    // Generate sample card data for demo purposes
    const sampleCards = [
      { id: 'demo-charizard', name: 'Charizard', prices: { raw: 500, '7': 800, '8': 1500, '9': 4200, '10': 42000 } },
      { id: 'demo-blastoise', name: 'Blastoise', prices: { raw: 150, '7': 300, '8': 600, '9': 1500, '10': 8500 } },
      { id: 'demo-venusaur', name: 'Venusaur', prices: { raw: 100, '7': 200, '8': 450, '9': 1200, '10': 6000 } },
    ];

    // Note: This won't actually insert because demo IDs don't exist in database
    console.log('Sample cards for reference:', sampleCards.map((c) => c.name).join(', '));
    console.log('\nPlease import cards first, then run this script again.');
    return;
  }

  console.log(`Found ${cards.length} cards to seed\n`);

  let totalInserted = 0;
  const grades = ['raw', '7', '8', '9', '10'];

  for (const card of cards) {
    console.log(`Processing: ${card.name}`);

    const allRecords: OHLCRecord[] = [];

    for (const grade of grades) {
      const price = card.prices[grade];
      if (!price || price <= 0) continue;

      const gradingCompanyId = grade === 'raw' ? null : psaId;
      const records = generateCardHistory(card.id, grade, price, gradingCompanyId);
      allRecords.push(...records);
    }

    const inserted = await insertOHLCRecords(allRecords);
    totalInserted += inserted;
    console.log(`  - Inserted ${inserted} records for ${grades.length} grades`);
  }

  console.log(`\nSeed complete! Total records inserted: ${totalInserted}`);
}

// Run the script
main().catch((error) => {
  console.error('Seed script failed:', error);
  process.exit(1);
});
