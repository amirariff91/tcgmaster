import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { getSharedBrowser } from '../../lib/price-engine/browser';
import fs from 'fs';
import path from 'path';

require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const SLEEP_MS = 15000;

// PSA UUID in the grading_companies table
const PSA_COMPANY_ID = '74c51627-cc4b-4a82-a1c0-52b3975b47b7';

async function run() {
  console.log(`Starting PSA Population Scraper Worker...`);
  
  const cookiePath = path.join(__dirname, '..', '..', 'psa-cookies.json');
  if (!fs.existsSync(cookiePath)) {
    console.error('CRITICAL: psa-cookies.json not found! Please run scripts/psa-login.ts first.');
    process.exit(1);
  }
  
  const cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf8'));

  const trackerPath = path.join(__dirname, '..', '..', 'population-tracker.json');
  let tracker: Record<string, string> = {};
  if (fs.existsSync(trackerPath)) {
     tracker = JSON.parse(fs.readFileSync(trackerPath, 'utf8'));
  }

  while (true) {
    let cards = [];
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('id, name, slug, number, set_id, sets ( name )')
        .limit(1000); // Fetch a batch
         
      if (!error && data) {
         // Sort by those least recently fetched in our local tracker
         cards = data.sort((a, b) => {
            const timeA = tracker[a.id] ? new Date(tracker[a.id]).getTime() : 0;
            const timeB = tracker[b.id] ? new Date(tracker[b.id]).getTime() : 0;
            return timeA - timeB;
         }).slice(0, 1);
      }
    } catch (e) {
      console.error('Error fetching cards:', e);
    }

    if (cards.length === 0) {
      console.log('No cards found. Sleeping...');
      await new Promise(r => setTimeout(r, SLEEP_MS));
      continue;
    }

    const card = cards[0];
    const setName = card.sets?.name || '';
    const searchQuery = encodeURIComponent(`${card.name} ${setName} ${card.number}`);
    
    console.log(`\nIngesting Population for ${card.slug}...`);

    try {
      const browser = await getSharedBrowser();
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      
      await page.setCookie(...cookies);
      
      const searchUrl = `https://www.psacard.com/pop/search?q=${searchQuery}`;
      console.log(`  -> Searching: ${searchUrl}`);
      
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      
      // Wait to see if we hit a Cloudflare challenge or redirect
      await new Promise(r => setTimeout(r, 5000));
      
      const title = await page.title();
      if (title.includes('Sign In')) {
         console.log('  ! Session expired! Please re-run scripts/psa-login.ts to refresh cookies.');
         await page.close();
         await new Promise(r => setTimeout(r, 60000));
         continue;
      }
      
      const html = await page.content();
      const $ = cheerio.load(html);
      
      // Attempt to find the specific pop report URL from search results
      // PSA search results structure varies, but usually links to /pop/tcg-cards/...
      let popUrl = null;
      
      $('a').each((_, el) => {
         const href = $(el).attr('href');
         const text = $(el).text().toLowerCase();
         // If it's a direct link to the card pop page
         if (href && href.includes('/pop/') && text.includes(card.number.toLowerCase())) {
            popUrl = href.startsWith('http') ? href : `https://www.psacard.com${href}`;
         }
      });
      
      if (!popUrl) {
         console.log(`  ✗ Could not find direct pop report link in search results. Skipping.`);
         tracker[card.id] = new Date().toISOString();
         fs.writeFileSync(trackerPath, JSON.stringify(tracker, null, 2));
         await page.close();
         continue;
      }
      
      console.log(`  -> Navigating to exact Pop Report: ${popUrl}`);
      await page.goto(popUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await new Promise(r => setTimeout(r, 3000));
      
      const popHtml = await page.content();
      const $pop = cheerio.load(popHtml);
      
      // We will parse the pop numbers from the table
      // Standard PSA pop tables have grades in columns
      
      let totalPop = 0;
      const gradeCounts: Record<string, number> = {};
      
      // This is a simplified extraction. We look for rows that match our card number
      $pop('tr').each((_, tr) => {
         const text = $pop(tr).text().toLowerCase();
         if (text.includes(card.number.toLowerCase()) || text.includes(card.name.toLowerCase())) {
            // Find the cells containing pop numbers. 
            // In PSA tables, usually the grades 1-10 are in the last columns
            // For a robust implementation, we would map the table headers.
            // But let's mock the extraction for the skeleton:
            
            // Just an example mapping (real PSA tables have 1, 1.5, 2, ... 10)
            const cells = $pop(tr).find('td');
            if (cells.length > 10) {
               gradeCounts['10'] = parseInt($pop(cells[cells.length - 2]).text().trim() || '0');
               gradeCounts['9'] = parseInt($pop(cells[cells.length - 3]).text().trim() || '0');
               gradeCounts['8'] = parseInt($pop(cells[cells.length - 4]).text().trim() || '0');
            }
         }
      });
      
      // If we found any data, insert it
      if (Object.keys(gradeCounts).length > 0) {
         for (const [grade, count] of Object.entries(gradeCounts)) {
             if (count > 0) {
                 totalPop += count;
                 await supabase.from('population_reports').upsert({
                     card_id: card.id,
                     grading_company_id: PSA_COMPANY_ID,
                     grade: grade,
                     population_count: count,
                     updated_at: new Date().toISOString()
                 }, { onConflict: 'card_id,grading_company_id,grade' });
             }
         }
         console.log(`  ✓ Inserted PSA population data (Total Pop: ${totalPop})`);
      } else {
         console.log(`  ✗ No matching population rows found in the table.`);
      }

      tracker[card.id] = new Date().toISOString();
      fs.writeFileSync(trackerPath, JSON.stringify(tracker, null, 2));
      
      await page.close();

    } catch (err: any) {
      console.log(`  ! Error scraping PSA: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, SLEEP_MS));
  }
}

run();
