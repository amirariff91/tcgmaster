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
const CGC_COMPANY_ID = 'dce6169f-8958-4229-861b-686a4644c984';

async function run() {
  console.log(`Starting CGC Population Scraper Worker...`);
  
  const trackerPath = path.join(__dirname, '..', '..', 'population-tracker-cgc.json');
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
        .limit(1000); 
         
      if (!error && data) {
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
      await new Promise(r => setTimeout(r, SLEEP_MS));
      continue;
    }

    const card = cards[0];
    const setName = card.sets?.name || '';
    
    console.log(`\nIngesting Population for ${card.slug}...`);

    try {
      const browser = await getSharedBrowser();
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      
      console.log(`  -> Loading CGC Pop Report search...`);
      // Use the CGC TCG search page
      await page.goto('https://www.cgccards.com/population-report/tcg/', { waitUntil: 'domcontentloaded', timeout: 45000 });
      
      await new Promise(r => setTimeout(r, 3000));
      
      // Perform a search on CGC
      // Assuming a generic search input box
      const searchBox = await page.$('input[type="text"], input[name="search"]');
      if (searchBox) {
         console.log(`  -> Submitting search query...`);
         await searchBox.type(`${card.name} ${card.number}`);
         await Promise.all([
            page.keyboard.press('Enter'),
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
         ]);
      }
      
      await new Promise(r => setTimeout(r, 5000));
      
      const html = await page.content();
      const $ = cheerio.load(html);
      
      let popUrl = null;
      $('a').each((_, el) => {
         const href = $(el).attr('href');
         const text = $(el).text().toLowerCase();
         if (href && href.includes('/population-report/tcg/') && text.includes(card.number.toLowerCase())) {
            popUrl = href.startsWith('http') ? href : `https://www.cgccards.com${href}`;
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
      
      let totalPop = 0;
      const gradeCounts: Record<string, number> = {};
      
      $pop('tr').each((_, tr) => {
         const text = $pop(tr).text().toLowerCase();
         if (text.includes(card.number.toLowerCase()) || text.includes(card.name.toLowerCase())) {
            const cells = $pop(tr).find('td');
            // CGC grades include 9.5 and 10 Pristine
            if (cells.length > 5) {
               gradeCounts['Pristine 10'] = parseInt($pop(cells[cells.length - 1]).text().trim() || '0');
               gradeCounts['10'] = parseInt($pop(cells[cells.length - 2]).text().trim() || '0');
               gradeCounts['9.5'] = parseInt($pop(cells[cells.length - 3]).text().trim() || '0');
               gradeCounts['9'] = parseInt($pop(cells[cells.length - 4]).text().trim() || '0');
               gradeCounts['8.5'] = parseInt($pop(cells[cells.length - 5]).text().trim() || '0');
               gradeCounts['8'] = parseInt($pop(cells[cells.length - 6]).text().trim() || '0');
            }
         }
      });
      
      if (Object.keys(gradeCounts).length > 0) {
         for (const [grade, count] of Object.entries(gradeCounts)) {
             if (count > 0) {
                 totalPop += count;
                 await supabase.from('population_reports').upsert({
                     card_id: card.id,
                     grading_company_id: CGC_COMPANY_ID,
                     grade: grade,
                     population_count: count,
                     updated_at: new Date().toISOString()
                 }, { onConflict: 'card_id,grading_company_id,grade' });
             }
         }
         console.log(`  ✓ Inserted CGC population data (Total Pop: ${totalPop})`);
      } else {
         console.log(`  ✗ No matching population rows found in the table.`);
      }

      tracker[card.id] = new Date().toISOString();
      fs.writeFileSync(trackerPath, JSON.stringify(tracker, null, 2));
      
      await page.close();

    } catch (err: any) {
      console.log(`  ! Error scraping CGC: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, SLEEP_MS));
  }
}

run();
