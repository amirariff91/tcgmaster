import * as cheerio from 'cheerio';
import { connect } from 'puppeteer-real-browser';
import { dbQuery } from '../lib/db/client';
import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

const GRADE_CONFIG: Record<string, { grade: string; companyId: string | null }> = {
  'completed-auctions-used': { grade: 'raw', companyId: null },
  'completed-auctions-manual-only': { grade: '10', companyId: '74c51627-cc4b-4a82-a1c0-52b3975b47b7' }, // PSA 10
  'completed-auctions-graded': { grade: '9', companyId: '74c51627-cc4b-4a82-a1c0-52b3975b47b7' },      // PSA 9
  'completed-auctions-new': { grade: '8', companyId: '74c51627-cc4b-4a82-a1c0-52b3975b47b7' },         // PSA 8
};

async function scrapePage(page: any, card: { id: string; slug: string; name: string; number: string; pricecharting_url: string }) {
  const url = card.pricecharting_url;
  console.log(`\nFetching: ${card.slug} (${card.name}) -> ${url}`);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (err: any) {
    console.error(`  Error loading ${card.slug}:`, err.message);
    return;
  }

  await new Promise(r => setTimeout(r, 2500));

  const html = await page.content();
  const $ = cheerio.load(html);

  // Extract Headline Prices from product page summary
  const rawPriceText = $('#used_price .price').first().text().replace(/[^0-9.]/g, '');
  const psa10PriceText = $('#manual_only_price .price').first().text().replace(/[^0-9.]/g, '');
  const rawPrice = parseFloat(rawPriceText) || null;
  const psa10Price = parseFloat(psa10PriceText) || null;

  let insertedSales = 0;

  for (const [tableId, meta] of Object.entries(GRADE_CONFIG)) {
    $(`#${tableId} tbody tr`).each((_, row) => {
      const dateText = $(row).find('td.date').text().trim();
      const priceText = $(row).find('td.price').text().trim().replace(/[^0-9.]/g, '');

      const price = parseFloat(priceText);
      if (!price || isNaN(price) || price <= 0) return;

      const date = dateText ? new Date(dateText) : new Date();
      if (isNaN(date.getTime())) return;

      dbQuery(`
        INSERT INTO price_history (
          card_id, source, price, currency, grade, grading_company_id, price_kind, recorded_at
        ) VALUES (
          $1, 'pricecharting', $2, 'USD', $3, $4, 'sold_guide', $5
        ) ON CONFLICT DO NOTHING
      `, [card.id, price, meta.grade, meta.companyId, date.toISOString()]).catch(() => {});

      insertedSales++;
    });
  }

  if (rawPrice && rawPrice > 0) {
    await dbQuery(`
      INSERT INTO price_history (
        card_id, source, price, currency, grade, price_kind, recorded_at
      ) VALUES (
        $1, 'pricecharting', $2, 'USD', 'raw', 'sold_guide', NOW()
      ) ON CONFLICT DO NOTHING
    `, [card.id, rawPrice]);
  }

  if (psa10Price && psa10Price > 0) {
    await dbQuery(`
      INSERT INTO price_history (
        card_id, source, price, currency, grade, grading_company_id, price_kind, recorded_at
      ) VALUES (
        $1, 'pricecharting', $2, 'USD', '10', '74c51627-cc4b-4a82-a1c0-52b3975b47b7', 'sold_guide', NOW()
      ) ON CONFLICT DO NOTHING
    `, [card.id, psa10Price]);
  }

  console.log(`  ✅ Ingested: Raw $${rawPrice ?? 'N/A'}, PSA 10 $${psa10Price ?? 'N/A'}, ${insertedSales} historic completed sales`);
}

async function run() {
  const cards = await dbQuery<any>(`
    SELECT c.id, c.slug, c.name, c.number, c.pricecharting_url
    FROM cards c
    JOIN card_source_mapping csm ON c.id = csm.card_id AND csm.source = 'pricecharting'
    WHERE csm.confidence = 'confirmed'
      AND c.slug LIKE 'op-%-ja'
      AND c.name ILIKE '%(Alternate Art)%'
      AND c.rarity ILIKE '%Leader%'
    ORDER BY c.number;
  `);

  console.log(`🎯 Found ${cards.length} confirmed Leader Alternate Art cards needing price ingestion.`);
  if (cards.length === 0) return;

  const { browser, page } = await connect({ headless: 'auto', turnstile: true });

  try {
    for (const card of cards) {
      await scrapePage(page, card);
      await new Promise(r => setTimeout(r, 1500));
    }
  } finally {
    await browser.close();
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
