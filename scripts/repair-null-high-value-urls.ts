import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { getSharedBrowser } from '../lib/price-engine/browser';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

// Scrape Yuyutei links
async function scrapeYuyuteiLinks(baseNumber: string) {
  try {
    const searchUrl = `https://yuyu-tei.jp/sell/opc/s/search?search_word=${encodeURIComponent(baseNumber)}`;
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    
    const results: { name: string; url: string }[] = [];
    $('.card-product').each((_, el) => {
      const name = $(el).text().trim();
      const link = $(el).find('a').attr('href');
      if (link) {
        results.push({
          name,
          url: link.startsWith('http') ? link : 'https://yuyu-tei.jp' + link
        });
      }
    });
    return results;
  } catch (e) {
    console.error(`Yuyutei scrape failed for ${baseNumber}`, e);
    return [];
  }
}

// Scrape Snkrdunk links using shared browser with fallback keywords
async function scrapeSnkrdunkLinks(baseNumber: string, cardName: string) {
  let page;
  try {
    const browser = await getSharedBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Try multiple search terms (1. Card Number, 2. Name + Set Code, 3. Set Code)
    const setCode = baseNumber.split('-')[0]; // e.g. "OP05"
    const searchQueries = [
      baseNumber, 
      `${cardName.split(' (')[0]} ${setCode}`,
      setCode.replace(/([A-Za-z]+)([0-9]+)/, '$1-$2') // e.g. "OP-05"
    ];
    
    const results: { name: string; url: string }[] = [];
    
    for (const query of searchQueries) {
      const searchUrl = `https://snkrdunk.com/en/search/result?keyword=${encodeURIComponent(query)}`;
      console.log(`-> Searching Snkrdunk for query: ${query}...`);
      
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(e => {
        console.log(`Navigation error: ${e.message}`);
      });
      await new Promise(r => setTimeout(r, 2000));
      
      const html = await page.content();
      const $ = cheerio.load(html);
      
      $('.product__item-textarea').each((_, el) => {
        const name = $(el).find('.product__item-name').text().trim();
        const link = $(el).closest('a').attr('href');
        if (link) {
          results.push({
            name,
            url: link.startsWith('http') ? link : 'https://snkrdunk.com' + link
          });
        }
      });
      
      // If we found products containing our baseNumber, we can stop searching!
      const hasMatch = results.some(r => r.name.includes(baseNumber));
      if (hasMatch) {
        console.log(`-> Found match for ${baseNumber} on Snkrdunk!`);
        break;
      }
      
      // Delay before next search query
      await new Promise(r => setTimeout(r, 1000));
    }
    
    return results;
  } catch (e) {
    console.error(`Snkrdunk scrape failed for ${baseNumber}`, e);
    return [];
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

async function run() {
  console.log("Loading all Japanese high-value cards with missing URLs...");
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, slug, name, number, rarity, tcg_player_id, yuyutei_url, snkrdunk_url')
    .ilike('slug', 'op-%')
    .ilike('slug', '%-ja')
    .or('yuyutei_url.is.null,snkrdunk_url.is.null');

  if (error || !cards) {
    console.error("Failed to load cards", error);
    return;
  }

  // Filter high-value ones
  const highValueCards = cards.filter(card => {
    const suffix = card.slug.split('_')[1]?.split('-')[0] || '';
    const cleanRarity = (card.rarity || '').toLowerCase();
    const isHighValue = ['secretrare', 'leader', 'special', 'superrare'].includes(cleanRarity) && 
                        ['p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].includes(suffix);
    // Explicit check for serialized ones too
    const isSerialized = card.slug.includes('eb04-061_p2') || card.slug.includes('st01-001_p3') || card.slug.includes('st01-001_p4');
    return isHighValue || isSerialized;
  });

  console.log(`Found ${highValueCards.length} high-value Japanese cards missing URLs to repair.`);

  for (const card of highValueCards) {
    console.log(`\nRepairing ${card.slug} (${card.name} / ${card.number})...`);
    
    const suffix = card.slug.split('_')[1]?.split('-')[0] || '';
    const setCode = card.slug.split('-')[1]?.toLowerCase() || '';
    const baseNumber = card.number.split('_')[0];
    
    let yyUrl = card.yuyutei_url;
    let sdUrl = card.snkrdunk_url;

    // 1. Repair Yuyutei URL if null
    if (!yyUrl) {
      console.log(`-> Scraping Yuyutei for ${baseNumber}...`);
      const yyLinks = await scrapeYuyuteiLinks(baseNumber);
      const yySetLinks = yyLinks.filter(l => l.url.includes(`/${setCode}/`));
      
      let match = null;
      if (suffix === 'p1') {
        // Alt Art
        match = yySetLinks.find(l => l.name.includes('パラレル') && !l.name.includes('スーパー') && !l.name.includes('スペシャル') && !l.name.includes('手配書'));
      } else if (suffix === 'p2') {
        // Manga
        match = yySetLinks.find(l => l.name.includes('スーパーパラレル') || l.name.includes('コミック'));
      } else if (suffix === 'p3' || suffix === 'p4' || suffix === 'p5' || suffix === 'p6' || suffix === 'p7' || suffix === 'p8') {
        // Special/Wanted cards: look for ID ending with 71+ or in the 170+ range
        match = yySetLinks.find(l => {
          const urlNum = parseInt(l.url.split('/').pop() || '0', 10);
          const isSpecialRange = (urlNum % 1000) >= 165;
          return isSpecialRange || l.name.includes('スペシャル') || l.name.includes('手配書');
        });
      }
      
      if (match) {
        console.log(`-> Mapped Yuyutei URL: ${match.url}`);
        yyUrl = match.url;
      }
    }

    // 2. Repair Snkrdunk URL if null
    if (!sdUrl) {
      console.log(`-> Scraping Snkrdunk for ${baseNumber}...`);
      const sdLinks = await scrapeSnkrdunkLinks(baseNumber, card.name);
      
      let match = null;
      if (suffix === 'p1') {
        match = sdLinks.find(l => l.name.includes(baseNumber) && l.name.toLowerCase().includes('parallel') && !l.name.toLowerCase().includes('super') && !l.name.toLowerCase().includes('special') && !l.name.toLowerCase().includes('wanted'));
      } else if (suffix === 'p2') {
        // Manga or Promo Parallel
        match = sdLinks.find(l => l.name.includes(baseNumber) && (l.name.toLowerCase().includes('super') || l.name.toLowerCase().includes('manga')));
        if (!match) {
          // Fallback to match promo / other parallel versions if no manga exists
          match = sdLinks.find(l => l.name.includes(baseNumber) && (l.name.toLowerCase().includes('parallel') || l.name.toLowerCase().includes('sr-p') || l.name.toLowerCase().includes('promo') || l.name.toLowerCase().includes('pack')));
        }
      } else if (suffix === 'p3' || suffix === 'p4' || suffix === 'p5' || suffix === 'p6' || suffix === 'p7' || suffix === 'p8') {
        // Special/Wanted
        match = sdLinks.find(l => l.name.includes(baseNumber) && (l.name.toLowerCase().includes('special') || l.name.toLowerCase().includes('wanted')));
      }
      
      if (match) {
        console.log(`-> Mapped Snkrdunk URL: ${match.url}`);
        sdUrl = match.url;
      }
    }

    // 3. Write updates
    const updatePayload: any = {};
    if (yyUrl && yyUrl !== card.yuyutei_url) updatePayload.yuyutei_url = yyUrl;
    if (sdUrl && sdUrl !== card.snkrdunk_url) updatePayload.snkrdunk_url = sdUrl;

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await supabase
        .from('cards')
        .update(updatePayload)
        .eq('id', card.id);
        
      if (updateError) {
        console.error(`-> Failed to update card ${card.slug}:`, updateError.message);
      } else {
        console.log(`-> Successfully repaired URLs in Supabase for ${card.slug}`);
      }
    } else {
      console.log("-> No new URLs found to update.");
    }
  }

  console.log("Targeted URL repair complete!");
  process.exit(0);
}

run();
