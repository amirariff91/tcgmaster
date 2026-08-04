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
const TAG_COMPANY_ID = 'da09e2df-2464-40f2-ae0e-0296253d811f';

async function run() {
  console.log(`Starting TAG Population Scraper Worker...`);
  
  const trackerPath = path.join(__dirname, '..', '..', 'population-tracker-tag.json');
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
    
    console.log(`\nIngesting Population for ${card.slug}...`);

    try {
      const browser = await getSharedBrowser();
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      
      console.log(`  -> Loading TAG Pop Report search...`);
      await page.goto('https://my.taggrading.com/pop-report', { waitUntil: 'domcontentloaded', timeout: 45000 });
      
      await new Promise(r => setTimeout(r, 3000));
      
      // Perform a search on TAG
      const searchBox = await page.$('input[placeholder*="Search"], input[type="text"]');
      if (searchBox) {
         console.log(`  -> Submitting search query...`);
         await searchBox.type(`${card.name} ${card.number}`);
         await new Promise(r => setTimeout(r, 2000));
         await Promise.all([
            page.keyboard.press('Enter'),
            new Promise(r => setTimeout(r, 5000))
         ]);
      }
      
      const html = await page.content();
      const $ = cheerio.load(html);
      
      let popUrl = null;
      $('a').each((_, el) => {
         const href = $(el).attr('href');
         const text = $(el).text().toLowerCase();
         // Check if it links to a specific card's pop report
         if (href && href.includes('/pop-report/') && text.includes(card.name.toLowerCase())) {
            popUrl = href.startsWith('http') ? href : `https://my.taggrading.com${href}`;
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
      
      // TAG shows 1000-point scale grades usually (e.g. 10 Pristine, 10 Gem Mint, etc)
      $pop('.grade-row, tr').each((_, tr) => {
         const text = $pop(tr).text().toLowerCase();
         if (text.includes('10') || text.includes('9')) {
            // Very generic fallback parsing for demonstration since we don't have exact TAG HTML
            const cells = $pop(tr).find('td, div');
            if (cells.length > 2) {
               const gradeText = $pop(cells[0]).text().trim();
               const countText = $pop(cells[cells.length - 1]).text().replace(/\D/g, '');
               if (gradeText && countText) {
                  gradeCounts[gradeText] = parseInt(countText || '0');
               }
            }
         }
      });
      
      if (Object.keys(gradeCounts).length > 0) {
         for (const [grade, count] of Object.entries(gradeCounts)) {
             if (count > 0) {
                 totalPop += count;
                 await supabase.from('population_reports').upsert({
                     card_id: card.id,
                     grading_company_id: TAG_COMPANY_ID,
                     grade: grade,
                     population_count: count,
                     updated_at: new Date().toISOString()
                 }, { onConflict: 'card_id,grading_company_id,grade' });
             }
         }
         console.log(`  ✓ Inserted TAG population data (Total Pop: ${totalPop})`);
      } else {
         console.log(`  ✗ No matching population rows found in the table.`);
      }

      tracker[card.id] = new Date().toISOString();
      fs.writeFileSync(trackerPath, JSON.stringify(tracker, null, 2));
      
      await page.close();

    } catch (err: any) {
      console.log(`  ! Error scraping TAG: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, SLEEP_MS));
  }
}

run();
