/**
 * Cloudflare R2 image storage.
 *
 * `storeCardImage` uploads a card image and returns its public URL. It prefers R2
 * (served via images.tcgmaster.com + Image Transformations) when R2 env vars are set,
 * and otherwise falls back to Supabase Storage — so writers keep working even before
 * R2 credentials are provisioned. Object keys are identical across both backends
 * (e.g. `cards/{id}.png`), which is what let the one-time bucket copy be a plain
 * host-swap.
 *
 * Runtime env (set in Coolify for the web + inngest apps, and .env.local for scripts):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (optional),
 *   NEXT_PUBLIC_IMAGE_CDN (public delivery base, e.g. https://images.tcgmaster.com)
 */

import { AwsClient } from 'aws4fetch';
import type { SupabaseClient } from '@supabase/supabase-js';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET || 'tcgmaster-card-images';
const IMAGE_CDN = (process.env.NEXT_PUBLIC_IMAGE_CDN || 'https://images.tcgmaster.com').replace(/\/+$/, '');
// Card art is effectively immutable (write-once, keyed by id/slug). Browser caches 30d;
// the CDN edge caches 1y (s-maxage) — purge the specific key on the rare re-fetch.
const CARD_IMAGE_CACHE_CONTROL = 'public, max-age=2592000, s-maxage=31536000';

export function isR2Configured(): boolean {
  return Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
}

let _client: AwsClient | null = null;
function client(): AwsClient {
  if (!_client) {
    _client = new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
      service: 's3',
      region: 'auto',
    });
  }
  return _client;
}

type Body = ArrayBuffer | Uint8Array | Buffer | Blob;

// Card-image keys are UUIDs or normalized slugs (e.g. cards/{uuid}.png,
// one-piece/{slug}.png) — always within this safe set. Anything else (spaces, ?, #,
// +, dot-segments) would be interpolated raw into the S3 URL and could sign/serve the
// wrong object, so reject it loudly rather than silently mis-store.
const SAFE_KEY_RE = /^[A-Za-z0-9._/-]+$/;

/** PUT an object to R2 via the S3 API and return its public (CDN) URL. */
export async function putToR2(key: string, body: Body, contentType: string): Promise<string> {
  if (!SAFE_KEY_RE.test(key) || key.includes('..') || key.startsWith('/')) {
    throw new Error(`R2 putToR2: unsafe object key ${JSON.stringify(key)}`);
  }
  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;
  // aws4fetch signs and sends; Blob bodies are read to bytes for a stable content-length.
  const payload = body instanceof Blob ? new Uint8Array(await body.arrayBuffer()) : body;
  const res = await client().fetch(endpoint, {
    method: 'PUT',
    body: payload as BodyInit,
    headers: { 'Content-Type': contentType, 'Cache-Control': CARD_IMAGE_CACHE_CONTROL },
  });
  if (!res.ok) {
    // Don't echo R2's error body — it can contain the Access Key Id. Status is enough.
    throw new Error(`R2 PUT ${key} failed: ${res.status}`);
  }
  return `${IMAGE_CDN}/${key}`;
}

/**
 * Store a card image at `key`, returning its public URL. R2 when configured, else the
 * given Supabase client's Storage bucket (default `card-images`). `supabase` is only
 * required for the fallback path.
 */
export async function storeCardImage(opts: {
  key: string;
  body: Body;
  contentType: string;
  supabase?: SupabaseClient;
  bucket?: string;
}): Promise<string> {
  if (isR2Configured()) {
    return putToR2(opts.key, opts.body, opts.contentType);
  }
  if (!opts.supabase) {
    throw new Error('storeCardImage: R2 not configured and no Supabase client for fallback');
  }
  const bucket = opts.bucket || 'card-images';
  const uploadBody = opts.body instanceof Blob ? opts.body : (opts.body as ArrayBuffer);
  const { error } = await opts.supabase.storage
    .from(bucket)
    .upload(opts.key, uploadBody, { contentType: opts.contentType, upsert: true });
  if (error) throw new Error(`Supabase upload ${opts.key} failed: ${error.message}`);
  return opts.supabase.storage.from(bucket).getPublicUrl(opts.key).data.publicUrl;
}
