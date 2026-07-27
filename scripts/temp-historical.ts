import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { getSharedBrowser } from './lib/price-engine/browser.ts';

require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

const COMPANY_UUIDS = {
  psa: '74c51627-cc4b-4a82-a1c0-52b3975b47b7',
  bgs: 'cda2045f-5d78-49e7-b1c8-de04dac9888d',
  cgc: 'dce6169f-8958-4229-861b-686a4644c984',
  sgc: '7a7b5849-788b-40f6-9f42-14f2f27f68b3'
};

async function run() {
  const { data: card } = await supabase.from('cards').select('*').eq('slug', 'op-p-065-ja').single();
  if (!card) return console.log('Card not found');
  
  if (card.pricecharting_url) {
     const browser = await getSharedBrowser();
     const page = await browser.newPage();
     try {
       await page.goto(card.pricecharting_url, { waitUntil: 'domcontentloaded' });
       const html = await page.content();
       const $ = cheerio.load(html);
       const table = $('#full-history');
       const rows = table.find('tbody tr');
       const insertRows = [];
       rows.each((i, el) => {
          const date = $(el).find('td').eq(0).text().trim();
          const priceText = $(el).find('td').eq(1).text().trim();
          const gradeText = $(el).find('td').eq(2).text().trim();
          if (!date || !priceText || priceText === '---') return;
          const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
          let finalCompany = null;
          let finalGrade = gradeText.toLowerCase();
          if (finalGrade.startsWith('psa')) { finalCompany = COMPANY_UUIDS.psa; finalGrade = finalGrade.replace('psa', '').trim(); }
          else if (finalGrade.startsWith('bgs')) { finalCompany = COMPANY_UUIDS.bgs; finalGrade = finalGrade.replace('bgs', '').trim(); }
          
          insertRows.push({
             card_id: card.id,
             source: 'pricecharting',
             grade: finalGrade || 'raw',
             grading_company_id: finalCompany,
             price: price,
             recorded_at: new Date(date).toISOString()
          });
       });
       
       if (insertRows.length > 0) {
          await supabase.from('price_history').upsert(insertRows, { onConflict: 'card_id,recorded_at,source', ignoreDuplicates: true });
          console.log(`Saved ${insertRows.length} PriceCharting points for Chopper!`);
       }
     } catch (e) {
       console.error(e);
     } finally {
       await page.close();
     }
  }
}
run().then(() => process.exit(0));
