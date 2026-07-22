/**
 * Backfill local_image_url for cards that have a source image_url but no cached
 * copy in Supabase Storage yet. Downloads each source image and re-uploads it to
 * the `card-images` bucket, then points local_image_url at the stored copy.
 *
 * Idempotent: only touches rows where local_image_url IS NULL AND image_url IS NOT NULL.
 * Run:  bun run scripts/backfill-images.ts
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY; // service role — bypasses RLS

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET = 'card-images';
const CONCURRENCY = 4;
const BATCH_DELAY_MS = 250;
// Some source hosts (onepiece-cardgame.com) are picky; send a browser-like UA.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

function extFor(contentType: string): string {
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  return 'png';
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function backfillOne(card: { id: string; image_url: string }): Promise<{ ok: boolean; reason?: string }> {
  try {
    const res = await fetch(card.image_url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return { ok: false, reason: `fetch ${res.status}` };
    const contentType = res.headers.get('content-type') || 'image/png';
    if (!contentType.startsWith('image/')) return { ok: false, reason: `not an image (${contentType})` };
    const ext = extFor(contentType);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const path = `cards/${card.id}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType, upsert: true });
    if (upErr) return { ok: false, reason: `upload: ${upErr.message}` };

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    const { error: updErr } = await supabase
      .from('cards')
      .update({ local_image_url: urlData.publicUrl, image_fetched_at: new Date().toISOString() })
      .eq('id', card.id)
      .is('local_image_url', null); // stay idempotent under concurrent runs
    if (updErr) return { ok: false, reason: `db update: ${updErr.message}` };

    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

async function main() {
  const { data, error } = await supabase
    .from('cards')
    .select('id, image_url')
    .is('local_image_url', null)
    .not('image_url', 'is', null);

  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }
  const cards = (data ?? []) as Array<{ id: string; image_url: string }>;
  console.log(`Found ${cards.length} cards to backfill.`);

  let ok = 0;
  const failed: Array<{ id: string; image_url: string; reason: string }> = [];

  for (let i = 0; i < cards.length; i += CONCURRENCY) {
    const batch = cards.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(backfillOne));
    results.forEach((r, j) => {
      if (r.ok) ok++;
      else failed.push({ id: batch[j].id, image_url: batch[j].image_url, reason: r.reason || 'unknown' });
    });
    console.log(`  ${Math.min(i + CONCURRENCY, cards.length)}/${cards.length} (ok=${ok}, failed=${failed.length})`);
    if (i + CONCURRENCY < cards.length) await delay(BATCH_DELAY_MS);
  }

  console.log(`\nDone. Success: ${ok}, Failed: ${failed.length}`);
  if (failed.length) {
    console.log('Failures (source likely dead / unreachable):');
    for (const f of failed) console.log(`  - ${f.id}  ${f.reason}  ${f.image_url}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
