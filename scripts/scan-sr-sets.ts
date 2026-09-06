import { connect } from 'puppeteer-real-browser';
import * as cheerio from 'cheerio';
import { dbQuery } from '../lib/db/client';
import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

const SET_URLS = [
  { set: 'OP-01', url: 'https://www.pricecharting.com/console/one-piece-japanese-romance-dawn' },
  { set: 'OP-02', url: 'https://www.pricecharting.com/console/one-piece-japanese-paramount-war' },
  { set: 'OP-03', url: 'https://www.pricecharting.com/console/one-piece-japanese-pillars-of-strength' },
  { set: 'OP-04', url: 'https://www.pricecharting.com/console/one-piece-kingdoms-of-intrigue' },
  { set: 'OP-05', url: 'https://www.pricecharting.com/console/one-piece-japanese-awakening-of-the-new-era' },
  { set: 'OP-06', url: 'https://www.pricecharting.com/console/one-piece-japanese-wings-of-the-captain' },
  { set: 'OP-07', url: 'https://www.pricecharting.com/console/one-piece-japanese-500-years-in-the-future' },
  { set: 'OP-08', url: 'https://www.pricecharting.com/console/one-piece-japanese-two-legends' },
  { set: 'OP-09', url: 'https://www.pricecharting.com/console/one-piece-japanese-emperors-in-the-new-world' },
  { set: 'OP-10', url: 'https://www.pricecharting.com/console/one-piece-japanese-royal-blood' },
  { set: 'OP-11', url: 'https://www.pricecharting.com/console/one-piece-japanese-fist-of-divine-speed' },
  { set: 'OP-12', url: 'https://www.pricecharting.com/console/one-piece-japanese-carrying-on-his-will' },
  { set: 'OP-13', url: 'https://www.pricecharting.com/console/one-piece-japanese-carrying-on-his-will' },
  { set: 'OP-14', url: 'https://www.pricecharting.com/console/one-piece-japanese-the-time-of-battle' },
  { set: 'OP-16', url: 'https://www.pricecharting.com/console/one-piece-japanese-the-time-of-battle' }
];

function extractCardCode(title: string): string | null {
  const match = title.match(/(OP\d{2}-\d{3}|EB\d{2}-\d{3}|ST\d{2}-\d{3})/i);
  return match ? match[1].toUpperCase() : null;
}

async function runSrScan() {
  console.log('🚀 Starting Super Rare Alternate Art PriceCharting Set Scanner...');

  // Query all SR Alternate Art cards from our DB
  const dbSrs = await dbQuery<any>(`
    SELECT c.id, c.slug, c.name, c.number, c.pricecharting_url, s.name as set_name
    FROM cards c
    JOIN sets s ON c.set_id = s.id
    WHERE c.slug LIKE 'op-%-ja'
      AND s.name LIKE 'OP-%'
      AND (c.rarity ILIKE '%Super%' OR c.rarity ILIKE '%SR%')
      AND c.name ILIKE '%(Alternate Art)%'
      AND c.name NOT ILIKE '%(Manga Alternate Art)%'
      AND c.rarity NOT ILIKE '%Special%'
      AND c.rarity NOT ILIKE '%Leader%'
    ORDER BY s.name, c.number;
  `);

  console.log(`📋 Found ${dbSrs.length} SR Alternate Art Japanese cards in database.`);

  const { browser, page } = await connect({ headless: 'auto', turnstile: true });
  const discoveredMappings: Array<{ cardId: string; slug: string; name: string; url: string; pcTitle: string }> = [];

  try {
    for (const setInfo of SET_URLS) {
      console.log(`\nScanning ${setInfo.set} Set Page: ${setInfo.url}`);
      await page.goto(setInfo.url, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await new Promise(r => setTimeout(r, 3500));

      const html = await page.content();
      const $ = cheerio.load(html);

      $('table#games_table tbody tr').each((_, el) => {
        const title = $(el).find('td.title a').text().trim();
        const href = $(el).find('td.title a').attr('href');
        if (!href) return;

        const fullUrl = 'https://www.pricecharting.com' + href;
        const lowerTitle = title.toLowerCase();

        // Must indicate Alternate Art, but NOT Manga, NOT Serial, NOT PRB01 reprint, NOT SP
        const isAltArt = lowerTitle.includes('alternate art') || lowerTitle.includes('alt art');
        const isManga = lowerTitle.includes('manga');
        const isSerial = lowerTitle.includes('serial');
        const isPrb = lowerTitle.includes('prb01') || lowerTitle.includes('prb-01');
        const isSp = lowerTitle.includes('[sp') || lowerTitle.includes('special');

        if (!isAltArt || isManga || isSerial || isPrb || isSp) return;

        const code = extractCardCode(title);
        if (!code) return;

        // Match with DB SR card
        const matched = dbSrs.filter(c => {
          const cCode = c.number.split('_')[0].toUpperCase();
          const sameSet = c.set_name && c.set_name.startsWith(setInfo.set);
          return cCode === code && sameSet;
        });

        if (matched.length === 1) {
          discoveredMappings.push({
            cardId: matched[0].id,
            slug: matched[0].slug,
            name: matched[0].name,
            url: fullUrl,
            pcTitle: title
          });
          console.log(`  🎯 MATCH: ${matched[0].slug} (${matched[0].name}) -> "${title}"`);
        }
      });
    }

    console.log(`\n==============================================`);
    console.log(`🎉 Total Unique SR Alternate Arts Matched: ${discoveredMappings.length}`);

    // Update database for all discovered mappings
    let lockedCount = 0;
    for (const item of discoveredMappings) {
      await dbQuery(`
        UPDATE cards
        SET pricecharting_url = $1, pc_fetched = FALSE
        WHERE id = $2
      `, [item.url, item.cardId]);

      await dbQuery(`
        INSERT INTO card_source_mapping (
          card_id, source, external_url, external_title, confidence, matched_by, evidence, verified_at, updated_at
        ) VALUES (
          $1, 'pricecharting', $2, $3, 'confirmed', 'url',
          '{"origin": "sr-batch-scan"}'::jsonb, NOW(), NOW()
        )
        ON CONFLICT (card_id, source) DO UPDATE SET
          external_url = EXCLUDED.external_url,
          external_title = EXCLUDED.external_title,
          confidence = 'confirmed',
          matched_by = 'url',
          verified_at = NOW(),
          updated_at = NOW();
      `, [item.cardId, item.url, item.pcTitle]);

      lockedCount++;
    }

    console.log(`✅ Successfully locked and confirmed ${lockedCount} SR Alternate Art cards in database!`);
  } finally {
    await browser.close();
  }
}

runSrScan().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
