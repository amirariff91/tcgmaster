import { connect } from 'puppeteer-real-browser';
import * as cheerio from 'cheerio';
import { dbQuery } from '../lib/db/client';
import 'dotenv/config';

const TARGET_MANGA_CARDS = [
  { slug: 'op-op09-004_p2-ja', query: 'Shanks manga OP09-004' },
  { slug: 'op-op09-051_p2-ja', query: 'Buggy manga OP09-051' },
  { slug: 'op-op09-093_p2-ja', query: 'Teach manga OP09-093' },
  { slug: 'op-op09-118_p2-ja', query: 'Roger manga OP09-118' },
  { slug: 'op-op09-119_p2-ja', query: 'Luffy manga OP09-119' },
  { slug: 'op-op10-119_p2-ja', query: 'Law manga OP10-119' },
  { slug: 'op-op11-118_p2-ja', query: 'Luffy manga OP11-118' },
  { slug: 'op-op13-118_p2-ja', query: 'Luffy manga OP13-118' },
  { slug: 'op-op13-120_p2-ja', query: 'Sabo manga OP13-120' },
  { slug: 'op-op16-065_p2-ja', query: 'Sakazuki manga OP16-065' },
  { slug: 'op-op03-122_r1-ja', query: 'Sogeking manga PRB01 OP03-122' },
  { slug: 'op-op04-083_r1-ja', query: 'Sabo manga PRB01 OP04-083' },
  { slug: 'op-op05-074_r2-ja', query: 'Kid manga PRB01 OP05-074' },
  { slug: 'op-op05-069_r1-ja', query: 'Law manga PRB01 OP05-069' },
  { slug: 'op-eb01-006_r1-ja', query: 'Chopper manga PRB01 EB01-006' },
];

async function discoverUrls() {
  const { browser, page } = await connect({
    headless: 'auto',
    turnstile: true,
  });

  const discovered: Record<string, string> = {};

  try {
    for (const item of TARGET_MANGA_CARDS) {
      const searchUrl = `https://www.pricecharting.com/search-products?type=prices&q=${encodeURIComponent(item.query)}`;
      console.log(`\nSearching for: "${item.query}"...`);
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 3000));

      const currentUrl = page.url();
      if (currentUrl.includes('/game/')) {
        // Direct match redirect!
        console.log(`🎯 Direct redirect for ${item.slug}: ${currentUrl}`);
        discovered[item.slug] = currentUrl.split('?')[0];
        continue;
      }

      const html = await page.content();
      const $ = cheerio.load(html);
      
      let bestLink: string | null = null;
      $('table#games_table tbody tr').each((_, el) => {
        const title = $(el).find('td.title a').text().trim().toLowerCase();
        const set = $(el).find('td.console a').text().trim().toLowerCase();
        const href = $(el).find('td.title a').attr('href');
        
        // We MUST match Japanese One Piece set, and Manga card
        if (set.includes('japanese') && title.includes('manga') && href) {
          bestLink = href.startsWith('http') ? href : `https://www.pricecharting.com${href}`;
          return false; // break
        }
      });

      if (bestLink) {
        console.log(`✅ Found candidate for ${item.slug}: ${bestLink}`);
        discovered[item.slug] = bestLink;
      } else {
        console.log(`⚠️ No Japanese Manga match found for ${item.slug}`);
      }
    }

    console.log('\n=============================================');
    console.log('Summary of Discovered URLs:');
    console.log(JSON.stringify(discovered, null, 2));

  } finally {
    await browser.close();
  }
}

discoverUrls();
