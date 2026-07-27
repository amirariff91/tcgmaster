import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { getSharedBrowser } from '../lib/price-engine/browser';

require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

const SLEEP_MS = 60000;

async function run() {
  console.log(`Starting Continuous Historical PriceCharting Worker [SLEEP=${SLEEP_MS}ms]...`);
  
  while (true) {
    let cards = [];
    try {
       const { data, error } = await supabase
         .from('cards')
         .select('id, name, slug, number, pricecharting_url, last_price_fetch')
         .not('pricecharting_url', 'is', null)
         .order('last_price_fetch', { ascending: true, nullsFirst: true })
         .limit(1);
         
       if (!error && data) cards = data;
    } catch (e) {}

    let pcQueryOrUrl = null;
    let cardId = null;
    let card = null;

    if (cards.length > 0) {
       card = cards[0];
       pcQueryOrUrl = card.pricecharting_url;
       cardId = card.id;
    } else {
       let overrides = {};
       try {
         overrides = require('../lib/price-engine/pricecharting-overrides.json');
       } catch(e) {}
       
       const slugs = Object.keys(overrides);
       if (slugs.length > 0) {
          const { data } = await supabase
            .from('cards')
            .select('id, name, slug, number, historical_fetched')
            .in('slug', slugs)
            .order('historical_fetched', { ascending: true, nullsFirst: true })
            .limit(1);
            
          if (data && data.length > 0) {
             card = data[0];
             pcQueryOrUrl = overrides[card.slug];
             cardId = card.id;
          }
       }
    }
    
    if (!pcQueryOrUrl || !cardId || !card) {
      console.log('No cards found with PriceCharting URL. Sleeping...');
      await new Promise(r => setTimeout(r, SLEEP_MS));
      continue;
    }

    console.log(`\nIngesting ${card.slug} (${card.name}) [PC URL: ${pcQueryOrUrl}]...`);

    let page;
    try {
      const browser = await getSharedBrowser();
      page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      
      console.log(`  -> Loading ${pcQueryOrUrl}...`);
      await page.goto(pcQueryOrUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      
      try {
         await page.waitForSelector('table.hoverable-striped', { timeout: 15000 });
      } catch (e) {
         console.log('  ! Timeout waiting for table (Cloudflare block?).');
      }

      const html = await page.content();
      const $ = cheerio.load(html);
      
      const tables = $('table.hoverable-striped');
      if (tables.length === 0) {
         console.log('  ✗ No sales tables found. Saving timestamp and moving on.');
      } else {
         const insertRows = [];

         tables.each((_, table) => {
            const tableId = $(table).attr('id') || '';
            let parsedGrade = 'raw';
            
            if (tableId.includes('grade10')) parsedGrade = '10';
            else if (tableId.includes('grade9')) parsedGrade = '9';
            else if (tableId.includes('grade8')) parsedGrade = '8';
            else if (tableId.includes('grade7')) parsedGrade = '7';
            else if (tableId.includes('new')) parsedGrade = 'new';
            
            $(table).find('tbody tr').each((_, row) => {
               const dateStr = $(row).find('.date').text().trim();
               const priceStr = $(row).find('.price').text().trim();
               
               if (!dateStr || !priceStr) return;
               
               const date = new Date(dateStr);
               if (isNaN(date.getTime())) return;
               
               const match = priceStr.match(/([0-9.,]+)/);
               if (!match) return;
               const price = parseFloat(match[1].replace(/,/g, ''));
               if (isNaN(price) || price <= 0) return;
               
               insertRows.push({
                 card_id: cardId,
                 source: 'pricecharting',
                 grade: parsedGrade,
                 grading_company_id: parsedGrade !== 'raw' && parsedGrade !== 'new' ? 'psa' : null,
                 price: price,
                 recorded_at: date.toISOString(),
               });
            });
         });
         
         if (insertRows.length > 0) {
            const { error: insertError } = await supabase.from('price_history').upsert(
              insertRows,
              { onConflict: 'card_id, source, grade, recorded_at', ignoreDuplicates: true }
            );
            if (insertError) {
               console.error('  ✗ Error inserting rows:', insertError.message);
            } else {
               console.log(`  ✓ Saved ${insertRows.length} historical PriceCharting trades.`);
            }
         }
      }
      await supabase.from('cards').update({ last_price_fetch: new Date().toISOString(), curation_status: 'pending' }).eq('id', cardId);
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`);
    } finally {
      if (page) await page.close().catch(() => {});
    }
    
    console.log(`Sleeping for ${SLEEP_MS / 1000}s to avoid bot detection... Zzz...\n`);
    await new Promise(r => setTimeout(r, SLEEP_MS));
  }
}

run();
