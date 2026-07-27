import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { getSharedBrowser } from '../../lib/price-engine/browser';
import * as cheerio from 'cheerio';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runDiscovery() {
  console.log('Fetching top 100 expensive Japanese OP cards that lack URLs...');
  
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, slug, name, number, snkrdunk_url, pricecharting_url, yuyutei_url, price_cache_ttl')
    .like('slug', 'op-%-ja')
    .or('snkrdunk_url.is.null,pricecharting_url.is.null,yuyutei_url.is.null')
    .order('price_cache_ttl', { ascending: false, nullsFirst: false })
    .limit(100);

  if (error || !cards) {
    console.error('Error fetching cards', error);
    return;
  }

  const browser = await getSharedBrowser();
  let updatedCount = 0;

  for (const card of cards) {
    console.log(`\n==============================================`);
    console.log(`Processing: ${card.name} (${card.number}) - $${((card.price_cache_ttl || 0) / 100).toFixed(2)}`);
    
    let updates: any = {};
    const cardNumLower = card.number.toLowerCase();
    
    if (!card.snkrdunk_url) {
      console.log(`  [Snkrdunk] Searching for ${card.number}...`);
      try {
        const page = await browser.newPage();
        await page.goto(`https://snkrdunk.com/en/search/result?keyword=${encodeURIComponent(card.number)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await delay(2000);
        const html = await page.content();
        const $ = cheerio.load(html);
        
        const firstLink = $('a[href*="/en/trading-cards/"]').first();
        if (firstLink.length > 0) {
          const href = firstLink.attr('href');
          const title = firstLink.text().toLowerCase();
          
          if (href && title.includes(cardNumLower)) {
             const fullUrl = href.startsWith('http') ? href : `https://snkrdunk.com${href}`;
             console.log(`  ✅ [Snkrdunk] Found VERIFIED match: ${fullUrl}`);
             updates.snkrdunk_url = fullUrl.split('?')[0];
          } else {
             console.log(`  ⚠️ [Snkrdunk] Found a link but title didnt match perfectly.`);
          }
        } else {
          console.log(`  ❌ [Snkrdunk] No results found.`);
        }
        await page.close();
      } catch(e: any) {
        console.log(`  ❌ [Snkrdunk] Error: ${e.message}`);
      }
    }
    
    if (!card.pricecharting_url) {
      console.log(`  [PriceCharting] Generating URL deterministically...`);
      let setSlug = card.slug.split('-')[1]; // op-op01-001-ja -> op01
      if (setSlug === 'p' || card.number.startsWith('P-')) setSlug = 'promo';
      
      const cleanName = card.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const cleanNum = cardNumLower.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      
      let pcUrl = `https://www.pricecharting.com/game/one-piece-japanese-${setSlug}/${cleanName}-${cleanNum}`;
      
      // Handle special variants for PC
      if (card.slug.endsWith('_p2-ja')) pcUrl += '-manga';
      else if (card.slug.endsWith('_p3-ja') || card.slug.endsWith('_p4-ja')) pcUrl += '-special-card';
      else if (card.slug.includes('_p') && !card.slug.endsWith('_p1-ja')) pcUrl += '-parallel';
      
      try {
        const page = await browser.newPage();
        await page.goto(pcUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const html = await page.content();
        const $ = cheerio.load(html);
        const title = $('title').text().toLowerCase();
        
        if (title.includes('price') && title.includes('one piece')) {
           console.log(`  ✅ [PriceCharting] Verified generated URL: ${pcUrl}`);
           updates.pricecharting_url = pcUrl;
        } else {
           console.log(`  ❌ [PriceCharting] Generated URL looks invalid (404/wrong page).`);
        }
        await page.close();
      } catch(e: any) {
         console.log(`  ❌ [PriceCharting] Error checking generated URL: ${e.message}`);
      }
    }

    if (Object.keys(updates).length > 0) {
       updates.curation_status = 'pending';
       await supabase.from('cards').update(updates).eq('id', card.id);
       updatedCount++;
       console.log(`  💾 Saved ${Object.keys(updates).length} new URLs to database.`);
    }
  }
  
  console.log(`\nDone. Updated URLs for ${updatedCount} cards.`);
  process.exit(0);
}

runDiscovery();
