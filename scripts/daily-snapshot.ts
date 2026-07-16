import { createClient } from '@supabase/supabase-js';
import { fetchEnglishPrice } from '../lib/price-engine/tcgcsv';
import { fetchSnkrdunkPrice } from '../lib/price-engine/snkrdunk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

async function run() {
  console.log("Starting Daily Market Snapshot Worker...");
  
  let hasMore = true;
  let page = 0;
  const pageSize = 500;
  let processedCount = 0;

  while (hasMore) {
    const { data: cards, error } = await supabase
      .from('cards')
      .select('id, slug, number, language, tcg_player_id, name, snkrdunk_url')
      .order('id')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error || !cards || cards.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`Processing page ${page + 1} (${cards.length} cards)...`);
    const historyInserts: any[] = [];
    const now = new Date().toISOString();

    for (const card of cards) {
      if (card.language === 'en') {
        // The underlying TCGCSV engine caches bulk requests in memory, 
        // so this is extremely fast and safe to call in a loop!
        const categoryId = card.slug.startsWith('dbfw-') ? 80 : 68;
        const result = await fetchEnglishPrice(card.slug, undefined, String(card.tcg_player_id), categoryId);
        if (result && result.price) {
          historyInserts.push({
            card_id: card.id,
            price: result.price,
            source: 'tcgplayer',
            grade: 'raw',
            recorded_at: now
          });
        }
      } else if (card.language === 'ja') {
        // Snkrdunk is slightly heavier (Puppeteer), so we add a delay
        const result = await fetchSnkrdunkPrice(card.snkrdunk_url || card.number);
        if (result) {
          if (result.price) {
            historyInserts.push({
              card_id: card.id,
              price: result.price,
              source: 'snkrdunk',
              grade: 'raw',
              recorded_at: now
            });
          }
          if (result.gradedPrice) {
            historyInserts.push({
              card_id: card.id,
              price: result.gradedPrice,
              source: 'snkrdunk',
              grade: 'psa10',
              recorded_at: now
            });
          }
        }
        await new Promise(r => setTimeout(r, 2000)); // Respect Snkrdunk rate limits
      }
    }

    if (historyInserts.length > 0) {
      const { error: insertError } = await supabase
        .from('price_history')
        .insert(historyInserts);
        
      if (insertError) {
        console.error("Failed to insert daily snapshot:", insertError.message);
      } else {
        console.log(`Successfully appended ${historyInserts.length} new data points to price_history!`);
      }
    }

    processedCount += cards.length;
    page++;
  }

  console.log(`Daily Snapshot Complete! Processed ${processedCount} cards.`);
}

run().catch(console.error);
