import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as cheerio from 'cheerio';
import { getSharedBrowser } from '../lib/price-engine/browser';

dotenv.config({ path: ['.env.local', '.env'] });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

const MANGA_SLUGS = [
  'op-op01-120_p2-ja',
  'op-op01-120_r2-ja',
  'op-op02-013_r1-ja',
  'op-op02-013_p2-ja',
  'op-op03-122_r1-ja',
  'op-op03-122_p2-ja',
  'op-op04-083_p2-ja',
  'op-op04-083_r1-ja',
  'op-op05-119_p2-ja',
  'op-op05-119_r2-ja',
  'op-op05-069_r1-ja',
  'op-op05-069_p2-ja',
  'op-op05-074_r2-ja',
  'op-op05-074_p2-ja',
  'op-op06-118_p2-ja',
  'op-op06-118_r1-ja',
  'op-eb01-006_r1-ja',
  'op-eb01-006_p2-ja',
  'op-op07-051_p2-ja',
  'op-op08-118_p2-ja',
  'op-op09-118_p2-ja',
  'op-op09-093_p2-ja',
  'op-op09-004_p2-ja',
  'op-op09-051_p2-ja',
  'op-op09-119_p2-ja',
  'op-op10-119_p2-ja',
  'op-eb02-061_p2-ja',
  'op-op11-118_p2-ja',
  'op-op12-118_p2-ja',
  'op-op06-119_p3-ja',
  'op-op13-119_p1-ja',
  'op-op13-119_p3-ja',
  'op-op13-120_p2-ja',
  'op-op13-120_p3-ja',
  'op-op13-118_p2-ja',
  'op-op13-118_p3-ja',
  'op-op14-119_p2-ja',
  'op-op15-118_p2-ja',
  'op-op16-063_p2-ja',
  'op-op16-065_p2-ja',
  'op-op16-073_p2-ja'
];

async function searchSnkrdunk(query: string, setCode: string): Promise<string | null> {
  let page;
  try {
    const searchUrl = `https://snkrdunk.com/en/search/result?keyword=${encodeURIComponent(query)}&category_id=7`;
    const browser = await getSharedBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    const html = await page.content();
    const $ = cheerio.load(html);

    let selectedUrl: string | null = null;
    $('.product__item-textarea, .tile').each((_, el) => {
      if (selectedUrl) return;
      const title = $(el).find('.product__item-name, .tile__name').text().trim().toLowerCase();
      // Must not be English/Chinese/Korean
      if (title.includes('[en]') || title.includes('[cn]') || title.includes('[kr]')) return;

      const isManga = title.includes('manga') || title.includes('comic') || title.includes('treasure') || title.includes('special');
      const isReprint = title.includes('prb') || title.includes('the best');

      // Strict set code check (PRB01 vs original)
      const isPrbQuery = setCode.toLowerCase() === 'prb';
      if (isPrbQuery && !isReprint) return;
      if (!isPrbQuery && isReprint) return;

      if (isManga) {
        const link = $(el).closest('a').attr('href');
        if (link) selectedUrl = 'https://snkrdunk.com' + link;
      }
    });
    return selectedUrl;
  } catch (err) {
    console.error(`Error searching Snkrdunk for ${query}:`, err);
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

async function searchPriceCharting(query: string, isReprint: boolean): Promise<string | null> {
  try {
    const searchUrl = `https://www.pricecharting.com/search-products?q=${encodeURIComponent(query)}&type=prices`;
    const response = await fetch(searchUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    let selectedUrl: string | null = null;
    $('#games_tbody tr').each((_, el) => {
      if (selectedUrl) return;
      const title = $(el).find('.title a').text().trim().toLowerCase();

      // Ensure Japanese
      if (!title.includes('japanese')) return;

      const isManga = title.includes('manga') || title.includes('super parallel') || title.includes('treasure') || title.includes('special');

      // If we are looking for a reprint, look for 'PRB' or 'Best'
      const isTitleReprint = title.includes('premium booster') || title.includes('prb-01') || title.includes('best');
      if (isReprint && !isTitleReprint) return;
      if (!isReprint && isTitleReprint) return;

      if (isManga) {
        const link = $(el).find('.title a').attr('href');
        if (link) selectedUrl = link.startsWith('http') ? link : `https://www.pricecharting.com${link}`;
      }
    });
    return selectedUrl;
  } catch (err) {
    console.error(`Error searching PriceCharting for ${query}:`, err);
    return null;
  }
}

async function run() {
  console.log(`Starting Auto-Mapper for ${MANGA_SLUGS.length} Manga cards...`);

  const { data: cards, error } = await supabase.from('cards')
    .select('*')
    .in('slug', MANGA_SLUGS);

  if (error || !cards) {
    console.error("Error fetching cards:", error);
    process.exit(1);
  }

  let mappedCount = 0;

  for (const card of cards) {
    console.log(`\n======================================================`);
    console.log(`[MAPPER] Processing: ${card.name} (${card.number}) - ${card.slug}`);

    const setCode = card.slug.split('-')[1]?.toLowerCase() || '';
    const isReprint = setCode === 'prb01' || setCode === 'prb' || card.slug.includes('_r');
    const baseNumber = card.number.split('_')[0]; // e.g. OP01-120 from OP01-120_p2

    // Snkrdunk
    let snkrdunk_url = card.snkrdunk_url;
    if (!snkrdunk_url) {
      console.log(`[MAPPER] Searching Snkrdunk for ${baseNumber}...`);
      snkrdunk_url = await searchSnkrdunk(baseNumber, isReprint ? 'prb' : setCode);
      if (snkrdunk_url) console.log(`[MAPPER] Found Snkrdunk: ${snkrdunk_url}`);
      else console.log(`[MAPPER] No Snkrdunk match found.`);
    } else {
      console.log(`[MAPPER] Snkrdunk URL already mapped: ${snkrdunk_url}`);
    }

    // PriceCharting
    let pricecharting_url = card.pricecharting_url;
    if (!pricecharting_url) {
      console.log(`[MAPPER] Searching PriceCharting for ${baseNumber}...`);
      pricecharting_url = await searchPriceCharting(baseNumber, isReprint);
      if (pricecharting_url) console.log(`[MAPPER] Found PriceCharting: ${pricecharting_url}`);
      else console.log(`[MAPPER] No PriceCharting match found.`);
    } else {
      console.log(`[MAPPER] PriceCharting URL already mapped: ${pricecharting_url}`);
    }

    // Update the database
    if (snkrdunk_url || pricecharting_url) {
      console.log(`[MAPPER] Saving URLs to DB...`);
      await supabase.from('cards').update({
        snkrdunk_url: snkrdunk_url || null,
        pricecharting_url: pricecharting_url || null,
        curation_status: 'mapped',
      }).eq('id', card.id);

      mappedCount++;
    }
  }

  console.log(`\n======================================================`);
  console.log(`AUTO-MAPPER COMPLETE! Successfully mapped ${mappedCount} Manga cards.`);
  process.exit(0);
}

run();
