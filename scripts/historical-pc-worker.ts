import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { getSharedBrowser } from '../lib/price-engine/browser';

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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

const SLEEP_MS = 60000;

async function run() {
  console.log(`Starting Continuous Historical PriceCharting Worker [SLEEP=${SLEEP_MS}ms]...`);

  while (true) {
    let cards = [];
    try {
       const { data, error } = await supabase
         .from('cards')
         .select('id, name, slug, number, pricecharting_url, last_price_fetch')
         .not('pricecharting_url', 'is', null)
         .order('last_price_fetch', { ascending: true, nullsFirst: true })
         .limit(1);

       if (!error && data) cards = data;
    } catch (e) {}

    let pcQueryOrUrl = null;
    let cardId = null;
    let card = null;

    if (cards.length > 0) {
       card = cards[0];
       pcQueryOrUrl = card.pricecharting_url;
       cardId = card.id;
    }

    if (!pcQueryOrUrl || !cardId || !card) {
      console.log('No cards found with PriceCharting URL. Sleeping...');
      await new Promise(r => setTimeout(r, SLEEP_MS));
      continue;
    }

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
         const insertRows = [];

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
                 recorded_at: date.toISOString(),
               });
            });
         });

         if (insertRows.length > 0) {
            const oldest = insertRows.reduce((min, r) => r.recorded_at < min ? r.recorded_at : min, insertRows[0].recorded_at);
            const newest = insertRows.reduce((max, r) => r.recorded_at > max ? r.recorded_at : max, insertRows[0].recorded_at);

            const { data: existingRows } = await supabase
              .from('price_history')
              .select('recorded_at, grade')
              .eq('card_id', cardId)
              .eq('source', 'pricecharting')
              .gte('recorded_at', oldest)
              .lte('recorded_at', newest);

            const existingKeys = new Set(existingRows?.map(r => `${r.grade}-${r.recorded_at}`) || []);
            const newRows = insertRows.filter(r => !existingKeys.has(`${r.grade}-${r.recorded_at}`));

            if (newRows.length > 0) {
               const { error: insertError } = await supabase.from('price_history').insert(newRows);
               if (insertError) {
                  console.error('  ✗ Error inserting rows:', insertError.message);
               } else {
                  console.log(`  ✓ Saved ${newRows.length} historical PriceCharting trades.`);

                  // Update card_price_current.graded_prices based on the latest price_history
               const { data: latestPrices, error: historyError } = await supabase
                 .from('price_history')
                 .select('source, grade, price')
                 .eq('card_id', cardId)
                 .order('recorded_at', { ascending: false });

               if (!historyError && latestPrices && latestPrices.length > 0) {
                 const latestPerSourceGrade = new Map<string, HistoricalPriceRow>();
                 for (const row of latestPrices) {
                   const key = `${row.source}\u0000${row.grade}`;
                   if (!latestPerSourceGrade.has(key)) {
                     latestPerSourceGrade.set(key, row);
                   }
                 }

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
                   freshGradedPrices[grade] = { average: sum / rows.length, sources };
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

                 await supabase.from('card_price_current').upsert(currentRow, { onConflict: 'card_id' });
               }
               }
            }
         }
      }
      await supabase.from('cards').update({ last_price_fetch: new Date().toISOString(), curation_status: 'pending' }).eq('id', cardId);
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
