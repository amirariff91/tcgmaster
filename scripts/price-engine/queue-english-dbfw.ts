import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { fetchEnglishPrice } from '../../lib/price-engine/tcgcsv';
import { fetchPriceChartingPrice } from '../../lib/price-engine/pricecharting';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const SAFE_MODE = process.env.SAFE_MODE === '1';
const SLEEP_MS = SAFE_MODE ? 25000 : 10000;
const DBFW_CATEGORY_ID = 80;

async function run() {
  console.log(`🤖 Starting Resilient Scrape Engine (English DBFW) [SAFE_MODE=${SAFE_MODE}]...`);

  while (true) {
    try {
      // English DBFW cards start with 'dbfw-' and do NOT end with '-ja'
      const { data: cards, error } = await supabase
        .from('cards')
        .select('id, name, slug, number, tcg_player_id, pricecharting_url, print_run_info, sets ( name )')
        .like('slug', 'dbfw-%')
        .not('slug', 'like', '%-ja')
        .order('last_price_fetch', { ascending: true, nullsFirst: true })
        .limit(1);

      if (error || !cards || cards.length === 0) {
        console.error("Failed to fetch English DBFW queue", error);
        await new Promise(r => setTimeout(r, SLEEP_MS));
        continue;
      }

      const card = cards[0];
      console.log(`[English DBFW] Processing: ${card.name} (${card.number})`);

      const results: { price: number; source: string; grade: string }[] = [];
      const updatePayload: any = {};

      // 1. TCGPlayer (Fast API)
      try {
        console.log(`[English DBFW] Fetching TCGPlayer for ${card.number}...`);
        const tcgPlayerResult = await fetchEnglishPrice(card.number, (card as any).sets?.name, card.tcg_player_id, DBFW_CATEGORY_ID);
        if (tcgPlayerResult !== null) {
          results.push({ price: tcgPlayerResult.price, source: 'tcgplayer', grade: 'raw' });
          console.log(`  ✓ TCGPlayer: $${tcgPlayerResult.price}`);
        }
      } catch (tcgErr: any) {
        console.warn(`  ! TCGPlayer fetch skipped for ${card.number}:`, tcgErr.message);
      }

      // 2. PriceCharting (Graceful Fallback)
      try {
        console.log(`[English DBFW] Fetching PriceCharting for ${card.number}...`);
        const pcQueryOrUrl = card.pricecharting_url || `${card.name} ${card.number} Dragon Ball`;
        const pcResult = await fetchPriceChartingPrice(pcQueryOrUrl);
        if (pcResult !== null) {
          results.push({ price: pcResult.price, source: 'pricecharting', grade: 'raw' });
          console.log(`  ✓ PriceCharting: $${pcResult.price}`);
          if (pcResult.gradedPrice) {
            results.push({ price: pcResult.gradedPrice, source: 'pricecharting', grade: 'psa10' });
            console.log(`  ✓ PriceCharting PSA 10: $${pcResult.gradedPrice}`);
          }
          if (pcResult.url && pcResult.url !== card.pricecharting_url) {
            updatePayload.pricecharting_url = pcResult.url;
          }
        }
      } catch (pcErr: any) {
        console.warn(`  ! PriceCharting fetch skipped for ${card.number}:`, pcErr.message);
      }

      // 3. Database Update
      const updatePayload: any = {
        last_price_fetch: new Date().toISOString(),
      };

      if (results.length > 0) {
        const rawPrices = results.filter(r => r.grade === 'raw').map(r => r.price);
        if (rawPrices.length > 0) {
          const lowestPrice = Math.min(...rawPrices);
          updatePayload.price_cache_ttl = Math.round(lowestPrice * 100);
        }

        // Cache update
        const cacheRawPrices: Record<string, number> = {};
        const cacheGradedPrices: Record<string, Record<string, number>> = {};

        for (const res of results) {
          if (res.grade === 'raw') {
            cacheRawPrices[res.source] = res.price;
          } else {
            if (!cacheGradedPrices[res.grade]) cacheGradedPrices[res.grade] = {};
            cacheGradedPrices[res.grade][res.source] = res.price;
          }
        }

        await supabase.from('price_cache').upsert({
          card_id: card.id,
          raw_prices: cacheRawPrices,
          graded_prices: cacheGradedPrices,
          source: 'aggregator',
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        }, { onConflict: 'card_id' });

        for (const result of results) {
          let finalGrade = result.grade;
          let finalCompany = null;
          if (finalGrade.startsWith('psa')) {
            finalCompany = '74c51627-cc4b-4a82-a1c0-52b3975b47b7';
            finalGrade = finalGrade.replace('psa', '');
          } else if (finalGrade.startsWith('bgs')) {
            finalCompany = 'cda2045f-5d78-49e7-b1c8-de04dac9888d';
            finalGrade = finalGrade.replace('bgs', '');
          }
          
          const { error: insertError } = await supabase
            .from('price_history')
            .insert({
              card_id: card.id,
              price: result.price,
              source: result.source,
              grade: finalGrade,
              grading_company_id: finalCompany
            });
          if (insertError) {
            console.error(`[English DBFW] Failed to insert ${result.source} ${result.grade} price for ${card.number}:`, insertError);
          }
        }

        console.log(`[English DBFW] Saved ${results.length} price points for ${card.slug}.`);
      } else {
        console.log(`[English DBFW] No new price points found for ${card.slug}. Updated timestamp.`);
      }

      await supabase.from('cards').update(updatePayload).eq('id', card.id);
      await new Promise(r => setTimeout(r, SLEEP_MS));
    } catch (loopErr: any) {
      console.error("[English DBFW] Worker loop error:", loopErr.message);
      await new Promise(r => setTimeout(r, SLEEP_MS));
    }
  }
}

run().catch(err => {
  console.error("Fatal English DBFW scraper error:", err);
  process.exit(1);
});
