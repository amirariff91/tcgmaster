import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { getSharedBrowser } from '../../../lib/price-engine/browser';
import type { PopulationCard, PopulationDatabase, PsaCookie } from './types';
import fs from 'fs';
import path from 'path';

import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const SLEEP_MS = 15000;

// PSA UUID in the grading_companies table
const PSA_COMPANY_ID = '74c51627-cc4b-4a82-a1c0-52b3975b47b7';

export async function scrapePsa(card: PopulationCard, supabase: PopulationDatabase, cookies: PsaCookie[]) {
  const searchQuery = encodeURIComponent(`${card.name} ${card.sets?.name || ''} ${card.number}`);
  console.log(`\n[PSA] Ingesting Population for ${card.slug}...`);

  try {
    const browser = await getSharedBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    if (cookies && cookies.length > 0) {
       await page.setCookie(...cookies);
    }

    const searchUrl = `https://www.psacard.com/pop/search?q=${searchQuery}`;
    console.log(`  -> Searching: ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise(r => setTimeout(r, 5000));

    const title = await page.title();
    if (title.includes('Sign In')) {
       console.log('  ! Session expired! Please re-run scripts/psa-login.ts to refresh cookies.');
       await page.close();
       return false;
    }

    const html = await page.content();
    const $ = cheerio.load(html);

    let popUrl: string | null = null;
    $('a').each((_, el) => {
       const href = $(el).attr('href');
       const text = $(el).text().toLowerCase();
       if (href && href.includes('/pop/') && text.includes(card.number.toLowerCase())) {
          popUrl = href.startsWith('http') ? href : `https://www.psacard.com${href}`;
       }
    });

    if (!popUrl) {
       console.log(`  ✗ Could not find direct pop report link in search results.`);
       await page.close();
       return true; // Success (no data found)
    }

    console.log(`  -> Navigating to exact Pop Report: ${popUrl}`);
    await page.goto(popUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await new Promise(r => setTimeout(r, 3000));

    const popHtml = await page.content();
    const $pop = cheerio.load(popHtml);

    let totalPop = 0;
    const gradeCounts: Record<string, number> = {};

    $pop('tr').each((_, tr) => {
       const text = $pop(tr).text().toLowerCase();
       if (text.includes(card.number.toLowerCase()) || text.includes(card.name.toLowerCase())) {
          const cells = $pop(tr).find('td');
          if (cells.length > 10) {
             gradeCounts['10'] = parseInt($pop(cells[cells.length - 2]).text().trim() || '0');
             gradeCounts['9'] = parseInt($pop(cells[cells.length - 3]).text().trim() || '0');
             gradeCounts['8'] = parseInt($pop(cells[cells.length - 4]).text().trim() || '0');
          }
       }
    });

    if (Object.keys(gradeCounts).length > 0) {
       for (const [grade, count] of Object.entries(gradeCounts)) {
           if (count > 0) {
               totalPop += count;
               const { error: popErr } = await supabase.from('population_reports').upsert({
                   card_id: card.id,
                   grading_company_id: PSA_COMPANY_ID,
                   grade: grade,
                   count: count,
                   scraped_at: new Date().toISOString()
               }, { onConflict: 'card_id,grading_company_id,grade' });
               if (popErr) { console.error(`  ✗ population_reports upsert failed: ${popErr.message}`); return false; }
           }
       }
       console.log(`  ✓ Inserted PSA population data (Total Pop: ${totalPop})`);
    } else {
       console.log(`  ✗ No matching population rows found in the table.`);
    }

    await page.close();
    return true;

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  ! Error scraping PSA: ${message}`);
    return false;
  }
}
