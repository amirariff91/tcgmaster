/**
 * Fanatics Collect Multi-Year Historical Sales Ingestion Script
 *
 * Scrapes 5+ years of completed sales and auction transactions (2021-2026)
 * from Fanatics Collect (PWCC) Algolia index via GraphQL secured search key.
 *
 * Features:
 * - Targeted query by card name and number.
 * - Extracts verified sold transactions (grade, grading company, soldDate, purchasePrice).
 * - Safe data insertion into price_history with source='fanatics'.
 * - Recomputes card_price_current.graded_prices for multi-year Price Ladder & Charts.
 */

import 'dotenv/config';
import { pool } from '../lib/db/client';
import { fanaticsClient, type FanaticsHit } from '../lib/price-engine/fanatics';

// Map Fanatics grading services to standard grading company IDs
const GRADING_COMPANY_MAP: Record<string, string> = {
  PSA: '74c51627-cc4b-4a82-a1c0-52b3975b47b7',
  BGS: 'cda2045f-5d78-49e7-b1c8-de04dac9888d',
  CGC: 'dce6169f-8958-4229-861b-686a4644c984',
  SGC: '13bfcf84-df9b-4e89-a2e6-fa395e5d143c',
};

interface TargetCard {
  id: string;
  name: string;
  number: string;
  slug: string;
  set_name: string;
  game_slug: string;
}

export async function syncFanaticsForCard(card: TargetCard): Promise<{ hitsCount: number; insertedCount: number }> {
  // Normalize base number e.g. "OP05-119_p2" -> "OP05-119"
  const baseNum = card.number.replace(/[-_][pr]\d+$/i, '').trim();
  const cleanName = card.name
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim();

  const searchQuery = `${cleanName} ${baseNum}`.trim();

  let searchRes;
  try {
    searchRes = await fanaticsClient.search({
      query: searchQuery,
      status: 'Sold',
      hitsPerPage: 50,
    });
  } catch (err: any) {
    console.warn(`[Fanatics] Search failed for ${card.name}: ${err.message}`);
    return { hitsCount: 0, insertedCount: 0 };
  }

  if (!searchRes || !searchRes.hits || searchRes.hits.length === 0) {
    return { hitsCount: 0, insertedCount: 0 };
  }

  let insertedCount = 0;
  const numRegex = new RegExp(`(?:#|\\b)${baseNum.replace(/[-_]/g, '[-_]?')}(?:\\b|$)`, 'i');

  for (const hit of searchRes.hits) {
    const price = hit.purchasePrice || hit.currentPrice;
    if (!price || price <= 0) continue;

    // Verify card number match in title or subtitle to avoid drift
    const fullText = `${hit.title || ''} ${hit.subtitle || ''}`;
    if (!numRegex.test(fullText) && !fullText.toLowerCase().includes(baseNum.toLowerCase())) {
      continue;
    }

    // Protection against variant cross-contamination (e.g. Manga cards vs Base SEC cards)
    const isManga = card.slug.includes('manga') || card.number.includes('_p2');
    if (isManga && !/manga/i.test(fullText)) {
      continue;
    }

    // Determine grade & service
    let grade = 'raw';
    let companyId: string | null = null;

    if (hit.grade !== undefined && hit.grade !== null) {
      grade = String(hit.grade).trim();
    }
    if (hit.gradingService) {
      const s = hit.gradingService.toUpperCase().trim();
      companyId = GRADING_COMPANY_MAP[s] || null;
    }

    // Determine timestamp (soldDate is epoch seconds)
    const recordedAt = hit.soldDate
      ? new Date(hit.soldDate * 1000)
      : hit.auctionEndDatetime
      ? new Date(hit.auctionEndDatetime * 1000)
      : new Date();

    if (isNaN(recordedAt.getTime())) continue;

    try {
      const res = await pool.query(
        `
        INSERT INTO price_history (
          card_id, source, grade, grading_company_id, price, price_native, currency, recorded_at, price_kind
        )
        VALUES ($1, 'fanatics', $2, $3, $4, $4, 'USD', $5, 'sold_guide')
        ON CONFLICT DO NOTHING
        RETURNING id
        `,
        [card.id, grade, companyId, price, recordedAt.toISOString()]
      );

      if (res.rows.length > 0) {
        insertedCount++;
      }
    } catch (e: any) {
      // Ignore conflict / duplication errors
    }
  }

  // If new points were inserted, synthesize graded_prices in card_price_current
  if (insertedCount > 0) {
    try {
      const gradedComps = await pool.query(
        `
        SELECT grade, AVG(price)::numeric(10,2) as avg_price, MAX(recorded_at) as latest_sale
        FROM price_history
        WHERE card_id = $1 AND source IN ('fanatics', 'alt', 'pricecharting', 'snkrdunk') AND grade != 'raw'
        GROUP BY grade
        `,
        [card.id]
      );

      if (gradedComps.rows.length > 0) {
        const gradedPricesObj: Record<string, any> = {};
        for (const row of gradedComps.rows) {
          const gKey = `psa${row.grade.replace('.', '')}`;
          gradedPricesObj[gKey] = {
            average: parseFloat(row.avg_price),
            sources: { fanatics: parseFloat(row.avg_price) },
          };
        }

        await pool.query(
          `
          UPDATE card_price_current
          SET graded_prices = COALESCE(graded_prices, '{}'::jsonb) || $1::jsonb,
              computed_at = NOW()
          WHERE card_id = $2
          `,
          [JSON.stringify(gradedPricesObj), card.id]
        );
      }
    } catch (err: any) {
      console.warn(`[Fanatics] Graded price update error for ${card.name}:`, err.message);
    }
  }

  return { hitsCount: searchRes.hits.length, insertedCount };
}

async function main() {
  const args = process.argv.slice(2);
  const limitArgIdx = args.indexOf('--limit');
  const limit = limitArgIdx !== -1 ? parseInt(args[limitArgIdx + 1], 10) : 50;

  console.log('==================================================================');
  console.log(`Starting Fanatics Collect Multi-Year Historical Sales Ingestion (Limit: ${limit})`);
  console.log('==================================================================');

  // Query top chase cards: Manga cards, vintage holos, Secret Rares
  const cardsRes = await pool.query<TargetCard>(`
    SELECT c.id, c.name, c.number, c.slug, s.name as set_name, g.slug as game_slug
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    JOIN games g ON g.id = s.game_id
    WHERE (
      c.slug LIKE '%manga%'
      OR c.slug IN ('op-op05-119_p2', 'op-op01-120_p2', 'op-op09-118_p2', 'pokemon-neo4-113', 'pokemon-base1-4', 'pokemon-swsh7-215')
      OR (g.slug = 'pokemon' AND s.slug IN ('pokemon-base1', 'pokemon-neo4', 'pokemon-swsh7') AND c.rarity IN ('secret-rare', 'ultra-rare', 'holo-rare'))
      OR (g.slug = 'one-piece' AND c.rarity = 'secret-rare')
    )
    ORDER BY c.name ASC
    LIMIT $1
  `, [limit]);

  const cards = cardsRes.rows;
  console.log(`Found ${cards.length} high-value cards queued for Fanatics multi-year ingestion.\n`);

  let totalInserted = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    process.stdout.write(`[${i + 1}/${cards.length}] ${card.name} (#${card.number})... `);

    const { hitsCount, insertedCount } = await syncFanaticsForCard(card);
    totalInserted += insertedCount;

    console.log(`Found ${hitsCount} sales | Inserted ${insertedCount} historical records`);

    // Respect polite rate limits
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log('\n==================================================================');
  console.log(`Fanatics Multi-Year Ingestion Completed!`);
  console.log(`- Total historical sales points inserted: ${totalInserted}`);
  console.log('==================================================================');
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Fatal sync error:', err);
    process.exit(1);
  });
}
