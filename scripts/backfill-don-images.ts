/**
 * Backfill images for cards whose `number` encodes a TCGPlayer product id
 * (e.g. "DON-655115"), which the price scrapers created without an image_url.
 * The image is fetched from product-images.tcgplayer.com/{id}.jpg and cached
 * into Supabase Storage, then local_image_url is set.
 *
 * Graceful: skips 404s / non-images / tiny placeholders, logs every skip, and
 * only touches rows where local_image_url IS NULL.
 * Run:  bun run scripts/backfill-don-images.ts
 */
import { createClient } from '@supabase/supabase-js';
import { storeCardImage } from '../lib/images/r2';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET = 'card-images';
const CONCURRENCY = 4;
const BATCH_DELAY_MS = 300;
const MIN_BYTES = 2000; // guard against tiny "image not available" placeholders
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function tcgIdFromNumber(number: string): string | null {
  const m = number.match(/^DON-(\d+)$/);
  return m ? m[1] : null;
}

async function backfillOne(card: { id: string; number: string }): Promise<{ ok: boolean; reason?: string }> {
  const tcgId = tcgIdFromNumber(card.number);
  if (!tcgId) return { ok: false, reason: `no tcg id in "${card.number}"` };
  const url = `https://product-images.tcgplayer.com/fit-in/600x836/${tcgId}.jpg`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return { ok: false, reason: `fetch ${res.status}` };
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) return { ok: false, reason: `not an image (${contentType})` };
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength < MIN_BYTES) return { ok: false, reason: `too small (${bytes.byteLength}b, likely placeholder)` };

    const path = `cards/${card.id}.jpg`;
    let publicUrl: string;
    try {
      publicUrl = await storeCardImage({ key: path, body: bytes, contentType, supabase, bucket: BUCKET });
    } catch (e) {
      return { ok: false, reason: `upload: ${e instanceof Error ? e.message : String(e)}` };
    }

    const { error: updErr } = await supabase
      .from('cards')
      .update({
        local_image_url: publicUrl,
        image_url: url,
        image_fetched_at: new Date().toISOString(),
      })
      .eq('id', card.id)
      .is('local_image_url', null);
    if (updErr) return { ok: false, reason: `db update: ${updErr.message}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  const { data, error } = await supabase
    .from('cards')
    .select('id, number')
    .is('local_image_url', null)
    .like('number', 'DON-%');
  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }
  const cards = ((data ?? []) as Array<{ id: string; number: string }>).filter((c) => tcgIdFromNumber(c.number));
  console.log(`Found ${cards.length} DON cards with a TCGPlayer id to backfill.`);

  let ok = 0;
  const failed: Array<{ number: string; reason: string }> = [];
  for (let i = 0; i < cards.length; i += CONCURRENCY) {
    const batch = cards.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(backfillOne));
    results.forEach((r, j) => {
      if (r.ok) ok++;
      else failed.push({ number: batch[j].number, reason: r.reason || 'unknown' });
    });
    console.log(`  ${Math.min(i + CONCURRENCY, cards.length)}/${cards.length} (ok=${ok}, failed=${failed.length})`);
    if (i + CONCURRENCY < cards.length) await delay(BATCH_DELAY_MS);
  }

  console.log(`\nDone. Success: ${ok}, Failed: ${failed.length}`);
  if (failed.length) {
    console.log('Skipped/failed:');
    for (const f of failed) console.log(`  - ${f.number}  ${f.reason}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
