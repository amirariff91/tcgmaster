/**
 * Sync Historical & Live Prices from Fanatics Collect
 *
 * Ingests historical auction sales (status: Sold) and lowest active Buy It Now listings (status: Live)
 * into price_history and updates card_price_current for matching cards.
 */

import 'dotenv/config';
import { dbQuery } from '../lib/db/client';
import { fanaticsClient, type FanaticsHit } from '../lib/price-engine/fanatics';
import { normalizeGrade } from '../lib/pricing/grades';

export interface SyncCard {
  id: string;
  name: string;
  number: string;
  set_name: string;
}

interface PriceHistoryInsert {
  card_id: string;
  source: string;
  grade: string;
  price: number;
  currency: string;
  recorded_at: string;
  price_kind: string;
}

/**
 * Validates whether a hit title matches the card number and name precisely
 */
function titleMatchesCard(title: string, cardNumber: string, cardName: string): boolean {
  const cleanTitle = title.toLowerCase().replace(/[\.\-]/g, ' ');
  // Strip variant suffixes like _p2, _r1 etc.
  const baseNum = cardNumber.split('_')[0].toLowerCase().trim();
  const cleanName = cardName
    .toLowerCase()
    .replace(/[\.\-]/g, ' ')
    .replace(/ ex| vstar| vmax| gx|\(.*\)/gi, '')
    .trim();

  if (!cleanTitle.includes(cleanName)) {
    return false;
  }

  // Exact card number match with word boundary or hash
  // e.g. "#199", " 199", "199/", "op05-119"
  const regexNum = new RegExp(`(?:#|\\b)${baseNum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\b|\\/)`, 'i');
  return regexNum.test(title);
}

export async function syncCardFanatics(card: SyncCard): Promise<{ historicalCount: number; activeCount: number }> {
  console.log(`\n▶ Processing Fanatics Collect for: ${card.name} #${card.number} (${card.set_name})`);

  const baseNum = card.number.split('_')[0].trim();
  const cleanName = card.name.replace(/\(.*\)/g, '').trim();
  const query = `${cleanName} ${baseNum}`.replace(/[#\/]/g, ' ').trim();

  // 1. Fetch Historical Sales (status: Sold)
  const soldRes = await fanaticsClient.search({
    query,
    status: 'Sold',
    hitsPerPage: 50,
  });

  const matchingSoldHits: FanaticsHit[] = soldRes.hits.filter(h =>
    h.currentPrice > 0 && h.soldDate && titleMatchesCard(h.title, card.number, card.name)
  );

  console.log(`  Found ${soldRes.nbHits} total sold hits, ${matchingSoldHits.length} verified matches`);

  // Check existing recorded_at timestamps in price_history for this card and source
  const existingHistory = await dbQuery<{ recorded_at: string }>(
    `SELECT recorded_at FROM price_history WHERE card_id = $1 AND source = 'fanatics'`,
    [card.id]
  );
  const existingTimestamps = new Set(existingHistory.map(r => new Date(r.recorded_at).toISOString()));

  const newHistoryRows: PriceHistoryInsert[] = [];

  for (const hit of matchingSoldHits) {
    if (!hit.soldDate) continue;
    const recordedAt = new Date(hit.soldDate * 1000).toISOString();
    if (existingTimestamps.has(recordedAt)) continue;

    const rawGradeString = `${hit.gradingService || ''} ${hit.grade || ''}`.trim() || 'raw';
    const canonicalGrade = normalizeGrade(rawGradeString);

    newHistoryRows.push({
      card_id: card.id,
      source: 'fanatics',
      grade: canonicalGrade,
      price: hit.currentPrice,
      currency: 'USD',
      recorded_at: recordedAt,
      price_kind: 'sold_guide',
    });
    existingTimestamps.add(recordedAt);
  }

  if (newHistoryRows.length > 0) {
    await dbQuery(
      `INSERT INTO price_history (card_id, source, grade, price, currency, recorded_at, price_kind)
       SELECT card_id, source::price_source, grade, price, currency, recorded_at, price_kind::price_kind
       FROM jsonb_to_recordset($1::jsonb) AS rows(
         card_id uuid,
         source text,
         grade text,
         price numeric,
         currency text,
         recorded_at timestamptz,
         price_kind text
       )`,
      [JSON.stringify(newHistoryRows)]
    );
    console.log(`  ✓ Inserted ${newHistoryRows.length} historical sales into price_history`);
  }

  // 2. Fetch Active Fixed Price Listings (Buy It Now)
  const fixedRes = await fanaticsClient.search({
    query,
    status: 'Live',
    marketplace: 'FIXED',
    hitsPerPage: 20,
  });

  const matchingFixedHits: FanaticsHit[] = fixedRes.hits.filter(h =>
    h.currentPrice > 0 && titleMatchesCard(h.title, card.number, card.name)
  );

  console.log(`  Found ${fixedRes.nbHits} total live fixed hits, ${matchingFixedHits.length} verified matches`);

  let lowestFixedHit: FanaticsHit | null = null;
  if (matchingFixedHits.length > 0) {
    // Sort ascending by currentPrice
    matchingFixedHits.sort((a, b) => a.currentPrice - b.currentPrice);
    lowestFixedHit = matchingFixedHits[0];
  }

  // 3. Update card_price_current
  if (lowestFixedHit) {
    const rawGradeString = `${lowestFixedHit.gradingService || ''} ${lowestFixedHit.grade || ''}`.trim() || 'raw';
    const canonicalGrade = normalizeGrade(rawGradeString);
    const itemUrl = fanaticsClient.getItemUrl(lowestFixedHit);

    const priceEntry = {
      price: lowestFixedHit.currentPrice,
      currency: 'USD',
      grade: canonicalGrade,
      url: itemUrl,
      recorded_at: new Date().toISOString(),
    };

    // Update source_prices in card_price_current (computed_at instead of updated_at)
    await dbQuery(
      `INSERT INTO card_price_current (card_id, source_prices, computed_at)
       VALUES ($1, jsonb_build_object('fanatics', $2::jsonb), NOW())
       ON CONFLICT (card_id) DO UPDATE
       SET source_prices = COALESCE(card_price_current.source_prices, '{}'::jsonb) || jsonb_build_object('fanatics', $2::jsonb),
           computed_at = NOW()`,
      [card.id, JSON.stringify(priceEntry)]
    );
    console.log(`  ✓ Updated card_price_current with lowest asking: $${lowestFixedHit.currentPrice} (${canonicalGrade}) -> ${itemUrl}`);
  }

  return {
    historicalCount: newHistoryRows.length,
    activeCount: matchingFixedHits.length,
  };
}

async function run() {
  const cards = await dbQuery<SyncCard>(`
    SELECT c.id, c.name, c.number, s.name as set_name
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    WHERE (c.name ILIKE '%Charizard%' AND c.number IN ('199', '223', '4'))
       OR (c.name ILIKE '%Luffy%' AND c.number ILIKE 'OP05-119%')
       OR (c.name ILIKE '%Pikachu%' AND c.number IN ('160', '205'))
    ORDER BY c.name ASC
    LIMIT 10;
  `);

  console.log(`Targeting ${cards.length} cards for Fanatics sync...`);

  for (const card of cards) {
    try {
      await syncCardFanatics(card);
    } catch (e) {
      console.error(`Failed to sync card ${card.name} #${card.number}:`, e);
    }
  }

  console.log('\nAll done sync-fanatics-history!');
  process.exit(0);
}

if (import.meta.main) {
  run();
}
