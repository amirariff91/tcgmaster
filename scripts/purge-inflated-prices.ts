import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function purgeCorrupted() {
  console.log('🤖 Starting Surgical Purge of Inflated Snkrdunk Prices...');

  let processedCards = 0;
  let deletedRows = 0;
  let lastId = '00000000-0000-0000-0000-000000000000';
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: cards, error } = await supabase
      .from('cards')
      .select('id, slug, name')
      .like('slug', '%-ja')
      .order('id')
      .gt('id', lastId)
      .limit(pageSize);

    if (error || !cards || cards.length === 0) {
      hasMore = false;
      break;
    }

    lastId = cards[cards.length - 1].id;
    console.log(`Processing batch... Last ID: ${lastId} (Batch Size: ${cards.length})`);

    for (const card of cards) {
      processedCards++;

      // Fetch all Snkrdunk and Yuyutei prices for this card
      const { data: history } = await supabase
        .from('price_history')
        .select('id, source, price, grade')
        .eq('card_id', card.id)
        .in('source', ['snkrdunk', 'yuyutei']);

      if (!history || history.length === 0) continue;

      const yuyuteiHistory = history.filter(h => h.source === 'yuyutei' && h.grade === 'raw');
      const snkrdunkHistory = history.filter(h => h.source === 'snkrdunk');

      if (snkrdunkHistory.length === 0) continue;

      // Determine baseline accurate raw price from Yuyutei
      let baselineYuyuteiPrice: number | null = null;
      if (yuyuteiHistory.length > 0) {
        // Average the yuyutei prices
        const sum = yuyuteiHistory.reduce((acc, h) => acc + h.price, 0);
        baselineYuyuteiPrice = sum / yuyuteiHistory.length;
      }

      for (const snkr of snkrdunkHistory) {
        let shouldDelete = false;
        let reason = '';

        // Rule 1: Delete any Snkrdunk price > 1500 USD (almost guaranteed to be raw JPY or troll listing)
        // Exception: Serial Shanks is truly around $2000-$3000 USD (but it was corrupted to 41882 JPY).
        // Since manga cards are ~$6000 USD on Yuyutei, we ONLY delete Snkrdunk if it's over $1500 AND there's no matching Yuyutei price confirming it's a high-tier card.
        if (snkr.price > 1500) {
          if (!baselineYuyuteiPrice || baselineYuyuteiPrice < 500) {
            shouldDelete = true;
            reason = 'Massively Inflated Outlier (> $1500)';
          }
        }

        // Rule 2: If Yuyutei price exists, compare Snkrdunk raw price to Yuyutei raw price.
        // If Snkrdunk is drastically higher (e.g. 5x higher) and over $20, it's a mismatched variant (e.g. Manga variant).
        if (!shouldDelete && baselineYuyuteiPrice !== null && snkr.grade === 'raw') {
          if (snkr.price > baselineYuyuteiPrice * 5 && snkr.price > 20) {
            shouldDelete = true;
            reason = `Mismatch/Troll (Snkrdunk: $${snkr.price} vs Yuyutei: $${baselineYuyuteiPrice.toFixed(2)})`;
          }
        }

        // Rule 3: For graded Snkrdunk prices (PSA 10), they shouldn't be astronomically higher than Yuyutei raw.
        // (e.g. Manga Sogeking PSA10 $8123 vs Yuyutei Raw $1.40)
        if (!shouldDelete && baselineYuyuteiPrice !== null && snkr.grade !== 'raw') {
          if (snkr.price > baselineYuyuteiPrice * 20 && snkr.price > 50) {
            shouldDelete = true;
            reason = `Absurdly Inflated Graded (Snkrdunk ${snkr.grade}: $${snkr.price} vs Yuyutei Raw: $${baselineYuyuteiPrice.toFixed(2)})`;
          }
        }

        if (shouldDelete) {
          console.log(`[PURGE] ${card.slug} (${card.name}): Deleting Snkrdunk $${snkr.price} (${snkr.grade}) - Reason: ${reason}`);
          await supabase.from('price_history').delete().eq('id', snkr.id);
          deletedRows++;
        }
      }
    }
  }

  console.log(`✅ Surgical Purge Complete! Processed ${processedCards} Japanese cards, DELETED ${deletedRows} corrupted Snkrdunk entries.`);
}

purgeCorrupted().catch(console.error);
