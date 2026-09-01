import { dbQuery } from '../lib/db/client';
import { getSharedBrowser } from '../lib/price-engine/browser';
import * as cheerio from 'cheerio';
import { waitForSourceRateLimit } from '../lib/price-engine/rate-limiter';

function parsePrice(text: string): number | undefined {
  if (!text) return undefined;
  const match = text.match(/([0-9.,]+)/);
  if (match) {
    const p = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(p) && p > 0) return p;
  }
  return undefined;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error('Usage: bun run scripts/backfill-pricecharting.ts <card_slug>');
    process.exit(1);
  }
  const slug = args[0];

  const cards = await dbQuery<any>('SELECT id, pricecharting_url FROM cards WHERE slug = $1', [slug]);
  if (cards.length === 0) {
    console.error(`Card not found: ${slug}`);
    process.exit(1);
  }
  
  const card = cards[0];
  if (!card.pricecharting_url) {
    console.error(`Card ${slug} has no pricecharting_url mapping!`);
    process.exit(1);
  }

  console.log(`[Backfill-PriceCharting] Fetching history for ${slug}...`);
  console.log(`[Backfill-PriceCharting] URL: ${card.pricecharting_url}`);

  await waitForSourceRateLimit('pricecharting');
  const browser = await getSharedBrowser();
  let page;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Some Cloudflare evasion headers/settings can be handled by getSharedBrowser plugins if any exist.
    await page.goto(card.pricecharting_url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    const html = await page.content();
    const $ = cheerio.load(html);

    const rows = $('table.completed-auctions tbody tr');
    if (rows.length === 0) {
      console.warn(`[Backfill-PriceCharting] No completed sales found! (Or Cloudflare blocked the request)`);
      // check if it's cloudflare
      if ($('title').text().includes('Just a moment')) {
        console.error(`[Backfill-PriceCharting] ERROR: Blocked by Cloudflare.`);
      }
      process.exit(1);
    }

    console.log(`[Backfill-PriceCharting] Found ${rows.length} historical sales! Parsing...`);

    const newHistory = [];
    rows.each((_, el) => {
      const dateText = $(el).find('td.date').text().trim();
      const priceText = $(el).find('td.price').text().trim();
      
      const price = parsePrice(priceText);
      
      if (price !== undefined && dateText) {
        // PriceCharting dates are usually "Aug 4, 2026" or similar
        const dateObj = new Date(dateText);
        if (!isNaN(dateObj.getTime())) {
          newHistory.push({
            price,
            date: dateObj.toISOString()
          });
        }
      }
    });

    console.log(`[Backfill-PriceCharting] Successfully parsed ${newHistory.length} valid sales.`);

    if (newHistory.length > 0) {
      let inserted = 0;
      for (const sale of newHistory) {
        try {
          await dbQuery(`
            INSERT INTO price_history (
              card_id, source, grade, price, currency, price_kind, recorded_at
            ) VALUES (
              $1, 'pricecharting', 'raw', $2, 'USD', 'sold_guide', $3
            )
            ON CONFLICT DO NOTHING
          `, [card.id, sale.price, sale.date]);
          inserted++;
        } catch (e) {
          // ignore conflict errors
        }
      }
      console.log(`[Backfill-PriceCharting] Successfully inserted ${inserted} historical rows into price_history!`);
    }

  } catch (err) {
    console.error(`[Backfill-PriceCharting] Error:`, err);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    process.exit(0);
  }
}

main().catch(console.error);
