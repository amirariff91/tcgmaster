import 'dotenv/config';
import { dbQuery } from '../lib/db/client';

type JsonRecord = Record<string, unknown>;
type ListingRecord = JsonRecord & {
  isSold?: boolean;
  priceAmount?: number;
  listingUID?: string;
  condition?: string;
  currency?: string;
};
type HistoricalPriceRow = {
  source: string;
  grade: string;
  price: number;
};
type GradedPrice = {
  average: number;
  sources: Record<string, number>;
};
type PriceHistoryInsert = {
  card_id: string;
  source: string;
  grade: string;
  grading_company_id: string | null;
  price: number;
  currency: string;
  recorded_at: string;
};
type HistoricalPriceExistingRow = {
  recorded_at: string | Date;
};
type CurrentPriceRow = {
  graded_prices: Record<string, Partial<GradedPrice>> | null;
  source_prices: Record<string, unknown> | null;
  headline_cents: number | null;
  headline_source: string | null;
  headline_kind: string | null;
  headline_currency: string | null;
  headline_grade: string | null;
  computed_at: string | Date | null;
};
type QueueCard = {
  id: string;
  slug: string;
  name: string;
  snkrdunk_url: string;
  last_price_fetch: string | Date | null;
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

const Crockford32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Decode Crockford Base32 ULID string to Date object
 */
function decodeUlidTime(ulid: string): Date {
  if (!ulid || ulid.length < 10) return new Date();
  const timePart = ulid.substring(0, 10).toUpperCase();
  let time = 0;
  for (let i = 0; i < timePart.length; i++) {
    const index = Crockford32.indexOf(timePart[i]);
    if (index !== -1) {
      time = time * 32 + index;
    }
  }
  return new Date(time);
}

/**
 * Extract numeric Snkrdunk product ID from snkrdunk_url or card attributes
 */
function extractSnkrdunkId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:trading-cards|products|streetwears)\/(\d+)/i) || url.match(/\/(\d+)(?:\?|$)/);
  return match ? match[1] : null;
}

async function fetchHistoricalSalesForCard(cardId: string, snkrdunkId: string) {
  const productCode = `SW---${snkrdunkId}`;
  let totalSaved = 0;
  let page = 1;
  const maxPages = 200; // Uncapped deep historical search (up to 20,000 sales per card)

  console.log(`  -> Uncapped Deep Snkrdunk Sales Ingestion for product ${productCode}...`);

  while (page <= maxPages) {
    try {
      const url = `https://snkrdunk.com/en/v1/products/${productCode}/used-listings?perPage=100&page=${page}&sortType=latest&isOnlyOnSale=false`;
      const res = await fetch(url, { headers: HEADERS });

      if (!res.ok) {
        console.warn(`  ! HTTP ${res.status} fetching page ${page} for ${productCode}`);
        break;
      }

      const data = await res.json() as { usedListings?: unknown };
      const listings = Array.isArray(data.usedListings)
        ? data.usedListings.filter((listing): listing is ListingRecord => typeof listing === 'object' && listing !== null)
        : [];

      if (listings.length === 0) break;

      const soldListings = listings.filter((listing) => listing.isSold === true && Number(listing.priceAmount) > 0);

      const insertRows = soldListings.map((listing): PriceHistoryInsert | null => {
        const recordedAt = decodeUlidTime(listing.listingUID || '').toISOString();

        let parsedGrade = 'raw';
        let gradingCompany = null;
        const condition = listing.condition || 'A';

        // Filter out unwanted Raw conditions
        if (['B', 'C', 'D'].includes(condition)) {
          return null;
        }

        // Regex to parse things like "PSA 10", "BGS 9.5", "CGC Pristine 10", "ARS 10+"
        // It captures the company name and the numeric grade.
        const gradeMatch = condition.match(/^(PSA|BGS|CGC|TAG|AGS|ARS)(?:\s+Pristine|\s+Perfect|\s+Black Label|\s+Gold Label)?\s+([0-9]+\.?[0-9]*\+?)$/i);

        if (gradeMatch) {
           gradingCompany = gradeMatch[1].toLowerCase();
           parsedGrade = gradeMatch[2].replace('+', '');
        } else if (condition.includes('PSA')) {
           // Fallback for weirdly formatted PSA
           const m = condition.match(/PSA\s*([0-9]+\.?[0-9]*)/i);
           if (m) { gradingCompany = 'psa'; parsedGrade = m[1]; }
        }

        const COMPANY_UUIDS: Record<string, string> = {
          psa: '74c51627-cc4b-4a82-a1c0-52b3975b47b7',
          bgs: 'cda2045f-5d78-49e7-b1c8-de04dac9888d',
          cgc: 'dce6169f-8958-4229-861b-686a4644c984',
          sgc: '7a7b5849-788b-40f6-9f42-14f2f27f68b3',
          tag: 'da09e2df-2464-40f2-ae0e-0296253d811f'
        };
        const finalCompanyId = gradingCompany ? COMPANY_UUIDS[gradingCompany] || null : null;

        return {
          card_id: cardId,
          source: 'snkrdunk',
          grade: parsedGrade,
          grading_company_id: finalCompanyId,
          price: Number(listing.priceAmount),
          currency: listing.currency || 'USD',
          recorded_at: recordedAt,
        };
      }).filter((row): row is PriceHistoryInsert => row !== null);

      if (insertRows.length > 0) {
        const oldest = insertRows.reduce((min, r) => r.recorded_at < min ? r.recorded_at : min, insertRows[0].recorded_at);
        const newest = insertRows.reduce((max, r) => r.recorded_at > max ? r.recorded_at : max, insertRows[0].recorded_at);

        const existingRows = await dbQuery<HistoricalPriceExistingRow>(`
          SELECT recorded_at
          FROM price_history
          WHERE card_id = $1
            AND source = $2
            AND recorded_at >= $3
            AND recorded_at <= $4
        `, [cardId, 'snkrdunk', oldest, newest]);

        const existingDates = new Set(existingRows.map((row) => (
          row.recorded_at instanceof Date
            ? row.recorded_at.toISOString()
            : new Date(row.recorded_at).toISOString()
        )));
        const newRows = insertRows.filter(r => !existingDates.has(r.recorded_at));

        if (newRows.length > 0) {
          try {
            await dbQuery(
              `INSERT INTO price_history (
                 card_id, source, grade, grading_company_id, price, currency, recorded_at
               )
               SELECT card_id, source::price_source, grade, grading_company_id,
                      price, currency, recorded_at
               FROM jsonb_to_recordset($1::jsonb) AS rows(
                 card_id uuid,
                 source text,
                 grade text,
                 grading_company_id uuid,
                 price numeric,
                 currency text,
                 recorded_at timestamptz
               )`,
              [JSON.stringify(newRows)],
            );
            totalSaved += newRows.length;
          } catch (error) {
            console.error(
              `  ✗ Error inserting rows:`,
              error instanceof Error ? error.message : String(error),
            );
          }
        } else {
          console.log(`  ✓ Caught up to existing history at page ${page}. Breaking early.`);
          break;
        }
      }

      page++;
      await new Promise(r => setTimeout(r, 400)); // Smooth rate limiting
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Error fetching page ${page}:`, message);
      break;
    }
  }

  // Update card_price_current.graded_prices based on the latest price_history
  let latestPrices: HistoricalPriceRow[] = [];
  let historyError: unknown = null;
  try {
    latestPrices = await dbQuery<HistoricalPriceRow>(`
      SELECT source, grade, price::double precision AS price
      FROM price_history
      WHERE card_id = $1
      ORDER BY recorded_at DESC
    `, [cardId]);
  } catch (error) {
    historyError = error;
  }

  if (!historyError && latestPrices && latestPrices.length > 0) {
    // Keep only the latest price per (source, grade)
    const latestPerSourceGrade = new Map<string, HistoricalPriceRow>();
    for (const row of latestPrices) {
      const key = `${row.source}\u0000${row.grade}`;
      if (!latestPerSourceGrade.has(key)) {
        latestPerSourceGrade.set(key, row);
      }
    }

    // Group by grade
    const grouped = new Map<string, HistoricalPriceRow[]>();
    for (const row of latestPerSourceGrade.values()) {
      if (row.grade === 'raw') continue;

      let grade = String(row.grade).toLowerCase().trim();
      if (/^\d+(?:\.\d+)?$/.test(grade)) {
        grade = `psa${grade.replace('.', '')}`;
      } else if (grade.startsWith('psa')) {
        const match = grade.match(/^psa[\s-]?(\d+(?:\.\d+)?)$/);
        if (match) {
          grade = `psa${match[1].replace('.', '')}`;
        }
      }

      const group = grouped.get(grade) ?? [];
      group.push(row);
      grouped.set(grade, group);
    }

    const freshGradedPrices: Record<string, GradedPrice> = {};
    for (const [grade, rows] of grouped.entries()) {
      const sources: Record<string, number> = {};
      let sum = 0;
      for (const row of rows) {
        sources[row.source] = row.price;
        sum += row.price;
      }
      freshGradedPrices[grade] = {
        average: sum / rows.length,
        sources,
      };
    }

    const currentRows = await dbQuery<CurrentPriceRow>(`
      SELECT graded_prices, source_prices, headline_cents, headline_source,
             headline_kind, headline_currency, headline_grade, computed_at
      FROM card_price_current
      WHERE card_id = $1
      LIMIT 1
    `, [cardId]);
    const existingCurrent = currentRows[0] ?? null;

    const existingGraded = (existingCurrent?.graded_prices || {}) as Record<string, Partial<GradedPrice>>;
    const mergedGraded: Record<string, GradedPrice> = { ...existingGraded } as Record<string, GradedPrice>;

    for (const [grade, fresh] of Object.entries(freshGradedPrices)) {
      const exGrade = existingGraded[grade];
      const sources = {
        ...(exGrade?.sources ?? {}),
        ...fresh.sources,
      };
      const values = Object.values(sources) as number[];
      mergedGraded[grade] = {
        average: values.reduce((sum, val) => sum + val, 0) / values.length,
        sources,
      };
    }

    const currentRow = {
      card_id: cardId,
      source_prices: existingCurrent?.source_prices || {},
      graded_prices: mergedGraded,
      headline_cents: existingCurrent?.headline_cents ?? null,
      headline_source: existingCurrent?.headline_source ?? null,
      headline_kind: existingCurrent?.headline_kind ?? null,
      headline_currency: existingCurrent?.headline_currency ?? null,
      headline_grade: existingCurrent?.headline_grade ?? null,
      computed_at: existingCurrent?.computed_at ?? new Date().toISOString(),
    };

    await dbQuery(
      `INSERT INTO card_price_current (
         card_id, source_prices, graded_prices, headline_cents, headline_source,
         headline_kind, headline_currency, headline_grade, computed_at
       )
       VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (card_id) DO UPDATE SET
         source_prices = EXCLUDED.source_prices,
         graded_prices = EXCLUDED.graded_prices,
         headline_cents = EXCLUDED.headline_cents,
         headline_source = EXCLUDED.headline_source,
         headline_kind = EXCLUDED.headline_kind,
         headline_currency = EXCLUDED.headline_currency,
         headline_grade = EXCLUDED.headline_grade,
         computed_at = EXCLUDED.computed_at`,
      [
        currentRow.card_id,
        JSON.stringify(currentRow.source_prices),
        JSON.stringify(currentRow.graded_prices),
        currentRow.headline_cents,
        currentRow.headline_source,
        currentRow.headline_kind,
        currentRow.headline_currency,
        currentRow.headline_grade,
        currentRow.computed_at,
      ],
    );
  }

  await dbQuery(
    `UPDATE cards
     SET snkrdunk_fetched = TRUE,
         last_price_fetch = $1,
         curation_status = $2
     WHERE id = $3`,
    [new Date().toISOString(), 'pending', cardId],
  );

  return totalSaved;
}

async function run() {
  console.log('🤖 Starting Continuous 24/7 Rolling Snkrdunk Historical Trade Ingestion Engine...');

  while (true) {
    try {
      // Continuous 24/7 Rolling Queue: Order by last_price_fetch ASC (Nulls First)
      let cards: QueueCard[] = [];
      try {
        // Phase 0: Manga Cards Priority
        const MANGA_SLUGS = [
          'op-op01-120_p2-ja', 'op-op01-120_r2-ja', 'op-op02-013_p2-ja', 'op-op02-013_r1-ja',
          'op-op03-122_p2-ja', 'op-op03-122_r1-ja', 'op-op04-083_p2-ja', 'op-op04-083_r1-ja',
          'op-op05-119_p2-ja', 'op-op05-119_r2-ja', 'op-op05-069_p2-ja', 'op-op05-069_r1-ja',
          'op-op05-074_p2-ja', 'op-op05-074_r2-ja', 'op-op06-118_p2-ja', 'op-eb01-006_p2-ja',
          'op-eb01-006_r1-ja', 'op-op07-051_p2-ja', 'op-op08-118_p2-ja', 'op-op09-119_p2-ja',
          'op-op09-093_p2-ja', 'op-op09-004_p2-ja', 'op-op09-051_p2-ja', 'op-op09-118_p2-ja',
          'op-op10-119_p2-ja', 'op-eb02-061_p2-ja', 'op-op11-118_p2-ja', 'op-op12-118_p2-ja',
          'op-op06-119_p3-ja', 'op-op13-119_p3-ja', 'op-op13-119_p1-ja', 'op-op13-120_p3-ja',
          'op-op13-120_p2-ja', 'op-op13-118_p3-ja', 'op-op13-118_p2-ja', 'op-op14-119_p2-ja',
          'op-op15-118_p2-ja', 'op-eb03-uta_p2-ja', 'op-eb04-koby_p2-ja', 'op-op16-065_p2-ja',
          'op-op16-073_p2-ja', 'op-op16-063_p2-ja'
        ];

        cards = await dbQuery<QueueCard>(`
          SELECT id, slug, name, snkrdunk_url, last_price_fetch
          FROM cards
          WHERE snkrdunk_url IS NOT NULL
            AND slug = ANY($1::text[])
            AND snkrdunk_fetched = FALSE
          ORDER BY last_price_fetch ASC NULLS FIRST
          LIMIT 50
        `, [MANGA_SLUGS]);

        // Phase 1: Japanese One Piece Priority (unfetched)
        if (cards.length === 0) {
          cards = await dbQuery<QueueCard>(`
            SELECT id, slug, name, snkrdunk_url, last_price_fetch
            FROM cards
            WHERE snkrdunk_url IS NOT NULL
              AND slug LIKE 'op-%-ja'
              AND snkrdunk_fetched = FALSE
            ORDER BY last_price_fetch ASC NULLS FIRST
            LIMIT 50
          `);
        }

        // Phase 2: Other TCGs Expansion (unfetched)
        if (cards.length === 0) {
          cards = await dbQuery<QueueCard>(`
            SELECT id, slug, name, snkrdunk_url, last_price_fetch
            FROM cards
            WHERE snkrdunk_url IS NOT NULL
              AND snkrdunk_fetched = FALSE
            ORDER BY last_price_fetch ASC NULLS FIRST
            LIMIT 50
          `);
        }

        // Phase 3: Rolling Maintenance (all cards)
        if (cards.length === 0) {
          cards = await dbQuery<QueueCard>(`
            SELECT id, slug, name, snkrdunk_url, last_price_fetch
            FROM cards
            WHERE snkrdunk_url IS NOT NULL
            ORDER BY last_price_fetch ASC NULLS FIRST
            LIMIT 50
          `);
        }
      } catch (error) {
        console.error('Error querying cards queue:', error);
        await new Promise(r => setTimeout(r, 30000));
        continue;
      }

      const processQueue = cards || [];

      if (processQueue.length === 0) {
        console.log('Queue empty. Retrying in 15 seconds...');
        await new Promise(r => setTimeout(r, 15000));
        continue;
      }

      console.log(`Processing continuous batch of ${processQueue.length} cards for Snkrdunk historical trade backfill...`);

      for (const card of processQueue) {
        const snkrdunkId = extractSnkrdunkId(card.snkrdunk_url);
        if (!snkrdunkId) {
          await dbQuery(
            `UPDATE cards SET last_price_fetch = $1 WHERE id = $2`,
            [new Date().toISOString(), card.id],
          );
          continue;
        }

        console.log(`Ingesting ${card.slug} (${card.name}) [Snkrdunk ID: ${snkrdunkId}]...`);
        const savedCount = await fetchHistoricalSalesForCard(card.id, snkrdunkId);
        console.log(`  ✓ Saved ${savedCount} historical Snkrdunk trades for ${card.slug}`);

        await new Promise(r => setTimeout(r, 600));
      }

      console.log('Batch complete. Recirculating to next batch in 5s...');
      await new Promise(r => setTimeout(r, 5000));
    } catch (loopErr: unknown) {
      console.error('Unexpected error in worker loop:', loopErr);
      await new Promise(r => setTimeout(r, 15000));
    }
  }
}

run().catch(err => {
  console.error('Fatal Snkrdunk Historical worker error:', err);
  process.exit(1);
});
