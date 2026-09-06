import * as cheerio from 'cheerio';
import { connect } from 'puppeteer-real-browser';
import { dbQuery } from '../lib/db/client';
import 'dotenv/config';

const TARGET_SLUGS = [
  'op-op09-004_p2-ja', // Shanks Manga (The New Emperor)
  'op-op09-051_p2-ja', // Buggy Manga (The New Emperor)
  'op-op09-093_p2-ja', // Marshall D Teach Manga (The New Emperor)
  'op-op09-118_p2-ja', // Gol D Roger Manga (The New Emperor)
  'op-op09-119_p2-ja', // Monkey D Luffy Manga (The New Emperor)
  'op-op10-119_p2-ja', // Trafalgar Law Manga (Royal Bloodline)
  'op-op11-118_p2-ja', // Monkey D Luffy Manga (A Fist of Divine Speed / Royal Bloodline)
  'op-op13-118_p2-ja', // Monkey D Luffy Manga (Carrying On His Will)
  'op-op13-120_p2-ja', // Sabo Manga (Carrying On His Will)
  'op-op16-065_p2-ja', // Sakazuki Manga (The Time of Battle)
  'op-op03-122_r1-ja', // Sogeking PRB01 Manga
  'op-op04-083_r1-ja', // Sabo PRB01 Manga
  'op-op05-074_r2-ja', // Eustass Captain Kid PRB01 Manga
  'op-op05-069_r1-ja', // Trafalgar Law PRB01 Manga
  'op-eb01-006_r1-ja', // Tony Tony Chopper PRB01 Manga
];

const GRADE_CONFIG: Record<string, { grade: string; companyId: string | null }> = {
  'completed-auctions-used': { grade: 'raw', companyId: null },
  'completed-auctions-manual-only': { grade: '10', companyId: '74c51627-cc4b-4a82-a1c0-52b3975b47b7' }, // PSA 10
  'completed-auctions-graded': { grade: '9', companyId: '74c51627-cc4b-4a82-a1c0-52b3975b47b7' },      // PSA 9
  'completed-auctions-new': { grade: '8', companyId: '74c51627-cc4b-4a82-a1c0-52b3975b47b7' },         // PSA 8
  'completed-auctions-cib': { grade: '7', companyId: '74c51627-cc4b-4a82-a1c0-52b3975b47b7' },         // PSA 7
  'completed-auctions-box-only': { grade: '9.5', companyId: 'cda2045f-5d78-49e7-b1c8-de04dac9888d' },   // BGS 9.5
  'completed-auctions-loose-and-box': { grade: '10', companyId: 'cda2045f-5d78-49e7-b1c8-de04dac9888d' }, // BGS 10
  'completed-auctions-grade-twenty': { grade: '10', companyId: 'cda2045f-5d78-49e7-b1c8-de04dac9888d' },  // BGS 10 Black
  'completed-auctions-grade-nineteen': { grade: '10', companyId: 'dce6169f-8958-4229-861b-686a4644c984' }, // CGC 10
};

async function scrapePage(page: any, card: { id: string; slug: string; name: string; number: string; pricecharting_url: string | null }) {
  const url = card.pricecharting_url;
  if (!url) {
    console.log(`❌ No locked PriceCharting URL found for ${card.slug}`);
    return;
  }

  console.log(`\n======================================================`);
  console.log(`Target: ${card.slug} (${card.name} - ${card.number})`);
  console.log(`Navigating to: ${url}`);
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (err: any) {
    console.error(`Error loading page for ${card.slug}:`, err.message);
    return;
  }

  // Wait 4s for Cloudflare auto-clearance and DOM rendering
  await new Promise(r => setTimeout(r, 4000));

  const title = await page.title();
  if (title.includes('Just a moment')) {
    console.log(`🚨 Cloudflare challenge hit on ${card.slug}. Waiting 5s...`);
    await new Promise(r => setTimeout(r, 5000));
  }

  const html = await page.content();
  const $ = cheerio.load(html);

  const insertRows: any[] = [];

  for (const [containerClass, conf] of Object.entries(GRADE_CONFIG)) {
    const rows = $(`.tab-frame .${containerClass} table tbody tr`);
    rows.each((_, r) => {
      const dateStr = $(r).find('td.date').text().trim();
      const priceText = $(r).find('span.js-price').text().trim();
      if (!dateStr || !priceText) return;

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return;

      const match = priceText.match(/([0-9.,]+)/);
      if (!match) return;

      const price = parseFloat(match[1].replace(/,/g, ''));
      if (isNaN(price) || price <= 0) return;

      insertRows.push({
        card_id: card.id,
        source: 'pricecharting',
        grade: conf.grade,
        grading_company_id: conf.companyId,
        price: price,
        price_native: price,
        currency: 'USD',
        recorded_at: date.toISOString(),
        price_kind: 'sold_guide'
      });
    });
  }

  console.log(`Parsed ${insertRows.length} completed sales from PriceCharting page.`);

  if (insertRows.length > 0) {
    // Preserve any existing suspicious price history < 50 into quarantine before saving genuine sales
    await dbQuery(`
      INSERT INTO price_quarantine (card_id, source, grade, price, price_native, currency, price_kind, reason, evidence)
      SELECT card_id, source::price_source, grade, price, price_native, currency, COALESCE(price_kind::price_kind, 'sold_guide'::price_kind),
             'manual-mapping-correction', '{"note": "Historical Manga re-scrape"}'::jsonb
      FROM price_history
      WHERE card_id = $1 AND source = 'pricecharting' AND price < 50
    `, [card.id]);

    await dbQuery(`DELETE FROM price_history WHERE card_id = $1 AND source = 'pricecharting' AND price < 50`, [card.id]);

    let inserted = 0;
    for (const row of insertRows) {
      await dbQuery(
        `INSERT INTO price_history (card_id, source, grade, grading_company_id, price, price_native, currency, recorded_at, price_kind)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [row.card_id, row.source, row.grade, row.grading_company_id, row.price, row.price_native, row.currency, row.recorded_at, row.price_kind]
      );
      inserted++;
    }

    await dbQuery(`UPDATE cards SET pc_fetched = TRUE WHERE id = $1`, [card.id]);
    console.log(`✅ Successfully saved ${inserted} PriceCharting sales for ${card.slug}!`);
  } else {
    console.log(`⚠️ 0 sales rows found on page for ${card.slug}.`);
  }
}

async function main() {
  console.log(`Loading targeted 15 Manga cards from DB...`);
  const cards = await dbQuery<{ id: string; slug: string; name: string; number: string; pricecharting_url: string | null }>(
    `SELECT id, slug, name, number, pricecharting_url FROM cards WHERE slug = ANY($1::text[])`,
    [TARGET_SLUGS]
  );

  console.log(`Found ${cards.length} cards matching target list.`);

  let browserInstance: any;
  try {
    console.log(`Launching real browser with Turnstile bypass...`);
    const { browser, page } = await connect({
      headless: 'auto',
      turnstile: true,
      customConfig: {},
      disableXvfb: false,
    });
    browserInstance = browser;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      console.log(`\n[${i + 1}/${cards.length}] Processing ${card.slug}...`);
      await scrapePage(page, card);
      await new Promise(r => setTimeout(r, 2500));
    }

    console.log('\n======================================================');
    console.log('Finished scraping all 15 remaining Manga cards!');
  } catch (error) {
    console.error('Fatal error during scraping execution:', error);
  } finally {
    if (browserInstance) {
      console.log('Closing browser instance...');
      await browserInstance.close();
    }
    process.exit(0);
  }
}

main();
