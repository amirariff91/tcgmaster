import { connect } from 'puppeteer-real-browser';
import * as cheerio from 'cheerio';
import { dbQuery } from '../lib/db/client';
import dotenv from 'dotenv';
dotenv.config({ path: ['.env.local', '.env'] });

async function verifyAllMangaSnkrdunk() {
  const cards = await dbQuery<any>(`
    SELECT c.id, c.slug, c.name, c.number, c.snkrdunk_url
    FROM cards c
    WHERE c.slug LIKE '%-ja' AND (c.name ILIKE '%(Manga Alternate Art)%' OR c.slug IN (
      'op-op03-122_r1-ja', 'op-op04-083_r1-ja', 'op-op05-074_r2-ja', 'op-op05-069_r1-ja', 'op-eb01-006_r1-ja'
    ))
    ORDER BY c.number;
  `);

  console.log(`Auditing ${cards.length} Japanese Manga cards on SnkrDunk...`);

  const { browser, page } = await connect({ headless: 'auto', turnstile: true });
  const auditResults: Array<any> = [];

  try {
    for (const card of cards) {
      if (!card.snkrdunk_url) {
        console.log(`❌ [NO URL] ${card.slug} (${card.name})`);
        auditResults.push({ slug: card.slug, name: card.name, status: 'NO_URL', title: 'N/A' });
        continue;
      }

      try {
        await page.goto(card.snkrdunk_url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));
        const html = await page.content();
        const $ = cheerio.load(html);
        const title = $('h1').text().trim();

        console.log(`[${card.number}] ${card.name.slice(0, 20)} -> SnkrDunk: "${title}"`);
        auditResults.push({
          slug: card.slug,
          name: card.name,
          num: card.number,
          url: card.snkrdunk_url,
          title
        });
      } catch (err: any) {
        console.error(`Error checking ${card.slug}:`, err.message);
      }
    }

    console.table(auditResults.map(r => ({
      num: r.num,
      name: r.name ? r.name.slice(0, 18) : '',
      slug: r.slug,
      id: r.url ? r.url.split('/').pop().slice(0, 15) : 'NONE',
      snkr_title: r.title ? r.title.slice(0, 45) : 'ERROR'
    })));
  } finally {
    await browser.close();
  }
}

verifyAllMangaSnkrdunk().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
