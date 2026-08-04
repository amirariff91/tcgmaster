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
const BGS_COMPANY_ID = 'cda2045f-5d78-49e7-b1c8-de04dac9888d';

async function run() {
  console.log(`Starting BGS Population Scraper Worker...`);
  
  const trackerPath = path.join(__dirname, '..', '..', 'population-tracker-bgs.json');
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
      
      console.log(`  -> Loading Beckett Pop Report search...`);
      await page.goto('https://www.beckett.com/grading/pop-report', { waitUntil: 'domcontentloaded', timeout: 45000 });
      
      await new Promise(r => setTimeout(r, 2000));
      
      // Try to fill out the form using Puppeteer page manipulation
      const formSelector = 'form[action*="launch_search"]';
      const isFormPresent = await page.$(formSelector);
      
      if (isFormPresent) {
         // Beckett has multiple inputs, we need to type into the global search bar
         console.log(`  -> Submitting search query...`);
         const searchBox = await page.$('input[name="q"]');
         if (searchBox) {
            await searchBox.type(`${card.name} ${card.number}`);
            await Promise.all([
               page.keyboard.press('Enter'),
               page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
            ]);
         }
      }
      
      await new Promise(r => setTimeout(r, 5000));
      
      const html = await page.content();
      const $ = cheerio.load(html);
      
      // BGS displays results in a table or list
      let popUrl = null;
      $('a').each((_, el) => {
         const href = $(el).attr('href');
         const text = $(el).text().toLowerCase();
         if (href && href.includes('/grading/pop-report/') && text.includes(card.number.toLowerCase())) {
            popUrl = href.startsWith('http') ? href : `https://www.beckett.com${href}`;
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
            // Beckett usually has 1, 1.5, ... 9, 9.5, 10
            if (cells.length > 5) {
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
                     grading_company_id: BGS_COMPANY_ID,
                     grade: grade,
                     population_count: count,
                     updated_at: new Date().toISOString()
                 }, { onConflict: 'card_id,grading_company_id,grade' });
             }
         }
         console.log(`  ✓ Inserted BGS population data (Total Pop: ${totalPop})`);
      } else {
         console.log(`  ✗ No matching population rows found in the table.`);
      }

      tracker[card.id] = new Date().toISOString();
      fs.writeFileSync(trackerPath, JSON.stringify(tracker, null, 2));
      
      await page.close();

    } catch (err: any) {
      console.log(`  ! Error scraping BGS: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, SLEEP_MS));
  }
}

run();
