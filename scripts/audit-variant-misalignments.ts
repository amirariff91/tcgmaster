import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

const Crockford32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function decodeUlidTime(ulid: string): Date {
  if (!ulid || ulid.length < 10) return new Date();
  const timePart = ulid.substring(0, 10).toUpperCase();
  let time = 0;
  for (let i = 0; i < timePart.length; i++) {
    const index = Crockford32.indexOf(timePart[i]);
    if (index !== -1) {
      time = time * 32 + index;
    }
  }
  return new Date(time);
}

const REPORTED_CARD_FIXES = [
  {
    slug: 'op-st01-007_p1-ja',
    snkrdunkUrl: 'https://snkrdunk.com/en/trading-cards/477011',
    snkrdunkId: '477011',
  },
  {
    slug: 'op-st04-003_p1-ja',
    snkrdunkUrl: 'https://snkrdunk.com/en/trading-cards/112985',
    snkrdunkId: '112985',
  },
  {
    slug: 'op-st01-012_p6-ja',
    snkrdunkUrl: 'https://snkrdunk.com/en/trading-cards/112982',
    snkrdunkId: '112982',
  },
  {
    slug: 'op-op07-051_p5-ja',
    snkrdunkUrl: 'https://snkrdunk.com/en/trading-cards/562155',
    snkrdunkId: '562155',
  },
];

async function fixReportedCardUrls() {
  console.log('\n🔧 Step 1: Fixing reported card Snkrdunk URLs & fetching historical trades...');

  for (const item of REPORTED_CARD_FIXES) {
    const { data: card } = await supabase
      .from('cards')
      .select('id, slug, name')
      .eq('slug', item.slug)
      .single();

    if (!card) {
      console.log(`  ! Card ${item.slug} not found in DB`);
      continue;
    }

    console.log(`Updating ${item.slug} snkrdunk_url -> ${item.snkrdunkUrl}`);
    await supabase
      .from('cards')
      .update({
        snkrdunk_url: item.snkrdunkUrl,
        historical_fetched: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', card.id);

    // Backfill historical sales directly
    console.log(`  -> Backfilling sales for product SW---${item.snkrdunkId}...`);
    const productCode = `SW---${item.snkrdunkId}`;
    let page = 1;
    let saved = 0;

    while (page <= 5) {
      try {
        const url = `https://snkrdunk.com/en/v1/products/${productCode}/used-listings?perPage=100&page=${page}&sortType=latest&isOnlyOnSale=false`;
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) break;

        const data = await res.json();
        const listings = data.usedListings || [];
        if (listings.length === 0) break;

        const soldListings = listings.filter((l: any) => l.isSold && l.priceAmount > 0);
        const insertRows = soldListings.map((l: any) => ({
          card_id: card.id,
          source: 'snkrdunk',
          price: l.priceAmount,
          raw_price: l.priceAmount,
          currency: l.currency || 'USD',
          condition: l.condition || 'A',
          recorded_at: decodeUlidTime(l.listingUID).toISOString(),
        }));

        if (insertRows.length > 0) {
          const { error } = await supabase
            .from('price_history')
            .upsert(insertRows, { onConflict: 'card_id,recorded_at,source', ignoreDuplicates: true });

          if (error) {
            for (const r of insertRows) {
              await supabase.from('price_history').insert(r).catch(() => {});
            }
          }
          saved += insertRows.length;
        }

        page++;
        await new Promise(r => setTimeout(r, 500));
      } catch {
        break;
      }
    }

    // Refresh price_cache for card
    const { data: latestPrices } = await supabase
      .from('price_history')
      .select('price, grade, source')
      .eq('card_id', card.id)
      .order('recorded_at', { ascending: false })
      .limit(20);

    let rawPrice = 0;
    let psa10Price = 0;

    if (latestPrices) {
      const rawRow = latestPrices.find(p => p.grade === 'raw');
      const psa10Row = latestPrices.find(p => p.grade === 'psa10');
      if (rawRow) rawPrice = rawRow.price;
      if (psa10Row) psa10Price = psa10Row.price;
    }

    if (rawPrice > 0) {
      await supabase
        .from('price_cache')
        .upsert({
          card_id: card.id,
          raw_prices: { market: rawPrice, snkrdunk: rawPrice },
          graded_prices: psa10Price > 0 ? { psa10: { average: psa10Price } } : {},
          source: 'snkrdunk',
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        }, { onConflict: 'card_id' });
    }

    console.log(`  ✓ Updated ${item.slug}! Saved ${saved} sales records. Cache raw=${rawPrice}, psa10=${psa10Price}`);
  }
}

async function auditVendorPriceDivergence() {
  console.log('\n🔍 Step 2: Auditing Japanese One Piece vendor price divergence...');

  const { data: cacheEntries } = await supabase
    .from('price_cache')
    .select('card_id, raw_prices, cards(slug, name)')
    .limit(1000);

  if (!cacheEntries) return;

  const misaligned: any[] = [];

  for (const entry of cacheEntries) {
    const raw = entry.raw_prices as any;
    if (!raw) continue;

    const yuyutei = raw.yuyutei as number;
    const snkrdunk = raw.snkrdunk as number;

    if (yuyutei > 0 && snkrdunk > 0) {
      const ratio = Math.max(yuyutei, snkrdunk) / Math.min(yuyutei, snkrdunk);
      if (ratio > 3.0) {
        const cardName = (entry.cards as any)?.name || 'Unknown';
        const cardSlug = (entry.cards as any)?.slug || entry.card_id;
        misaligned.push({ cardSlug, cardName, yuyutei, snkrdunk, ratio: ratio.toFixed(2) });
      }
    }
  }

  console.log(`Found ${misaligned.length} Japanese cards with >3x vendor price divergence:`);
  misaligned.forEach(m => console.log(`  - ${m.cardSlug} (${m.cardName}): Yuyutei $${m.yuyutei} vs Snkrdunk $${m.snkrdunk} (Ratio ${m.ratio}x)`));
}

async function run() {
  await fixReportedCardUrls();
  await auditVendorPriceDivergence();
  console.log('\n✅ Audit & URL Re-alignment complete!');
}

run().catch(err => {
  console.error('Audit script error:', err);
  process.exit(1);
});
