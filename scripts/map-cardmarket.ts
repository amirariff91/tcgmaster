import { getSharedBrowser, closeSharedBrowser } from '../lib/price-engine/browser';
import { dbQuery } from '../lib/db/client';
import * as cheerio from 'cheerio';

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function mapCardToCardmarket(card: { id: string; number: string; slug: string }) {
  const browser = await getSharedBrowser();
  const page = await browser.newPage();
  
  try {
    const searchUrl = `https://www.cardmarket.com/en/OnePiece/Products/Search?searchString=${encodeURIComponent(card.number)}`;
    console.log(`[Auto-Mapper] Searching for ${card.number} (${card.slug})...`);
    
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    const response = await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    
    if (response?.status() === 403) {
      console.log(`[Auto-Mapper] HTTP 403: Cloudflare blocked the request. You MUST run this on a residential IP.`);
      return;
    }

    const html = await page.content();
    const $ = cheerio.load(html);
    
    // Look for the first link that goes to a single card page
    let foundUrl: string | null = null;
    
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('/Products/Singles/') && !foundUrl) {
        foundUrl = `https://www.cardmarket.com${href}`;
      }
    });

    if (foundUrl) {
      console.log(`[Auto-Mapper] Successfully found URL for ${card.number}: ${foundUrl}`);
      await dbQuery(
        `UPDATE cards SET cardmarket_url = $1, updated_at = NOW() WHERE id = $2`,
        [foundUrl, card.id]
      );
    } else {
      console.log(`[Auto-Mapper] Could not find a Singles URL in the search results for ${card.number}.`);
    }

  } catch (err) {
    console.error(`[Auto-Mapper] Error searching for ${card.number}:`, err);
  } finally {
    await page.close().catch(() => {});
  }
}

async function main() {
  console.log('[Auto-Mapper] Starting Cardmarket Auto-Mapper...');
  
  // Fetch all English One Piece cards that do NOT have a cardmarket_url yet
  const cards = await dbQuery<any>(
    `SELECT id, slug, number, name FROM cards WHERE slug LIKE '%-en' AND cardmarket_url IS NULL`
  );

  console.log(`[Auto-Mapper] Found ${cards.length} unmapped English cards to process.`);

  for (const card of cards) {
    if (!card.number) continue;
    await mapCardToCardmarket(card);
    
    // Mimic human behavior with a generous delay to avoid bans
    await delay(12000); 
  }

  console.log('[Auto-Mapper] Finished processing all unmapped cards.');
  await closeSharedBrowser();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
