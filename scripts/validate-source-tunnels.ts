import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { verifyImageMatch } from '../lib/price-engine/image-matcher';
import { redis } from '../lib/redis/client';
import * as cheerio from 'cheerio';
import { getSharedBrowser } from '../lib/price-engine/browser';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const isTestMode = process.argv.includes('--test');
const testSlugsIdx = process.argv.indexOf('--slugs');
const targetSlugs = testSlugsIdx > -1 ? process.argv[testSlugsIdx + 1].split(',') : [];

/**
 * Get product thumbnail from Snkrdunk using Puppeteer because they have anti-bot protections
 */
async function getSnkrdunkThumbnail(url: string): Promise<string | null> {
  const id = url.split('/trading-cards/')[1]?.split('?')[0];
  if (!id) return null;
  // Use their internal API which we know works well
  try {
    const res = await fetch(`https://snkrdunk.com/en/v1/brands/onepiece/streetwears/${id}`, {
      headers: {
        'User-Agent': 'TCGMaster/1.0',
        'Accept': 'application/json'
      }
    });
    if (res.ok) {
      const data = await res.json();
      return data.imageUrl || data.smallImageUrl || null;
    }
  } catch (err) {}
  
  // Fallback to searching the HTML for og:image
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    const html = await res.text();
    const $ = cheerio.load(html);
    let ogImage = $('meta[property="og:image"]').attr('content');
    if (ogImage) return ogImage;

    // Direct regex match for CDN links (fallback 2)
    const match = html.match(/https:\/\/cdn\.snkrdunk\.com\/(upload_bg_removed|uploads\/media)\/[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp)/);
    if (match) return match[0];
  } catch(e) {}

  // Heavy fallback: use Puppeteer
  let page = null;
  try {
    const browser = await getSharedBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    const imgUrl = await page.evaluate(() => {
      const nextEl = document.getElementById('__NEXT_DATA__');
      if (nextEl) {
        try {
          const data = JSON.parse(nextEl.textContent || '');
          const image = data?.props?.pageProps?.streetwear?.imageUrl || data?.props?.pageProps?.streetwear?.smallImageUrl;
          if (image) return image;
        } catch (e) {}
      }
      
      const els = Array.from(document.querySelectorAll('img'));
      for (const img of els) {
        if (img.src && img.src.includes('snkrdunk.com') && img.src.includes('upload') && !img.src.includes('icon') && !img.src.includes('logo')) {
          return img.src;
        }
      }
      return null;
    });
    
    return imgUrl;
  } catch (err) {
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

/**
 * Get product thumbnail from Yuyutei
 */
async function getYuyuteiThumbnail(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    let img = $('.card-image img').attr('src') || $('.product-image img').attr('src');
    if (img && !img.startsWith('http')) {
      img = 'https://yuyu-tei.jp' + img;
    }
    return img || null;
  } catch (err) {
    return null;
  }
}

/**
 * Search Snkrdunk for alternatives
 */
async function searchSnkrdunkAlternative(name: string, number: string): Promise<string | null> {
  try {
    // Only search using name + number to get accurate hits
    const searchWord = `${name.split(' (')[0]} ${number}`;
    const searchUrl = `https://snkrdunk.com/en/v1/brands/onepiece/streetwears?perPage=20&page=1&department=tradingCard&keyword=${encodeURIComponent(searchWord)}`;
    
    const res = await fetch(searchUrl, { headers: { 'User-Agent': 'TCGMaster/1.0', 'Accept': 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      const items = data.streetwears || data.products || [];
      if (items.length > 0) {
        return `https://snkrdunk.com/en/trading-cards/${items[0].id}`;
      }
    }
  } catch (err) {}
  
  // Puppeteer fallback for search
  let page = null;
  try {
    const searchWord = `${name.split(' (')[0]} ${number}`;
    const searchUrl = `https://snkrdunk.com/en/search/result?keyword=${encodeURIComponent(searchWord)}`;
    
    const browser = await getSharedBrowser();
    page = await browser.newPage();
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    const firstLink = await page.evaluate(() => {
      const el = document.querySelector('.product__item-textarea');
      if (el) {
        const link = el.closest('a');
        if (link) return link.href;
      }
      return null;
    });
    
    return firstLink;
  } catch (err) {
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

/**
 * Search Yuyutei for alternatives
 */
async function searchYuyuteiAlternative(name: string, number: string): Promise<string | null> {
  try {
    const searchWord = number;
    const searchUrl = `https://yuyu-tei.jp/sell/opc/s/search?search_word=${encodeURIComponent(searchWord)}`;
    const res = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    // Just grab the first result for now as candidate
    const firstLink = $('.card-product').first().find('a').attr('href');
    if (firstLink) {
      return firstLink.startsWith('http') ? firstLink : 'https://yuyu-tei.jp' + firstLink;
    }
  } catch (err) {}
  return null;
}

/**
 * Run verification for a single card
 */
async function verifyCard(card: any) {
  console.log(`\n🔍 Verifying ${card.slug} (${card.name})`);
  
  const statusKey = `source_status:${card.id}`;
  let currentStatusStr = await redis.get(statusKey);
  
  let status: Record<string, string> = {};
  if (currentStatusStr) {
    try {
      if (typeof currentStatusStr === 'string' && currentStatusStr.startsWith('{')) {
        status = JSON.parse(currentStatusStr);
      }
    } catch(e) {}
  }
  
  let updated = false;
  let variantType = 'Base';
  try {
    const printRun = typeof card.print_run_info === 'string' ? JSON.parse(card.print_run_info) : card.print_run_info;
    variantType = printRun?.variant_type || 'Base';
  } catch(e) {}

  // Check Snkrdunk
  if (card.snkrdunk_url && status.snkrdunk !== 'verified') {
    console.log(`  Checking Snkrdunk URL: ${card.snkrdunk_url}`);
    const thumbUrl = await getSnkrdunkThumbnail(card.snkrdunk_url);
    
    if (thumbUrl) {
      console.log(`  Fetched thumbnail (${thumbUrl}), verifying with Ollama...`);
      const result = await verifyImageMatch(
        card.local_image_url || card.image_url, 
        thumbUrl, 
        card.name, 
        card.number,
        variantType
      );
      
      console.log(`  Ollama Result: ${result.match ? '✅ MATCH' : '❌ NO MATCH'} (Conf: ${result.confidence}%)`);
      console.log(`  Detected: ${result.detectedCard}`);
      
      if (result.match) {
        status.snkrdunk = 'verified';
        updated = true;
      } else {
        console.log(`  Not a match. Searching for alternative Snkrdunk listing...`);
        const altUrl = await searchSnkrdunkAlternative(card.name, card.number);
        
        if (altUrl && altUrl !== card.snkrdunk_url) {
          console.log(`  Found alternative URL: ${altUrl}`);
          const altThumb = await getSnkrdunkThumbnail(altUrl);
          if (altThumb) {
            const altResult = await verifyImageMatch(card.local_image_url || card.image_url, altThumb, card.name, card.number, variantType);
            if (altResult.match) {
              console.log(`  Alternative matches! Updating snkrdunk_url...`);
              if (!isTestMode) await supabase.from('cards').update({ snkrdunk_url: altUrl }).eq('id', card.id);
              status.snkrdunk = 'verified';
              updated = true;
            } else {
              console.log(`  Alternative did NOT match. Rejecting snkrdunk completely.`);
              status.snkrdunk = 'rejected';
              updated = true;
            }
          }
        } else {
          status.snkrdunk = 'rejected';
          updated = true;
        }
      }
    } else {
      console.log(`  Failed to get Snkrdunk thumbnail`);
      status.snkrdunk = 'rejected';
      updated = true;
    }
  } else if (card.snkrdunk_url) {
    console.log(`  Snkrdunk URL already verified`);
  }

  // Check Yuyutei
  if (card.yuyutei_url && status.yuyutei !== 'verified') {
    console.log(`  Checking Yuyutei URL: ${card.yuyutei_url}`);
    const thumbUrl = await getYuyuteiThumbnail(card.yuyutei_url);
    
    if (thumbUrl) {
      console.log(`  Fetched thumbnail (${thumbUrl}), verifying with Ollama...`);
      const result = await verifyImageMatch(
        card.local_image_url || card.image_url, 
        thumbUrl, 
        card.name, 
        card.number,
        variantType
      );
      
      console.log(`  Ollama Result: ${result.match ? '✅ MATCH' : '❌ NO MATCH'} (Conf: ${result.confidence}%)`);
      
      if (result.match) {
        status.yuyutei = 'verified';
        updated = true;
      } else {
        console.log(`  Not a match. Searching for alternative Yuyutei listing...`);
        const altUrl = await searchYuyuteiAlternative(card.name, card.number);
        
        if (altUrl && altUrl !== card.yuyutei_url) {
          console.log(`  Found alternative URL: ${altUrl}`);
          const altThumb = await getYuyuteiThumbnail(altUrl);
          if (altThumb) {
            const altResult = await verifyImageMatch(card.local_image_url || card.image_url, altThumb, card.name, card.number, variantType);
            if (altResult.match) {
              console.log(`  Alternative matches! Updating yuyutei_url...`);
              if (!isTestMode) await supabase.from('cards').update({ yuyutei_url: altUrl }).eq('id', card.id);
              status.yuyutei = 'verified';
              updated = true;
            } else {
              status.yuyutei = 'rejected';
              updated = true;
            }
          }
        } else {
          status.yuyutei = 'rejected';
          updated = true;
        }
      }
    } else {
      console.log(`  Failed to get Yuyutei thumbnail`);
      status.yuyutei = 'rejected';
      updated = true;
    }
  } else if (card.yuyutei_url) {
    console.log(`  Yuyutei URL already verified`);
  }

  if (updated) {
    status.verified_at = new Date().toISOString();
    await redis.set(statusKey, JSON.stringify(status));
    
    if (status.snkrdunk === 'rejected') {
      if (!isTestMode) {
        console.log(`  Purging old Snkrdunk price history for ${card.slug}...`);
        await supabase.from('price_history').delete().eq('card_id', card.id).eq('source', 'snkrdunk');
        await supabase.from('cards').update({ snkrdunk_url: null }).eq('id', card.id);
      } else {
        console.log(`  [TEST] Would purge old Snkrdunk price history for ${card.slug}...`);
      }
    }
    
    if (status.yuyutei === 'rejected') {
      if (!isTestMode) {
        console.log(`  Purging old Yuyutei price history for ${card.slug}...`);
        await supabase.from('price_history').delete().eq('card_id', card.id).eq('source', 'yuyutei');
        await supabase.from('cards').update({ yuyutei_url: null }).eq('id', card.id);
      } else {
        console.log(`  [TEST] Would purge old Yuyutei price history for ${card.slug}...`);
      }
    }
  }
}

async function run() {
  console.log(`🤖 Starting URL Tunnel Validator (Test Mode: ${isTestMode})`);
  
  let query = supabase
    .from('cards')
    .select('id, slug, name, number, image_url, local_image_url, snkrdunk_url, yuyutei_url, print_run_info, price_cache_ttl')
    .or('snkrdunk_url.not.is.null,yuyutei_url.not.is.null')
    .like('slug', 'op-%-ja')
    .order('price_cache_ttl', { ascending: false });
    
  if (targetSlugs.length > 0) {
    query = query.in('slug', targetSlugs);
  } else {
    // Only run on expensive cards initially
    query = query.limit(500); // Expanded batch size
  }

  const { data: cards, error } = await query;
  if (error || !cards) {
    console.error('Failed to fetch cards:', error);
    process.exit(1);
  }

  console.log(`Found ${cards.length} cards to verify.`);
  
  for (const card of cards) {
    await verifyCard(card);
    await new Promise(r => setTimeout(r, 2000)); // Respect rate limits
  }
  
  console.log(`\n✅ Validation pass complete!`);
  process.exit(0);
}

run().catch(console.error);
