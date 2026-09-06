import { connect } from 'puppeteer-real-browser';
import * as cheerio from 'cheerio';
import { dbQuery } from '../lib/db/client';
import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

// 1. All Japanese sets on PriceCharting that host SP / Special cards
const SET_URLS = [
  'https://www.pricecharting.com/console/one-piece-japanese-romance-dawn',
  'https://www.pricecharting.com/console/one-piece-japanese-paramount-war',
  'https://www.pricecharting.com/console/one-piece-japanese-pillars-of-strength',
  'https://www.pricecharting.com/console/one-piece-kingdoms-of-intrigue',
  'https://www.pricecharting.com/console/one-piece-japanese-awakening-of-the-new-era',
  'https://www.pricecharting.com/console/one-piece-japanese-wings-of-the-captain',
  'https://www.pricecharting.com/console/one-piece-japanese-500-years-in-the-future',
  'https://www.pricecharting.com/console/one-piece-japanese-two-legends',
  'https://www.pricecharting.com/console/one-piece-japanese-emperors-in-the-new-world',
  'https://www.pricecharting.com/console/one-piece-japanese-royal-blood',
  'https://www.pricecharting.com/console/one-piece-japanese-fist-of-divine-speed',
  'https://www.pricecharting.com/console/one-piece-japanese-carrying-on-his-will',
  'https://www.pricecharting.com/console/one-piece-japanese-the-time-of-battle'
];

interface ScrapedCard {
  title: string;
  url: string;
  priceRaw: number | null;
  code: string | null;
}

function extractCardCode(title: string): string | null {
  const match = title.match(/(OP\d{2}-\d{3}|EB\d{2}-\d{3}|ST\d{2}-\d{3})/i);
  return match ? match[1].toUpperCase() : null;
}

async function runBatchCollector() {
  console.log('🚀 Starting SP Cards PriceCharting Set Scanner...');

  // Fetch all Japanese SP cards from our DB
  const dbSpCards = await dbQuery<any>(`
    SELECT c.id, c.slug, c.name, c.number, c.pricecharting_url, s.name as set_name
    FROM cards c
    JOIN sets s ON c.set_id = s.id
    WHERE c.slug LIKE 'op-%-ja'
      AND (c.rarity ILIKE '%SP%' OR c.name ILIKE '%(Special Card)%' OR c.name ILIKE '%SP Card%')
      AND c.name NOT ILIKE '%(Manga Alternate Art)%'
    ORDER BY c.number;
  `);

  console.log(`📋 Found ${dbSpCards.length} SP / Special Japanese cards in database.`);

  const { browser, page } = await connect({ headless: 'auto', turnstile: true });
  const discoveredMappings: Array<{ cardId: string; slug: string; name: string; url: string; pcTitle: string }> = [];

  try {
    for (const setUrl of SET_URLS) {
      console.log(`\nScanning Set Page: ${setUrl}`);
      await page.goto(setUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await new Promise(r => setTimeout(r, 3500));

      const html = await page.content();
      const $ = cheerio.load(html);

      $('table#games_table tbody tr').each((_, el) => {
        const title = $(el).find('td.title a').text().trim();
        const href = $(el).find('td.title a').attr('href');
        if (!href) return;

        const fullUrl = 'https://www.pricecharting.com' + href;
        const lowerTitle = title.toLowerCase();

        // Check if this item is an SP / Special variant on PriceCharting
        const isSpOnPc = lowerTitle.includes('[sp') || 
                         lowerTitle.includes('special') || 
                         lowerTitle.includes('[gold') ||
                         lowerTitle.includes('sp-gold') ||
                         lowerTitle.includes('sp gold');

        if (!isSpOnPc) return;

        const code = extractCardCode(title);
        if (!code) return;

        // Find matching card in our DB
        // SP cards often have number like OP05-091_p2, where the base code is OP05-091
        const matched = dbSpCards.filter(c => {
          const cCode = c.number.split('_')[0].toUpperCase();
          return cCode === code;
        });

        let resolvedMatch = matched;
        if (matched.length > 1) {
          // 1. Prefer booster set releases (sets starting with 'OP-') over Promo / PRB reprints
          const boosterMatches = matched.filter(m => m.set_name && m.set_name.startsWith('OP-'));
          if (boosterMatches.length === 1) {
            resolvedMatch = boosterMatches;
          }
        }

        if (resolvedMatch.length === 1) {
          discoveredMappings.push({
            cardId: resolvedMatch[0].id,
            slug: resolvedMatch[0].slug,
            name: resolvedMatch[0].name,
            url: fullUrl,
            pcTitle: title
          });
          console.log(`  🎯 MATCH: ${resolvedMatch[0].slug} (${resolvedMatch[0].name}) -> "${title}"`);
        } else if (resolvedMatch.length > 1) {
          console.log(`  ⚠️ Multiple DB candidates for code ${code} ("${title}"): ${resolvedMatch.map(m => m.slug).join(', ')}`);
        }
      });
    }

    console.log(`\n==============================================`);
    console.log(`🎉 Total Unique SP Cards Matched: ${discoveredMappings.length}`);

    // Update database for all discovered mappings
    let lockedCount = 0;
    for (const item of discoveredMappings) {
      // 1. Update cards table
      await dbQuery(`
        UPDATE cards
        SET pricecharting_url = $1, pc_fetched = FALSE
        WHERE id = $2
      `, [item.url, item.cardId]);

      // 2. Lock in card_source_mapping as confirmed
      await dbQuery(`
        INSERT INTO card_source_mapping (
          card_id, source, external_url, external_title, confidence, matched_by, evidence, verified_at, updated_at
        ) VALUES (
          $1, 'pricecharting', $2, $3, 'confirmed', 'url',
          '{"origin": "sp-batch-scan"}'::jsonb, NOW(), NOW()
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

    console.log(`✅ Successfully locked and confirmed ${lockedCount} SP cards in database!`);
  } finally {
    await browser.close();
  }
}

runBatchCollector().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
