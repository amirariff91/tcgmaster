import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

type JsonRecord = Record<string, unknown>;
type MisalignedCard = {
  cardSlug: string;
  cardName: string;
  yuyutei: number;
  snkrdunk: number;
  ratio: string;
};

async function auditVendorPriceDivergence() {

  const { data: currentEntries } = await supabase
    .from('card_price_current')
    .select('card_id, source_prices, cards(slug, name)')
    .limit(1000);

  if (!currentEntries) return;

  const misaligned: MisalignedCard[] = [];

  for (const entry of currentEntries) {
    const raw = entry.source_prices as unknown as JsonRecord | null;
    if (!raw) continue;

    const sourceValue = (source: string): number => {
      const value = raw[source];
      if (typeof value === 'object' && value !== null) {
        return Number((value as JsonRecord).usd ?? 0);
      }
      return Number(value ?? 0);
    };
    const yuyutei = sourceValue('yuyutei');
    const snkrdunk = sourceValue('snkrdunk');

    if (yuyutei > 0 && snkrdunk > 0) {
      const ratio = Math.max(yuyutei, snkrdunk) / Math.min(yuyutei, snkrdunk);
      if (ratio > 3.0) {
        const cards = entry.cards as unknown as { name?: string; slug?: string } | null;
        const cardName = cards?.name || 'Unknown';
        const cardSlug = cards?.slug || entry.card_id;
        misaligned.push({ cardSlug, cardName, yuyutei, snkrdunk, ratio: ratio.toFixed(2) });
      }
    }
  }

  console.log(`Found ${misaligned.length} Japanese cards with >3x vendor price divergence:`);
  misaligned.forEach(m => console.log(`  - ${m.cardSlug} (${m.cardName}): Yuyutei $${m.yuyutei} vs Snkrdunk $${m.snkrdunk} (Ratio ${m.ratio}x)`));
}

async function run() {
  await auditVendorPriceDivergence();
  console.log('\n✅ Vendor price divergence audit complete!');
}

run().catch(err => {
  console.error('Audit script error:', err);
  process.exit(1);
});
