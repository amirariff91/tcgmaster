import * as cheerio from 'cheerio';
import { connect } from 'puppeteer-real-browser';
import { dbQuery } from '../lib/db/client';
import 'dotenv/config';

// 25 Priority High-Value Japanese SP / Special Cards with their canonical PriceCharting URLs
export const TARGET_SP_CARDS: Array<{
  slug: string;
  url: string;
}> = [
  // OP05 - Awakening of the New Era
  {
    slug: 'op-op05-119_p1-ja',
    url: 'https://www.pricecharting.com/game/one-piece-japanese-awakening-of-the-new-era/monkeydluffy-alternate-art-op05-119'
  },
  {
    slug: 'op-op05-119_p3-ja',
    url: 'https://www.pricecharting.com/game/one-piece-japanese-awakening-of-the-new-era/monkeydluffy-wanted-op05-119'
  },
  {
    slug: 'op-op05-119_p5-ja',
    url: 'https://www.pricecharting.com/game/one-piece-japanese-awakening-of-the-new-era/monkeydluffy-sp-gold-op05-119'
  },
  {
    slug: 'op-op05-119_p6-ja',
    url: 'https://www.pricecharting.com/game/one-piece-japanese-awakening-of-the-new-era/monkeydluffy-sp-silver-op05-119'
  },
  // OP01 - Romance Dawn
  {
    slug: 'op-op01-016_p4-ja',
    url: 'https://www.pricecharting.com/game/one-piece-japanese-romance-dawn/nami-special-op01-016'
  },
  {
    slug: 'op-op01-025_p4-ja',
    url: 'https://www.pricecharting.com/game/one-piece-japanese-romance-dawn/roronoa-zoro-special-op01-025'
  },
  {
    slug: 'op-op01-120_p4-ja',
    url: 'https://www.pricecharting.com/game/one-piece-japanese-romance-dawn/shanks-special-op01-120'
  },
  // OP02 - Paramount War
  {
    slug: 'op-op02-013_p3-ja',
    url: 'https://www.pricecharting.com/game/one-piece-japanese-paramount-war/portgasdace-special-op02-013'
  },
  // OP04 - Kingdoms of Intrigue
  {
    slug: 'op-op04-083_p3-ja',
    url: 'https://www.pricecharting.com/game/one-piece-japanese-kingdoms-of-intrigue/sabo-special-op04-083'
  },
  // OP06 - Wings of the Captain
  {
    slug: 'op-op06-118_p4-ja',
    url: 'https://www.pricecharting.com/game/one-piece-japanese-wings-of-the-captain/roronoa-zoro-special-op06-118'
  },
  // OP07 - 500 Years in the Future
  {
    slug: 'op-op07-051_p3-ja',
    url: 'https://www.pricecharting.com/game/one-piece-japanese-500-years-in-the-future/boa-hancock-special-op07-051'
  },
  // OP08 - Two Legends
  {
    slug: 'op-op08-106_p3-ja',
    url: 'https://www.pricecharting.com/game/one-piece-japanese-two-legends/nami-special-op08-106'
  },
  // OP09 - The New Emperor
  {
    slug: 'op-op09-093_p3-ja',
    url: 'https://www.pricecharting.com/game/one-piece-japanese-the-new-emperor/marshall-d-teach-special-op09-093'
  },
  {
    slug: 'op-op09-119_p3-ja',
    url: 'https://www.pricecharting.com/game/one-piece-japanese-the-new-emperor/monkey-d-luffy-special-op09-119'
  },
  // EB01 - Memorial Collection
  {
    slug: 'op-eb01-003_p3-ja',
    url: 'https://www.pricecharting.com/game/one-piece-japanese-memorial-collection/kid-&-killer-special-eb01-003'
  },
  {
    slug: 'op-eb01-006_p4-ja',
    url: 'https://www.pricecharting.com/game/one-piece-japanese-memorial-collection/tony-tony-chopper-special-eb01-006'
  },
  {
    slug: 'op-eb01-057_p2-ja',
    url: 'https://www.pricecharting.com/game/one-piece-japanese-memorial-collection/shirahoshi-special-eb01-057'
  }
];

const GRADE_CONFIG: Record<string, { grade: string; companyId: string | null }> = {
  'completed-auctions-used': { grade: 'raw', companyId: null },
  'completed-auctions-manual-only': { grade: '10', companyId: '74c51627-cc4b-4a82-a1c0-52b3975b47b7' },
  'completed-auctions-graded': { grade: '9', companyId: '74c51627-cc4b-4a82-a1c0-52b3975b47b7' },
  'completed-auctions-new': { grade: '8', companyId: '74c51627-cc4b-4a82-a1c0-52b3975b47b7' },
  'completed-auctions-cib': { grade: '7', companyId: '74c51627-cc4b-4a82-a1c0-52b3975b47b7' },
  'completed-auctions-box-only': { grade: '9.5', companyId: 'cda2045f-5d78-49e7-b1c8-de04dac9888d' },
  'completed-auctions-loose-and-box': { grade: '10', companyId: 'cda2045f-5d78-49e7-b1c8-de04dac9888d' },
  'completed-auctions-grade-twenty': { grade: '10', companyId: 'cda2045f-5d78-49e7-b1c8-de04dac9888d' },
  'completed-auctions-grade-nineteen': { grade: '10', companyId: 'dce6169f-8958-4229-861b-686a4644c984' },
};

async function scrapeSpCard(page: any, target: { slug: string; url: string }) {
  const cards = await dbQuery<any>('SELECT id, name, slug FROM cards WHERE slug = $1', [target.slug]);
  if (cards.length === 0) {
    console.log(`[SKIP] Card not found in database: ${target.slug}`);
    return;
  }
  const card = cards[0];

  console.log(`\n======================================================`);
  console.log(`[SP Scraper] Ingesting ${card.slug} (${card.name})...`);
  console.log(`  URL: ${target.url}`);

  await page.goto(target.url, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 4000));

  const pageTitle = await page.title();
  if (pageTitle.includes('Just a moment')) {
    console.log(`🚨 Cloudflare block encountered on ${target.slug}! Waiting 5s...`);
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

  // Preserve data policy: Quarantine previous bad rows before deleting
  await dbQuery(`
    INSERT INTO price_quarantine (card_id, source, grade, price, price_native, currency, price_kind, reason, evidence, observed_at)
    SELECT card_id, source, grade, price, price_native, currency, COALESCE(price_kind, 'market'::price_kind),
           'manual-mapping-correction', '{"note": "Historical SP card re-scrape"}'::jsonb, recorded_at
    FROM price_history
    WHERE card_id = $1 AND source = 'pricecharting' AND price < 20
  `, [card.id]);
  
  await dbQuery(`DELETE FROM price_history WHERE card_id = $1 AND source = 'pricecharting' AND price < 20`, [card.id]);

  if (insertRows.length > 0) {
    for (const row of insertRows) {
      await dbQuery(
        `INSERT INTO price_history (card_id, source, grade, grading_company_id, price, price_native, currency, recorded_at, price_kind)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [row.card_id, row.source, row.grade, row.grading_company_id, row.price, row.price_native, row.currency, row.recorded_at, row.price_kind]
      );
    }
  }

  // Lock URL on cards table
  await dbQuery(`UPDATE cards SET pricecharting_url = $1, pc_fetched = TRUE WHERE id = $2`, [target.url, card.id]);

  // Sync confirmed mapping into card_source_mapping
  await dbQuery(`
    INSERT INTO card_source_mapping (card_id, source, external_url, external_title, confidence, matched_by, evidence, verified_at, updated_at)
    VALUES ($1, 'pricecharting', $2, $3, 'confirmed', 'url', '{"origin": "sp-curation"}'::jsonb, NOW(), NOW())
    ON CONFLICT (card_id, source) DO UPDATE SET
      external_url = EXCLUDED.external_url,
      confidence = 'confirmed',
      matched_by = 'url',
      updated_at = NOW()
  `, [card.id, target.url, card.name]);

  console.log(`✅ Saved ${insertRows.length} historical trades and locked canonical URL for ${card.slug}!`);
}

async function main() {
  console.log(`Starting SP & Special Cards Scraping Batch (${TARGET_SP_CARDS.length} cards)...`);

  let browserInstance;
  try {
    const { browser, page } = await connect({
      headless: 'auto',
      turnstile: true,
      customConfig: {},
      disableXvfb: false,
    });
    browserInstance = browser;

    for (const target of TARGET_SP_CARDS) {
      await scrapeSpCard(page, target);
      await new Promise(r => setTimeout(r, 2500));
    }

    console.log('\n🌟 Finished scraping all target SP cards!');
  } catch (error) {
    console.error('Critical error in SP scraper:', error);
  } finally {
    if (browserInstance) await browserInstance.close();
    process.exit(0);
  }
}

main();
