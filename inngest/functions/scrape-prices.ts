import { inngest } from '../client';
import { fetchEnglishPrice } from '../../lib/price-engine/tcgcsv';
import { fetchJapanesePrice } from '../../lib/price-engine/yuyutei';
import { fetchCardrushPrice } from '../../lib/price-engine/cardrush';

/**
 * Continuous 24/7 Zero-Cost Scraper (Vercel + Inngest).
 * Runs every minute to fetch the oldest 10 cards and updates their raw prices
 * using the lightweight exact-match scrapers (no Puppeteer).
 */
export const scrapePricesJob = inngest.createFunction(
  { id: 'scrape-card-prices-247', name: '24/7 Scrape Card Prices (Lightweight)' },
  { cron: '* * * * *' }, // Runs every minute
  async ({ step, logger }) => {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch 10 oldest cards
    const { data: cards } = await step.run('fetch-queue', async () => {
      const { data, error } = await supabase
        .from('cards')
        .select('id, name, slug, number, language, tcg_player_id, yuyutei_url, cardrush_url')
        .order('last_price_fetch', { ascending: true, nullsFirst: true })
        .limit(10);
      
      if (error) throw error;
      return { data, error: null };
    });

    if (!cards || cards.length === 0) {
      logger.info('No cards found in queue.');
      return { status: 'completed', scraped: 0 };
    }

    logger.info(`Processing ${cards.length} cards...`);
    let scrapedCount = 0;

    // 2. Iterate through queue
    for (const card of cards) {
      await step.run(`process-card-${card.id}`, async () => {
        const results: { price: number; source: string; grade: string }[] = [];
        const updatePayload: any = {};

        if (card.language === 'en') {
          // English: TCGPlayer via TCGCSV
          logger.info(`[EN] TCGPlayer for ${card.name} (${card.number})`);
          const categoryId = card.slug.startsWith('dbfw-') ? 80 : 68;
          const tcgResult = await fetchEnglishPrice(card.slug, undefined, card.tcg_player_id ? String(card.tcg_player_id) : undefined, categoryId);
          
          if (tcgResult !== null) {
            results.push({ price: tcgResult.price, source: 'tcgplayer', grade: 'raw' });
            if (tcgResult.tcgProductId && String(tcgResult.tcgProductId) !== String(card.tcg_player_id)) {
              updatePayload.tcg_player_id = tcgResult.tcgProductId;
            }
          }
        } else if (card.language === 'ja') {
          // Japanese: Yuyutei & Cardrush
          logger.info(`[JA] Yuyutei & Cardrush for ${card.name} (${card.number})`);
          
          const yuyuteiResult = await fetchJapanesePrice(card.yuyutei_url || card.number);
          if (yuyuteiResult !== null) {
            results.push({ price: yuyuteiResult.price, source: 'yuyutei', grade: 'raw' });
            if (yuyuteiResult.url && yuyuteiResult.url !== card.yuyutei_url) {
              updatePayload.yuyutei_url = yuyuteiResult.url;
            }
          }

          const cardrushResult = await fetchCardrushPrice(card.cardrush_url || card.number);
          if (cardrushResult !== null) {
            results.push({ price: cardrushResult.price, source: 'cardrush', grade: 'raw' });
            if (cardrushResult.url && cardrushResult.url !== card.cardrush_url) {
              updatePayload.cardrush_url = cardrushResult.url;
            }
          }
        }

        // Save Results
        if (results.length > 0) {
          const rawPrices = results.filter(r => r.grade === 'raw').map(r => r.price);
          if (rawPrices.length > 0) {
            updatePayload.price_cache_ttl = Math.round(Math.min(...rawPrices) * 100);
          }
          
          updatePayload.last_price_fetch = new Date().toISOString();
          
          await supabase.from('cards').update(updatePayload).eq('id', card.id);

          for (const res of results) {
            await supabase.from('price_history').insert({
              card_id: card.id,
              price: res.price,
              source: res.source,
              grade: res.grade
            });
            scrapedCount++;
          }
        } else {
          // No prices found, just bump timestamp
          await supabase.from('cards').update({ last_price_fetch: new Date().toISOString() }).eq('id', card.id);
        }
      });
      
      // Slight delay between cards to stay under limits
      await step.sleep(`sleep-after-${card.id}`, '1s');
    }

    return { status: 'completed', scraped: scrapedCount };
  }
);
