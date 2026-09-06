import 'dotenv/config';
import { Pool } from 'pg';
import { getSharedBrowser } from '../../lib/price-engine/browser';
import * as cheerio from 'cheerio';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDiscovery() {
  console.log('Fetching top expensive Japanese OP cards that lack verified URLs...');

  const { rows: cards } = await pool.query(`
    SELECT id, slug, name, number, snkrdunk_url, pricecharting_url, yuyutei_url, price_cache_ttl
    FROM cards
    WHERE slug LIKE 'op-%-ja'
      AND (snkrdunk_url IS NULL OR pricecharting_url IS NULL OR yuyutei_url IS NULL)
    ORDER BY price_cache_ttl DESC NULLS LAST
    LIMIT 50;
  `);

  if (!cards || cards.length === 0) {
    console.log('No cards need URL discovery.');
    await pool.end();
    return;
  }

  const browser = await getSharedBrowser();
  let updatedCount = 0;

  for (const card of cards) {
    console.log(`\n==============================================`);
    console.log(`Processing: ${card.name} (${card.number}) [${card.slug}]`);

    const updates: Record<string, string> = {};
    const cardNumLower = (card.number || '').toLowerCase();

    // 1. SnkrDunk discovery
    if (!card.snkrdunk_url && card.number) {
      console.log(`  [Snkrdunk] Searching for ${card.number}...`);
      try {
        const page = await browser.newPage();
        await page.goto(`https://snkrdunk.com/en/search/result?keyword=${encodeURIComponent(card.number)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await delay(2000);
        const html = await page.content();
        const $ = cheerio.load(html);

        const firstLink = $('a[href*="/en/trading-cards/"]').first();
        if (firstLink.length > 0) {
          const href = firstLink.attr('href');
          const title = firstLink.text().toLowerCase();

          if (href && title.includes(cardNumLower)) {
            const fullUrl = href.startsWith('http') ? href : `https://snkrdunk.com${href}`;
            console.log(`  ✅ [Snkrdunk] Found VERIFIED match: ${fullUrl}`);
            updates.snkrdunk_url = fullUrl.split('?')[0];
          } else {
            console.log(`  ⚠️ [Snkrdunk] Found a link but title didnt match card number.`);
          }
        } else {
          console.log(`  ❌ [Snkrdunk] No results found.`);
        }
        await page.close();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.log(`  ❌ [Snkrdunk] Error: ${message}`);
      }
    }

    // 2. PriceCharting intelligent search-based discovery (never naive suffix guessing)
    if (!card.pricecharting_url && card.number) {
      console.log(`  [PriceCharting] Searching by card number (${card.number})...`);
      try {
        const page = await browser.newPage();
        const cleanNum = card.number.split('_')[0].split('-')[0]; // base number token e.g. OP01-120
        const query = `${cleanNum} japanese`;
        const searchUrl = `https://www.pricecharting.com/search-products?type=prices&q=${encodeURIComponent(query)}`;
        
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await delay(2500);

        const html = await page.content();
        const $ = cheerio.load(html);
        const rows = $('table#games_table tbody tr');

        const isManga = card.name.toLowerCase().includes('manga');
        const isParallel = card.slug.includes('_p') && !card.slug.endsWith('_p1-ja') && !isManga;
        const isSpecial = card.slug.includes('_p3') || card.name.toLowerCase().includes('special');
        const isBase = !card.slug.includes('_p') && !card.slug.includes('_r');

        let matchedUrl: string | null = null;

        rows.each((_, r) => {
          if (matchedUrl) return;
          const title = $(r).find('td.title a').text().trim().toLowerCase();
          const href = $(r).find('td.title a').attr('href');
          const setCol = $(r).find('td.console, td.platform, td.system, td.set').text().toLowerCase();

          // Must be Japanese set
          if (!setCol.includes('japanese')) return;

          if (isManga) {
            if (title.includes('manga')) {
              matchedUrl = href ? new URL(href, 'https://www.pricecharting.com').toString() : null;
            }
          } else if (isSpecial) {
            if (title.includes('special') || title.includes('[sp]')) {
              matchedUrl = href ? new URL(href, 'https://www.pricecharting.com').toString() : null;
            }
          } else if (isParallel) {
            if (title.includes('alternate art') || title.includes('parallel')) {
              matchedUrl = href ? new URL(href, 'https://www.pricecharting.com').toString() : null;
            }
          } else if (isBase) {
            if (!title.includes('[') && !title.includes('alternate art') && !title.includes('manga') && !title.includes('promo')) {
              matchedUrl = href ? new URL(href, 'https://www.pricecharting.com').toString() : null;
            }
          }
        });

        if (matchedUrl) {
          console.log(`  ✅ [PriceCharting] Found match: ${matchedUrl}`);
          updates.pricecharting_url = matchedUrl;
        } else {
          console.log(`  ⚠️ [PriceCharting] No qualifying row matched variant requirements.`);
        }
        await page.close();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        console.log(`  ❌ [PriceCharting] Error: ${message}`);
      }
    }

    if (Object.keys(updates).length > 0) {
      const setClauses = Object.keys(updates).map((col, idx) => `${col} = $${idx + 2}`).join(', ');
      const values = [card.id, ...Object.values(updates)];
      await pool.query(`UPDATE cards SET ${setClauses}, curation_status = 'pending' WHERE id = $1`, values);
      updatedCount++;
      console.log(`  💾 Saved ${Object.keys(updates).length} new verified URL(s) to Postgres.`);
    }
  }

  await browser.close();
  await pool.end();
  console.log(`\nDone. Updated URLs for ${updatedCount} cards.`);
  process.exit(0);
}

runDiscovery().catch(e => { console.error(e); process.exit(1); });
