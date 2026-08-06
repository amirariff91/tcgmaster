import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SECRET_KEY as string);

const COMPANY_UUIDS_TO_SLUG: Record<string, string> = {
  '74c51627-cc4b-4a82-a1c0-52b3975b47b7': 'psa',
  'cda2045f-5d78-49e7-b1c8-de04dac9888d': 'bgs',
  'dce6169f-8958-4229-861b-686a4644c984': 'cgc',
  '7a7b5849-788b-40f6-9f42-14f2f27f68b3': 'sgc',
  'da09e2df-2464-40f2-ae0e-0296253d811f': 'tag'
};

const SOURCE_KINDS: Record<string, string> = {
  tcgplayer: 'market',
  pricecharting: 'sold_guide',
  yuyutei: 'retail_sell',
  cardrush: 'lowest_listing',
  snkrdunk: 'marketplace_ask',
};

const SOURCE_CURRENCIES: Record<string, 'USD' | 'JPY'> = {
  tcgplayer: 'USD',
  pricecharting: 'USD',
  yuyutei: 'JPY',
  cardrush: 'JPY',
  snkrdunk: 'USD',
};

async function testLink(url: string, source: string): Promise<boolean> {
  if (!url) return false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      method: 'GET',
      headers: source === 'pricecharting' ? undefined : { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return res.status === 200 || res.status === 403;
  } catch (e) {
    return false;
  }
}

async function buildCurrentProjection(cardId: string) {
  const { data: history } = await supabase.from('price_history').select('*').eq('card_id', cardId).order('recorded_at', { ascending: false });
  if (!history || history.length === 0) return null;

  const sourcePrices: Record<string, {
    usd: number;
    native: number | null;
    currency: 'USD' | 'JPY';
    kind: string;
    recorded_at: string;
  }> = {};
  const gradedSources: Record<string, Record<string, number>> = {};

  for (const h of history) {
    const source = String(h.source);
    if (h.grade === 'raw') {
      if (!sourcePrices[source]) {
        sourcePrices[source] = {
          usd: Number(h.price),
          native: h.price_native == null ? null : Number(h.price_native),
          currency: h.currency === 'JPY' ? 'JPY' : (SOURCE_CURRENCIES[source] ?? 'USD'),
          kind: String(h.price_kind ?? SOURCE_KINDS[source] ?? 'market'),
          recorded_at: String(h.recorded_at ?? new Date().toISOString()),
        };
      }
    } else {
      const companySlug = COMPANY_UUIDS_TO_SLUG[h.grading_company_id] || h.grading_company_id || 'psa';
      const key = `${companySlug}-${h.grade}`;
      if (!gradedSources[key]) gradedSources[key] = {};
      if (gradedSources[key][source] === undefined) {
        gradedSources[key][source] = Number(h.price);
      }
    }
  }

  const gradedPrices = Object.fromEntries(
    Object.entries(gradedSources).map(([grade, sources]) => {
      const values = Object.values(sources);
      return [grade, {
        average: values.reduce((sum, value) => sum + value, 0) / values.length,
        sources,
      }];
    }),
  );

  const kindPriority = ['market', 'retail_sell', 'sold_guide', 'lowest_listing'];
  let headline: { source: string; price: (typeof sourcePrices)[string] } | null = null;
  for (const kind of kindPriority) {
    const candidates = Object.entries(sourcePrices)
      .filter(([, price]) => price.kind === kind)
      .sort(([, left], [, right]) => left.usd - right.usd);
    if (candidates.length > 0) {
      headline = { source: candidates[0][0], price: candidates[0][1] };
      break;
    }
  }

  return { source_prices: sourcePrices, graded_prices: gradedPrices, headline };
}

async function run() {
  console.log('🌟 Starting Data Curation & Integrity Pipeline 🌟');

  while (true) {
    try {
      const { data: cards, error } = await supabase
        .from('cards')
        .select('id, slug, name, snkrdunk_url, pricecharting_url, curation_status')
        .like('slug', 'op-%-ja')
        .eq('historical_fetched', true)
        .eq('curation_status', 'pending')
        .limit(20);

      if (error) {
        console.error('Error fetching cards:', error);
        await new Promise(r => setTimeout(r, 60000));
        continue;
      }

      if (!cards || cards.length === 0) {
        console.log('No cards to curate right now. Sleeping for 5 minutes...');
        await new Promise(r => setTimeout(r, 300000));
        continue;
      }

      let successCount = 0;
      for (const card of cards) {
        console.log(`\nCurating ${card.slug} (${card.name})...`);

        let snkrValid = true;
        let pcValid = true;
        if (card.snkrdunk_url) {
          snkrValid = await testLink(card.snkrdunk_url, 'snkrdunk');
          if (!snkrValid) console.log(`  ❌ Snkrdunk URL failed validation!`);
        }
        if (card.pricecharting_url) {
          pcValid = await testLink(card.pricecharting_url, 'pricecharting');
          if (!pcValid) console.log(`  ❌ PriceCharting URL failed validation!`);
        }

        if (!snkrValid || !pcValid) {
          // Mark as failed or skip so it doesn't get stuck in a loop forever
          await supabase.from('cards').update({ curation_status: 'failed' }).eq('id', card.id);
          continue;
        }

        console.log(`  ✓ Rebuilding current price projection from history...`);
        const projection = await buildCurrentProjection(card.id);
        if (!projection) {
          console.log(`  ❌ No price history found to build projection!`);
          await supabase.from('cards').update({ curation_status: 'failed' }).eq('id', card.id);
          continue;
        }

        const rawSourcesCount = Object.keys(projection.source_prices).length;
        const hasGraded = Object.keys(projection.graded_prices).length > 0;

        if (rawSourcesCount < 2) {
          console.log(`  ❌ Failed Strict Gate: Only ${rawSourcesCount} raw source(s) found. Need 2+`);
          await supabase.from('cards').update({ curation_status: 'failed' }).eq('id', card.id);
          continue;
        }

        if (!hasGraded) {
          console.log(`  ❌ Failed Strict Gate: No graded data found.`);
          await supabase.from('cards').update({ curation_status: 'failed' }).eq('id', card.id);
          continue;
        }

        const current = projection.headline;
        await supabase.from('card_price_current').upsert({
          card_id: card.id,
          source_prices: projection.source_prices,
          graded_prices: projection.graded_prices,
          headline_cents: current ? Math.round(current.price.usd * 100) : null,
          headline_source: current?.source ?? null,
          headline_kind: current?.price.kind ?? null,
          headline_currency: current?.price.currency ?? null,
          headline_grade: current ? 'raw' : null,
          computed_at: new Date().toISOString(),
        }, { onConflict: 'card_id' });

        await supabase.from('cards').update({ curation_status: 'curated' }).eq('id', card.id);
        console.log(`  🌟 Successfully Curated ${card.slug}!`);
        successCount++;

        // Sleep a tiny bit to not hammer Supabase or Cloudflare
        await new Promise(r => setTimeout(r, 2000));
      }

      console.log(`\nBatch finished. Successfully curated ${successCount} cards.`);
    } catch (e) {
      console.error('Fatal error in pipeline loop:', e);
      await new Promise(r => setTimeout(r, 60000));
    }
  }
}

run();
