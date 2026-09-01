import * as cheerio from 'cheerio';
import { getSharedBrowser } from '../lib/price-engine/browser';
import { dbQuery } from '../lib/db/client';

import 'dotenv/config';

type HistoricalPriceRow = {
  source: string;
  grade: string;
  price: number;
  recorded_at: string;
};
type GradedPrice = {
  average: number;
  sources: Record<string, number>;
};
type QueueCard = {
  id: string;
  name: string;
  slug: string;
  number: string;
  pricecharting_url: string;
  last_price_fetch: string | Date | null;
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
type HistoricalPriceExistingRow = {
  recorded_at: string | Date;
  grade: string;
};

const SLEEP_MS = 30000;

async function run() {
  console.log(`Starting Continuous Historical PriceCharting Worker [SLEEP=${SLEEP_MS}ms]...`);

  while (true) {
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
        SELECT id, name, slug, number, pricecharting_url, last_price_fetch
        FROM cards
        WHERE pricecharting_url IS NOT NULL
          AND slug = ANY($1::text[])
          AND pc_fetched = FALSE
        ORDER BY last_price_fetch ASC NULLS FIRST
        LIMIT 1
      `, [MANGA_SLUGS]);

      // Phase 1: Japanese OP Priority
      if (cards.length === 0) {
        cards = await dbQuery<QueueCard>(`
          SELECT id, name, slug, number, pricecharting_url, last_price_fetch
          FROM cards
          WHERE pricecharting_url IS NOT NULL
            AND slug LIKE 'op-%-ja'
            AND pc_fetched = FALSE
          ORDER BY last_price_fetch ASC NULLS FIRST
          LIMIT 1
        `);
      }

      // Phase 2: Other TCGs (DBFW and English OP)
      if (cards.length === 0) {
        cards = await dbQuery<QueueCard>(`
          SELECT id, name, slug, number, pricecharting_url, last_price_fetch
          FROM cards
          WHERE pricecharting_url IS NOT NULL
            AND (slug LIKE 'op-%-en' OR slug LIKE 'fb%' OR slug LIKE 'fs%')
            AND pc_fetched = FALSE
          ORDER BY last_price_fetch ASC NULLS FIRST
          LIMIT 1
        `);
      }

      // Phase 3: Rolling Maintenance
      if (cards.length === 0) {
        cards = await dbQuery<QueueCard>(`
          SELECT id, name, slug, number, pricecharting_url, last_price_fetch
          FROM cards
          WHERE pricecharting_url IS NOT NULL
          ORDER BY last_price_fetch ASC NULLS FIRST
          LIMIT 1
        `);
      }
    } catch (e) {
      console.error('Error fetching queue:', e);
    }

    if (cards.length === 0) {
      console.log('No cards found with PriceCharting URL. Sleeping...');
      await new Promise(r => setTimeout(r, SLEEP_MS));
      continue;
    }

    const card = cards[0];
    const pcQueryOrUrl = card.pricecharting_url;
    const cardId = card.id;

    console.log(`\nIngesting ${card.slug} (${card.name}) [PC URL: ${pcQueryOrUrl}]...`);

    let page;
    try {
      const browser = await getSharedBrowser();
      page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

      console.log(`  -> Loading ${pcQueryOrUrl}...`);
      await page.goto(pcQueryOrUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

      try {
         await page.waitForSelector('table.hoverable-striped', { timeout: 15000 });
      } catch (e) {
         console.log('  ! Timeout waiting for table (Cloudflare block?).');
      }

      const html = await page.content();
      const $ = cheerio.load(html);

      const tables = $('table.hoverable-striped');
      if (tables.length === 0) {
         console.log('  ✗ No sales tables found. Saving timestamp and moving on.');
      } else {
         const insertRows: any[] = [];

         tables.each((_, table) => {
            const tableId = $(table).attr('id') || '';
            let parsedGrade = 'raw';

            if (tableId.includes('grade10')) parsedGrade = '10';
            else if (tableId.includes('grade9')) parsedGrade = '9';
            else if (tableId.includes('grade8')) parsedGrade = '8';
            else if (tableId.includes('grade7')) parsedGrade = '7';
            else if (tableId.includes('new')) parsedGrade = 'new';

            $(table).find('tbody tr').each((_, row) => {
               const dateStr = $(row).find('.date').text().trim();
               const priceStr = $(row).find('.price').text().trim();

               if (!dateStr || !priceStr) return;

               const date = new Date(dateStr);
               if (isNaN(date.getTime())) return;

               const match = priceStr.match(/([0-9.,]+)/);
               if (!match) return;
               const price = parseFloat(match[1].replace(/,/g, ''));
               if (isNaN(price) || price <= 0) return;

               insertRows.push({
                 card_id: cardId,
                 source: 'pricecharting',
                 grade: parsedGrade,
                 grading_company_id: parsedGrade !== 'raw' && parsedGrade !== 'new' ? '74c51627-cc4b-4a82-a1c0-52b3975b47b7' : null,
                 price: price,
                 currency: 'USD',
                 recorded_at: date.toISOString(),
               });
            });
         });

         if (insertRows.length > 0) {
            const oldest = insertRows.reduce((min, r) => r.recorded_at < min ? r.recorded_at : min, insertRows[0].recorded_at);
            const newest = insertRows.reduce((max, r) => r.recorded_at > max ? r.recorded_at : max, insertRows[0].recorded_at);

            const existingRows = await dbQuery<HistoricalPriceExistingRow>(`
              SELECT recorded_at, grade
              FROM price_history
              WHERE card_id = $1
                AND source = $2
                AND recorded_at >= $3
                AND recorded_at <= $4
            `, [cardId, 'pricecharting', oldest, newest]);

            const existingKeys = new Set(existingRows.map((r) => {
               const d = r.recorded_at instanceof Date ? r.recorded_at.toISOString() : new Date(r.recorded_at).toISOString();
               return `${r.grade}-${d}`;
            }));
            const newRows = insertRows.filter(r => !existingKeys.has(`${r.grade}-${r.recorded_at}`));

            if (newRows.length > 0) {
               try {
                 await dbQuery(`
                   INSERT INTO price_history (
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
                   [JSON.stringify(newRows)]
                 );
                 console.log(`  ✓ Saved ${newRows.length} historical PriceCharting trades.`);

                 // Update card_price_current.graded_prices based on the latest price_history
                 const latestPrices = await dbQuery<HistoricalPriceRow>(`
                   SELECT source, grade, price::double precision AS price, recorded_at
                   FROM price_history
                   WHERE card_id = $1
                   ORDER BY recorded_at DESC
                 `, [cardId]);

                 if (latestPrices && latestPrices.length > 0) {
                   const latestPerSourceGrade = new Map<string, HistoricalPriceRow>();
                   for (const row of latestPrices) {
                     const key = `${row.source}\u0000${row.grade}`;
                     if (!latestPerSourceGrade.has(key)) {
                       latestPerSourceGrade.set(key, row);
                     }
                   }

                   const grouped = new Map<string, HistoricalPriceRow[]>();
                   for (const row of latestPerSourceGrade.values()) {
                     if (row.grade === 'raw' || row.grade === 'new') continue;

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
                     freshGradedPrices[grade] = { average: sum / rows.length, sources };
                   }

                   const currentRows = await dbQuery<CurrentPriceRow>(`
                     SELECT graded_prices, source_prices, headline_cents, headline_source, headline_kind, headline_currency, headline_grade, computed_at
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
                     mergedGraded[grade] = { average: values.reduce((sum, val) => sum + val, 0) / values.length, sources };
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

                   await dbQuery(`
                     INSERT INTO card_price_current (
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
                       computed_at = EXCLUDED.computed_at
                   `, [
                     currentRow.card_id,
                     JSON.stringify(currentRow.source_prices),
                     JSON.stringify(currentRow.graded_prices),
                     currentRow.headline_cents,
                     currentRow.headline_source,
                     currentRow.headline_kind,
                     currentRow.headline_currency,
                     currentRow.headline_grade,
                     currentRow.computed_at,
                   ]);
                 }
               } catch (insertError: any) {
                  console.error('  ✗ Error inserting rows:', insertError.message);
               }
            } else {
               console.log(`  ✓ Saved 0 historical PriceCharting trades (caught up to history).`);
            }
         }
      }
      
      await dbQuery(
        `UPDATE cards SET pc_fetched = TRUE, last_price_fetch = $1, curation_status = $2 WHERE id = $3`,
        [new Date().toISOString(), 'pending', cardId]
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ Error: ${message}`);
    } finally {
      if (page) await page.close().catch(() => {});
    }

    console.log(`Sleeping for ${SLEEP_MS / 1000}s to avoid bot detection... Zzz...\n`);
    await new Promise(r => setTimeout(r, SLEEP_MS));
  }
}

run();
