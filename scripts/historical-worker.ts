import { createClient } from '@supabase/supabase-js';
import { fetchPriceChartingPrice } from './price-engine/pricecharting';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

async function run() {
  console.log("Starting Historical Backfiller Worker...");
  
  // 1. Fetch cards that need historical data
  const { data: cards, error } = await supabase
    .from('cards')
    .select('*')
    .eq('historical_fetched', false)
    .order('id')
    .limit(10);
    
  if (error || !cards) {
    console.error("Error fetching cards:", error);
    return;
  }
  
  if (cards.length === 0) {
    console.log("All cards have historical data fetched!");
    return;
  }
  
  console.log(`Found ${cards.length} cards needing historical backfill.`);
  
  for (const card of cards) {
    console.log(`\nProcessing: ${card.name} (${card.slug})`);
    
    // TODO: Implement actual historical array fetching here.
    // For English: scrape PriceCharting chart JSON data.
    // For Japanese: intercept Snkrdunk GraphQL timeline data.
    
    let currentPrice = card.market_price || 0;
    let source = card.language === 'en' ? 'tcgplayer' : 'snkrdunk';
    
    if (card.language === 'en') {
      console.log(`Fetching PriceCharting data for ${card.slug}...`);
      const pcPrice = await fetchPriceChartingPrice(card.slug);
      if (pcPrice) {
        currentPrice = pcPrice;
        console.log(`Found real PriceCharting price: $${currentPrice}`);
      } else {
        console.log("Could not find on PriceCharting. Skipping...");
        continue;
      }
    }
    
    const historyToInsert = [{
      card_id: card.id,
      price: currentPrice,
      source: source,
      recorded_at: new Date().toISOString()
    }];
    
    // Insert historical data
    const { error: insertError } = await supabase
      .from('price_history')
      .insert(historyToInsert);
      
    if (insertError) {
      console.error("Failed to insert history:", insertError.message);
      continue;
    }
    
    // Mark as completed
    await supabase
      .from('cards')
      .update({ historical_fetched: true })
      .eq('id', card.id);
      
    console.log(`Successfully initialized history for ${card.slug}!`);
    
    // Sleep to respect rate limits
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log("Batch complete! Run again to process the next batch.");
}

run();
