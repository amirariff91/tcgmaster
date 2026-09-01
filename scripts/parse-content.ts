import * as fs from 'fs';
import * as cheerio from 'cheerio';
import { dbQuery } from '../lib/db/client';

function parsePrice(text: string): number | undefined {
  if (!text) return undefined;
  const match = text.match(/([0-9.,]+)/);
  if (match) {
    const p = parseFloat(match[1].replace(/,/g, ''));
    if (!isNaN(p) && p > 0) return p;
  }
  return undefined;
}

async function main() {
  const html = fs.readFileSync('/Users/ioi/.gemini/antigravity-ide/brain/01a7487c-ad14-4ecb-b2bc-1436baa740e6/.system_generated/steps/5035/content.md', 'utf-8');
  
  // Extract just the HTML part
  const htmlStart = html.indexOf('<!DOCTYPE html>');
  const htmlContent = htmlStart >= 0 ? html.substring(htmlStart) : html;

  const $ = cheerio.load(htmlContent);
  
  const tables = $('table.hoverable-rows.sortable');
  console.log(`Found ${tables.length} hoverable-rows tables.`);

  const newHistory: any[] = [];
  
  $('table.hoverable-rows.sortable tbody tr').each((_, el) => {
    const dateText = $(el).find('td.date').text().trim();
    const priceText = $(el).find('td.numeric .js-price').text().trim();
    
    const price = parsePrice(priceText);
    
    if (price !== undefined && dateText) {
      const dateObj = new Date(dateText);
      if (!isNaN(dateObj.getTime())) {
        newHistory.push({ price, date: dateObj.toISOString() });
      }
    }
  });

  console.log(`Parsed ${newHistory.length} valid sales!`);

  if (newHistory.length > 0) {
    const cards = await dbQuery<any>("SELECT id FROM cards WHERE slug = 'op-op05-119_p2-ja'");
    const cardId = cards[0].id;

    let inserted = 0;
    for (const sale of newHistory) {
      try {
        await dbQuery(`
          INSERT INTO price_history (
            card_id, source, grade, price, currency, price_kind, recorded_at
          ) VALUES (
            $1, 'pricecharting', 'raw', $2, 'USD', 'sold_guide', $3
          )
          ON CONFLICT DO NOTHING
        `, [cardId, sale.price, sale.date]);
        inserted++;
      } catch (e) {
        // ignore
      }
    }
    console.log(`Inserted ${inserted} new sales!`);
    
    // update current price
    await dbQuery(`
      UPDATE card_price_current 
      SET computed_at = NOW() - INTERVAL '1 hour'
      WHERE card_id = $1
    `, [cardId]);
  }
}

main().catch(console.error);
