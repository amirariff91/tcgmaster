import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { getSharedBrowser } from '../lib/price-engine/browser';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

const CATEGORY_ID = 68; // One Piece

// In-memory cache for TCGPlayer products
const cachedTcgProducts: Record<string, any[]> = {};

async function getTcgProducts(baseNumber: string) {
  if (cachedTcgProducts[baseNumber]) return cachedTcgProducts[baseNumber];
  try {
    const res = await fetch(`https://tcgcsv.com/tcgplayer/${CATEGORY_ID}/groups`, { headers: { 'User-Agent': 'curl/8.4.0' } });
    const groups = (await res.json()).results || [];
    
    const prefixMatch = baseNumber.match(/^([A-Z]+[0-9]+)-/);
    if (!prefixMatch) return [];
    const abbr = prefixMatch[1];
    
    const group = groups.find((g: any) => g.abbreviation === abbr || g.abbreviation?.includes(abbr));
    if (!group) return [];
    
    const productsRes = await fetch(`https://tcgcsv.com/tcgplayer/${CATEGORY_ID}/${group.groupId}/products`, { headers: { 'User-Agent': 'curl/8.4.0' } });
    const products = (await productsRes.json()).results || [];
    
    const matches = products.filter((p: any) => p.extendedData?.find((d: any) => d.name === 'Number')?.value === baseNumber);
    cachedTcgProducts[baseNumber] = matches;
    return matches;
  } catch (e) {
    console.error(`Failed to fetch TCGPlayer products for ${baseNumber}`, e);
    return [];
  }
}

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

// Scrape Snkrdunk links using shared browser
async function scrapeSnkrdunkLinks(baseNumber: string) {
  let page;
  try {
    const browser = await getSharedBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    const searchUrl = `https://snkrdunk.com/en/search/result?keyword=${encodeURIComponent(baseNumber)}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(e => {
      console.log(`Navigation timeout or error (ignored): ${e.message}`);
    });
    await new Promise(r => setTimeout(r, 2000));
    
    const html = await page.content();
    const $ = cheerio.load(html);
    
    const results: { name: string; url: string }[] = [];
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
    return results;
  } catch (e) {
    console.error(`Snkrdunk scrape failed for ${baseNumber}`, e);
    return [];
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// Map the card properties based on rules and suffix
function resolveCardMappings(card: any, tcgProducts: any[], yyLinks: any[], sdLinks: any[]) {
  const suffix = card.slug.split('_')[1]?.split('-')[0] || '';
  const setCode = card.slug.split('-')[1]?.toLowerCase() || ''; // e.g. "op01"
  
  let tcgId: number | null = null;
  let tcgName: string | null = null;
  let yyUrl: string | null = null;
  let sdUrl: string | null = null;
  
  // Set default variantType based on suffix and rarity
  let variantType = 'Base';
  if (suffix === 'p1') {
    variantType = 'Alternate Art';
  } else if (suffix === 'p2') {
    const cleanRarity = (card.rarity || '').toLowerCase();
    const isSecOrSr = cleanRarity.includes('secret') || cleanRarity.includes('superrare');
    variantType = isSecOrSr ? 'Manga Alternate Art' : 'Alternate Art';
  } else if (suffix === 'p3' || suffix === 'p4' || suffix === 'p5' || suffix === 'p6' || suffix === 'p7' || suffix === 'p8') {
    variantType = 'Special Card';
  } else if (suffix.startsWith('r')) {
    variantType = 'Reprint';
  }

  // 1. TCGPlayer ID Mapping
  if (tcgProducts.length === 1) {
    tcgId = tcgProducts[0].productId;
    tcgName = tcgProducts[0].name;
  } else if (tcgProducts.length > 1) {
    let match = null;
    if (suffix === 'p1') {
      match = tcgProducts.find(p => p.name.toLowerCase().includes('alternate art') && !p.name.toLowerCase().includes('manga') && !p.name.toLowerCase().includes('special card') && !p.name.toLowerCase().includes('wanted'));
    } else if (suffix === 'p2') {
      match = tcgProducts.find(p => p.name.toLowerCase().includes('manga'));
      if (match) {
        variantType = 'Manga Alternate Art';
      } else {
        match = tcgProducts.find(p => p.name.toLowerCase().includes('alternate art') && !p.name.toLowerCase().includes('special card'));
      }
    } else if (suffix === 'p3' || suffix === 'p4' || suffix === 'p5' || suffix === 'p6' || suffix === 'p7' || suffix === 'p8') {
      match = tcgProducts.find(p => p.name.toLowerCase().includes('wanted') || p.name.toLowerCase().includes('special card') || p.name.toLowerCase().includes('sp'));
      if (match?.name.toLowerCase().includes('wanted')) {
        variantType = 'Wanted Poster';
      }
    } else if (suffix.startsWith('r')) {
      match = tcgProducts.find(p => p.name.toLowerCase().includes('reprint') || p.name.toLowerCase().includes('prb'));
    }
    
    if (match) {
      tcgId = match.productId;
      tcgName = match.name;
    }
  }

  // 2. Yuyutei URL Mapping (filtering by setCode to prevent PRB mismatching)
  const yySetLinks = yyLinks.filter(l => l.url.includes(`/${setCode}/`));
  if (yySetLinks.length > 0) {
    let match = null;
    if (suffix === 'p1') {
      match = yySetLinks.find(l => l.name.includes('パラレル') && !l.name.includes('スーパー') && !l.name.includes('スペシャル') && !l.name.includes('手配書'));
    } else if (suffix === 'p2') {
      match = yySetLinks.find(l => l.name.includes('スーパーパラレル') || l.name.includes('コミック'));
      if (!match) {
        match = yySetLinks.find(l => l.name.includes('パラレル') && !l.name.includes('スペシャル'));
      }
    } else if (suffix === 'p3' || suffix === 'p4' || suffix === 'p5' || suffix === 'p6' || suffix === 'p7' || suffix === 'p8') {
      match = yySetLinks.find(l => l.name.includes('スペシャル') || l.name.includes('手配書'));
      if (match?.name.includes('手配書')) {
        variantType = 'Wanted Poster';
      }
    } else if (suffix.startsWith('r')) {
      match = yySetLinks.find(l => l.name.includes('(PRB)'));
    } else if (!suffix) {
      match = yySetLinks.find(l => !l.name.includes('パラレル') && !l.name.includes('(PRB)'));
    }
    
    if (match) yyUrl = match.url;
  }

  // 3. Snkrdunk URL Mapping
  if (sdLinks.length > 0) {
    let match = null;
    if (suffix === 'p1') {
      match = sdLinks.find(l => l.name.toLowerCase().includes('parallel') && !l.name.toLowerCase().includes('super') && !l.name.toLowerCase().includes('special') && !l.name.toLowerCase().includes('wanted'));
    } else if (suffix === 'p2') {
      match = sdLinks.find(l => l.name.toLowerCase().includes('super') || l.name.toLowerCase().includes('manga'));
      if (!match) {
        match = sdLinks.find(l => l.name.toLowerCase().includes('parallel') && !l.name.toLowerCase().includes('special'));
      }
    } else if (suffix === 'p3' || suffix === 'p4' || suffix === 'p5' || suffix === 'p6' || suffix === 'p7' || suffix === 'p8') {
      match = sdLinks.find(l => l.name.toLowerCase().includes('special') || l.name.toLowerCase().includes('wanted'));
      if (match?.name.toLowerCase().includes('wanted')) {
        variantType = 'Wanted Poster';
      }
    } else if (suffix.startsWith('r')) {
      match = sdLinks.find(l => l.name.toLowerCase().includes('prb') || l.name.toLowerCase().includes('reprint'));
    } else if (!suffix) {
      match = sdLinks.find(l => !l.name.toLowerCase().includes('parallel') && !l.name.toLowerCase().includes('prb'));
    }
    
    if (match) sdUrl = match.url;
  }

  // Handle Serialized cards explicitly
  if (card.slug.includes('eb04-061_p2') || card.slug.includes('st01-001_p3') || card.slug.includes('st01-001_p4')) {
    variantType = 'Serialized Card';
  }

  return { tcgId, tcgName, yyUrl, sdUrl, variantType };
}

async function run() {
  console.log("Fetching all variant cards from Supabase...");
  
  let allCards: any[] = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data: cards, error } = await supabase
      .from('cards')
      .select('id, slug, name, number, rarity, tcg_player_id, yuyutei_url, snkrdunk_url')
      .like('slug', 'op-%_%')
      .range(page * pageSize, (page + 1) * pageSize - 1);
      
    if (error || !cards || cards.length === 0) break;
    allCards.push(...cards);
    page++;
  }

  console.log(`Found ${allCards.length} variant cards to map.`);
  let count = 0;

  for (const card of allCards) {
    count++;
    
    const isJp = card.slug.endsWith('-ja');
    const suffix = card.slug.split('_')[1]?.split('-')[0] || '';
    
    const cleanRarity = (card.rarity || '').toLowerCase();
    const isHighValue = ['secretrare', 'leader', 'special', 'superrare'].includes(cleanRarity) && 
                        ['p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].includes(suffix);
    
    let tcgProducts: any[] = [];
    let yyLinks: any[] = [];
    let sdLinks: any[] = [];

    // Query English TCGPlayer for all cards
    if (!isJp) {
      tcgProducts = await getTcgProducts(card.number);
    }
    
    if (isHighValue && isJp) {
      console.log(`[${count}/${allCards.length}] HIGH VALUE (JP): Processing ${card.slug} (${card.name} / ${card.number})...`);
      yyLinks = await scrapeYuyuteiLinks(card.number);
      sdLinks = await scrapeSnkrdunkLinks(card.number);
      
      // Delay to respect rate limits
      await new Promise(r => setTimeout(r, 2000));
    } else {
      if (count % 100 === 0) {
        console.log(`[${count}/${allCards.length}] Fast Path: Mapping standard variant ${card.slug}...`);
      }
    }
    
    const mappings = resolveCardMappings(card, tcgProducts, yyLinks, sdLinks);
    
    // Build update payload
    const updatePayload: any = {};
    const setCode = card.slug.split('-')[1]?.toLowerCase() || '';
    
    // Clean up poisoned Snkrdunk URL
    const currentSdUrl = card.snkrdunk_url || '';
    const isSdUrlPoisoned = currentSdUrl.includes('/search/result');
    if (mappings.sdUrl) {
      updatePayload.snkrdunk_url = mappings.sdUrl;
    } else if (isSdUrlPoisoned || (isHighValue && isJp)) {
      updatePayload.snkrdunk_url = null;
    }
    
    // Clean up poisoned Yuyutei URL
    const currentYyUrl = card.yuyutei_url || '';
    const isYyUrlPoisoned = currentYyUrl && !currentYyUrl.includes(`/${setCode}/`);
    if (mappings.yyUrl) {
      updatePayload.yuyutei_url = mappings.yyUrl;
    } else if (isYyUrlPoisoned || (isHighValue && isJp)) {
      updatePayload.yuyutei_url = null;
    }
    
    if (mappings.tcgId) updatePayload.tcg_player_id = String(mappings.tcgId);
    
    // Update name to custom display format
    if (mappings.variantType && mappings.variantType !== 'Base') {
      const cleanBaseName = card.name.split(' (')[0];
      updatePayload.name = `${cleanBaseName} (${mappings.variantType})`;
    }
    
    // Store metadata
    updatePayload.print_run_info = {
      tcgplayer_card_name: mappings.tcgName || card.name,
      variant_type: mappings.variantType
    };
    
    // Only update if there are changes to make it fast
    if (updatePayload.tcg_player_id !== card.tcg_player_id || 
        updatePayload.yuyutei_url !== card.yuyutei_url || 
        updatePayload.snkrdunk_url !== card.snkrdunk_url || 
        updatePayload.name !== card.name ||
        card.print_run_info?.variant_type !== mappings.variantType) {
        
      const { error: updateError } = await supabase
        .from('cards')
        .update(updatePayload)
        .eq('id', card.id);
        
      if (updateError) {
        console.error(`Failed to update card ${card.slug}:`, updateError.message);
      }
    }
  }

  console.log("Visual Mapping and Database Classification Complete!");
  process.exit(0);
}

run();
