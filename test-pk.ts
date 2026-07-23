import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase.from('price_cache').upsert({
        card_id: "900c5675-7282-4ffe-980b-0601bf7ca907",
        variant_id: null,
        raw_prices: { yuyutei: 100 },
        graded_prices: { psa10: { snkrdunk: 277 } },
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }, { onConflict: 'card_id, variant_id' });
  console.log("Upsert with onConflict card_id, variant_id:", error);
}
main();
