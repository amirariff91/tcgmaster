import * as cheerio from 'cheerio';
import { connect } from 'puppeteer-real-browser';
import { dbQuery } from '../lib/db/client';
import * as readline from 'readline';

import 'dotenv/config';

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

const PC_SET_NAMES: Record<string, string> = {
  'op01': 'romance-dawn',
  'op02': 'paramount-war',
  'op03': 'pillars-of-strength',
  'op04': 'kingdoms-of-intrigue',
  'op05': 'awakening-of-the-new-era',
  'op06': 'wings-of-the-captain',
  'op07': '500-years-in-the-future',
  'op08': 'two-legends',
  'op09': 'the-new-emperor',
  'op10': 'royal-bloodline',
  'eb01': 'memorial-collection',
  'eb02': 'extra-booster-2',
  'eb03': 'extra-booster-3',
  'eb04': 'extra-booster-4',
  'prb01': 'premium-booster'
};

const NAME_MAP: Record<string, string> = {
  'Monkey.D.Luffy': 'monkeydluffy',
  'Roronoa Zoro': 'roronoa-zoro',
  'Sanji': 'sanji',
  'Nami': 'nami',
  'Usopp': 'usopp',
  'Tony Tony.Chopper': 'tony-tony-chopper',
  'Tony Tony Chopper': 'tony-tony-chopper',
  'Nico Robin': 'nico-robin',
  'Franky': 'franky',
  'Brook': 'brook',
  'Jinbe': 'jinbe',
  'Shanks': 'shanks',
  'Portgas.D.Ace': 'portgas-d-ace',
  'Trafalgar Law': 'trafalgar-law',
  'Eustass Kid': 'eustass-kid',
  'Eustass"Captain"Kid': 'eustass-kid',
  'Sogeking': 'sogeking',
  'Sabo': 'sabo',
  'Kouzuki Oden': 'kouzuki-oden',
  'Boa Hancock': 'boa-hancock',
  'Dracule Mihawk': 'dracule-mihawk',
  'Buggy': 'buggy',
  'Vivi': 'vivi',
  'Nefeltari Vivi': 'nefeltari-vivi',
  'Uta': 'uta',
  'Koby': 'koby',
  'Gol.D.Roger': 'gol-d-roger',
  'Marshall.D.Teach': 'marshall-d-teach'
};

function formatName(name: string): string {
  if (NAME_MAP[name]) return NAME_MAP[name];
  return name.toLowerCase().replace(/[.\s]+/g, '-').replace(/[^a-z0-9-]/g, '');
}

async function scrapePage(page: any, card: any) {
  let url = card.pricecharting_url;
  
  if (!url) {
    const isReprint = card.slug.includes('_r');
    const parts = card.number.toLowerCase().split('-'); 
    const setPrefix = isReprint ? 'prb01' : parts[0]; 
    const setName = PC_SET_NAMES[setPrefix];
    
    if (!setName) {
      console.log(`[SKIP] Unknown set for ${card.slug}`);
      return;
    }
    
    const charSlug = formatName(card.name || '');
    const cardNumber = card.number.toLowerCase();
    
    // The most accurate URL prediction format
    url = `https://www.pricecharting.com/game/one-piece-japanese-${setName}/${charSlug}-alternate-art-manga-${cardNumber}`;
  }
  
  console.log(`\nNavigating to ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  
  // Wait a few seconds for Cloudflare auto-clearance and tables to render
  await new Promise(r => setTimeout(r, 4000));
  
  const title = await page.title();
  if (title.includes('Just a moment')) {
    console.log(`🚨 CLOUDFLARE BLOCK HIT! Even with real browser! Skipping ${card.slug}`);
    return;
  }
  
  const html = await page.content();
  const $ = cheerio.load(html);
  
  // PriceCharting changed their CSS class from .hoverable-striped to .hoverable-rows
  // We use table#games_table to be robust.
  const tables = $('table#games_table');
  
  if (tables.length === 0) {
    console.log(`❌ Page loaded but no tables found (URL might be wrong or redirected): ${title}`);
    return;
  }
  
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
        card_id: card.id,
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
    await dbQuery(`
      INSERT INTO price_quarantine (card_id, source, grade, price, currency, observed_at, reason, evidence, price_kind)
      SELECT card_id, source, grade, price, currency, recorded_at, 'manual-mapping-correction', '{}'::jsonb, 'retail_sell'
      FROM price_history
      WHERE card_id = $1 AND source = 'pricecharting'
    `, [card.id]);
    
    await dbQuery(`DELETE FROM price_history WHERE card_id = $1 AND source = 'pricecharting'`, [card.id]);
    
    await dbQuery(`
      INSERT INTO price_history (card_id, source, grade, grading_company_id, price, currency, recorded_at)
      SELECT card_id, source::price_source, grade, grading_company_id, price, currency, recorded_at
      FROM jsonb_to_recordset($1::jsonb) AS rows(
        card_id uuid, source text, grade text, grading_company_id uuid,
        price numeric, currency text, recorded_at timestamptz
      )`,
      [JSON.stringify(insertRows)]
    );
    
    await dbQuery(`UPDATE cards SET pricecharting_url = $1, pc_fetched = TRUE WHERE id = $2`, [url, card.id]);
    console.log(`✅ Saved ${insertRows.length} historical prices and locked URL for ${card.slug}!`);
  } else {
    console.log(`⚠️ Table found, but 0 valid rows parsed for ${card.slug}.`);
  }
}

async function main() {
  const cards = await dbQuery("SELECT id, slug, name, number, pricecharting_url FROM cards WHERE slug = ANY($1::text[])", [MANGA_SLUGS]);
  console.log(`Found ${cards.length} Manga cards to scrape.`);
  
  let browserInstance;
  try {
    const { browser, page } = await connect({
      headless: 'auto',
      turnstile: true,
      customConfig: {},
      disableXvfb: false,
    });
    browserInstance = browser;
    
    for (const card of cards) {
      const parts = card.number.toLowerCase().split('-');
      const setPrefix = parts[0];
      if (['op10', 'op11', 'op12', 'op13', 'op14', 'op15', 'op16'].includes(setPrefix)) {
        console.log(`Skipping unreleased/invalid set: ${card.slug}`);
        continue;
      }
      
      await scrapePage(page, card);
      await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log('\nFinished scraping all Mangas!');
  } catch (error) {
    console.error("Critical error:", error);
  } finally {
    if (browserInstance) await browserInstance.close();
    process.exit(0);
  }
}

main();
