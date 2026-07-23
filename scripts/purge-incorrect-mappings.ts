import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function purgeStaleMappings() {
  console.log('🤖 Purging incorrect mapping dictionary entries & resetting price cache...');

  // 1. Purge mapping-dictionary.json -1 / null markers
  const dictPath = path.resolve(process.cwd(), 'lib/price-engine/mapping-dictionary.json');
  if (fs.existsSync(dictPath)) {
    const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
    let purgedDictCount = 0;

    for (const key of Object.keys(dict)) {
      if (dict[key] === -1 || dict[key] === null) {
        delete dict[key];
        purgedDictCount++;
      }
    }

    fs.writeFileSync(dictPath, JSON.stringify(dict, null, 2));
    console.log(`[Cache Flush] Removed ${purgedDictCount} stale/unmatched entries from mapping-dictionary.json`);
  }

  // 2. Fetch Japanese One Piece cards needing fresh price_cache calculations
  const { data: cards } = await supabase
    .from('cards')
    .select('id')
    .like('slug', 'op-%-ja');

  const cardIds = (cards || []).map(c => c.id);

  if (cardIds.length > 0) {
    // Delete stale price_cache rows in batches of 500
    for (let i = 0; i < cardIds.length; i += 500) {
      const batch = cardIds.slice(i, i + 500);
      await supabase
        .from('price_cache')
        .delete()
        .in('card_id', batch);
    }
    console.log(`[Cache Flush] Reset price_cache for ${cardIds.length} Japanese One Piece cards.`);
  }

  console.log('✅ Mapping & Price Cache Flush complete! Background scrapers will now re-populate fresh accurate data.');
}

purgeStaleMappings().catch(err => {
  console.error('Fatal flush error:', err);
  process.exit(1);
});
