import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

// Known verified Snkrdunk URLs for high-value variant cards
const KNOWN_VARIANTS: Record<string, string> = {
  'op-op07-109_p2-ja': 'https://snkrdunk.com/en/trading-cards/562164',
  'op-op08-106_p3-ja': 'https://snkrdunk.com/en/trading-cards/729311',
  'op-st01-001_p4-ja': 'https://snkrdunk.com/en/trading-cards/112984',
  'op-op08-106_p4-ja': 'https://snkrdunk.com/en/trading-cards/729311',
  'op-op05-119_p3-ja': 'https://snkrdunk.com/en/trading-cards/135441',
  'op-op09-118_p3-ja': 'https://snkrdunk.com/en/trading-cards/680118',
  'op-op12-020_p2-ja': 'https://snkrdunk.com/en/trading-cards/760220',
  'op-eb02-061_p3-ja': 'https://snkrdunk.com/en/trading-cards/503507',
  'op-op12-020_p4-ja': 'https://snkrdunk.com/en/trading-cards/760224',
  'op-op13-118_p4-ja': 'https://snkrdunk.com/en/trading-cards/810118',
};

async function searchSnkrdunkForCard(cardCode: string, name: string): Promise<string | null> {
  const cleanCode = cardCode.split('_')[0].trim().toUpperCase();
  const searchUrl = `https://snkrdunk.com/en/v1/brands/onepiece/streetwears?perPage=20&page=1&department=tradingCard&keyword=${encodeURIComponent(cleanCode)}`;

  try {
    const res = await fetch(searchUrl, { headers: HEADERS });
    if (!res.ok) return null;

    const data = await res.json();
    const items = data.streetwears || data.products || [];
    if (items.length === 0) return null;

    // Search for parallel / alt art match
    const isAltArt = name.toLowerCase().includes('alternate art') || name.toLowerCase().includes('manga') || name.toLowerCase().includes('special') || name.toLowerCase().includes('serialized');

    const match = items.find((it: any) => {
      const itName = (it.name || '').toLowerCase();
      if (isAltArt) {
        return itName.includes('parallel') || itName.includes('alternate art') || itName.includes('manga') || itName.includes('special') || itName.includes('wanted');
      }
      return itName.includes(cleanCode.toLowerCase());
    }) || items[0];

    if (match) {
      return `https://snkrdunk.com/en/trading-cards/${match.id}`;
    }
    return null;
  } catch {
    return null;
  }
}

async function run() {
  console.log('🤖 Step 1: Auto-linking missing Japanese Snkrdunk & Yuyutei URLs...');

  // 1. Assign known verified variants
  for (const [slug, url] of Object.entries(KNOWN_VARIANTS)) {
    const { data: card } = await supabase
      .from('cards')
      .select('id, slug')
      .eq('slug', slug)
      .single();

    if (card) {
      await supabase
        .from('cards')
        .update({ snkrdunk_url: url, historical_fetched: false, updated_at: new Date().toISOString() })
        .eq('id', card.id);
      console.log(`  ✓ Explicitly assigned ${slug} snkrdunk_url -> ${url}`);
    }
  }

  // 2. Query Japanese cards missing snkrdunk_url
  const { data: unlinkedCards } = await supabase
    .from('cards')
    .select('id, slug, name, number')
    .like('slug', 'op-%-ja')
    .is('snkrdunk_url', null)
    .limit(100);

  if (unlinkedCards && unlinkedCards.length > 0) {
    console.log(`\nFound ${unlinkedCards.length} Japanese cards missing snkrdunk_url. Searching Snkrdunk...`);

    let linkedCount = 0;
    for (const card of unlinkedCards) {
      const foundUrl = await searchSnkrdunkForCard(card.number, card.name);
      if (foundUrl) {
        await supabase
          .from('cards')
          .update({ snkrdunk_url: foundUrl, historical_fetched: false, updated_at: new Date().toISOString() })
          .eq('id', card.id);
        console.log(`  ✓ Auto-linked ${card.slug} -> ${foundUrl}`);
        linkedCount++;
      }
      await new Promise(r => setTimeout(r, 600));
    }
    console.log(`Finished auto-linking pass! Linked ${linkedCount} new Japanese card URLs.`);
  }

  console.log('✅ URL Auto-Linking complete!');
}

run().catch(err => {
  console.error('Fatal auto-linker error:', err);
  process.exit(1);
});
