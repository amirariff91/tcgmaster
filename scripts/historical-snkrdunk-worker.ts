import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

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

      const insertRows = soldListings.map((listing) => {
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
          price: listing.priceAmount,
          currency: listing.currency || 'USD',
          recorded_at: recordedAt,
        };
      }).filter(Boolean);

      if (insertRows.length > 0) {
        const oldest = insertRows.reduce((min, r) => r.recorded_at < min ? r.recorded_at : min, insertRows[0].recorded_at);
        const newest = insertRows.reduce((max, r) => r.recorded_at > max ? r.recorded_at : max, insertRows[0].recorded_at);

        const { data: existingRows } = await supabase
          .from('price_history')
          .select('recorded_at')
          .eq('card_id', cardId)
          .eq('source', 'snkrdunk')
          .gte('recorded_at', oldest)
          .lte('recorded_at', newest);

        const existingDates = new Set(existingRows?.map(r => r.recorded_at) || []);
        const newRows = insertRows.filter(r => !existingDates.has(r.recorded_at));

        if (newRows.length > 0) {
          const { error } = await supabase
            .from('price_history')
            .insert(newRows);

          if (error) {
            console.error(`  ✗ Error inserting rows:`, error.message);
          } else {
            totalSaved += newRows.length;
          }
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
  const { data: latestPrices, error: historyError } = await supabase
    .from('price_history')
    .select('source, grade, price')
    .eq('card_id', cardId)
    .order('recorded_at', { ascending: false });

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

    const { data: existingCurrent } = await supabase
      .from('card_price_current')
      .select('graded_prices, source_prices, headline_cents, headline_source, headline_kind, headline_currency, headline_grade, computed_at')
      .eq('card_id', cardId)
      .maybeSingle();

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

    await supabase.from('card_price_current').upsert(currentRow, { onConflict: 'card_id' });
  }

  await supabase.from('cards').update({
    historical_fetched: true,
    last_price_fetch: new Date().toISOString(),
    curation_status: 'pending',
  }).eq('id', cardId);

  return totalSaved;
}

async function run() {
  console.log('🤖 Starting Continuous 24/7 Rolling Snkrdunk Historical Trade Ingestion Engine...');

  while (true) {
    try {
      // Continuous 24/7 Rolling Queue: Order by last_price_fetch ASC (Nulls First)
      const { data: cards, error } = await supabase
        .from('cards')
        .select('id, slug, name, snkrdunk_url, last_price_fetch')
        .not('snkrdunk_url', 'is', null)
        .like('slug', 'op-%-ja')
        .order('last_price_fetch', { ascending: true, nullsFirst: true })
        .limit(50);

      if (error) {
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
          await supabase.from('cards').update({ last_price_fetch: new Date().toISOString() }).eq('id', card.id);
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
