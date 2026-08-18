/**
 * Cloudflare R2 image storage.
 *
 * `storeCardImage` uploads a card image and returns its public URL. R2 is served via
 * images.tcgmaster.com + Image Transformations. Object keys are stable (e.g.
 * `cards/{id}.png`) so the database URL can be used as the durable cache pointer.
 *
 * Runtime env (set in Coolify for the web + inngest apps, and .env.local for scripts):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (optional),
 *   NEXT_PUBLIC_IMAGE_CDN (public delivery base, e.g. https://images.tcgmaster.com)
 */

import { AwsClient } from 'aws4fetch';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET || 'tcgmaster-card-images';
const IMAGE_CDN = (process.env.NEXT_PUBLIC_IMAGE_CDN || 'https://images.tcgmaster.com').replace(/\/+$/, '');
// Card art is effectively immutable (write-once, keyed by id/slug). Browser caches 30d;
// the CDN edge caches 1y (s-maxage) — purge the specific key on the rare re-fetch.
const CARD_IMAGE_CACHE_CONTROL = 'public, max-age=2592000, s-maxage=31536000';

function r2BucketEndpoint(): string {
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`;
}

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
  if (!isR2Configured()) {
    throw new Error('R2 PUT: R2 is not configured');
  }
  if (!SAFE_KEY_RE.test(key) || key.includes('..') || key.startsWith('/')) {
    throw new Error(`R2 putToR2: unsafe object key ${JSON.stringify(key)}`);
  }
  const endpoint = `${r2BucketEndpoint()}/${key}`;
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

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** List all R2 object keys below a prefix. */
export async function listR2ObjectKeys(prefix: string): Promise<string[]> {
  if (!isR2Configured()) {
    throw new Error('R2 list: R2 is not configured');
  }
  if (!SAFE_KEY_RE.test(prefix) || prefix.startsWith('/') || prefix.includes('..')) {
    throw new Error(`R2 list: unsafe object prefix ${JSON.stringify(prefix)}`);
  }

  const keys: string[] = [];
  let continuationToken: string | null = null;

  do {
    const url = new URL(r2BucketEndpoint());
    url.searchParams.set('list-type', '2');
    url.searchParams.set('prefix', prefix);
    if (continuationToken) {
      url.searchParams.set('continuation-token', continuationToken);
    }

    const response = await client().fetch(url.toString(), { method: 'GET' });
    if (!response.ok) {
      throw new Error(`R2 LIST ${prefix} failed: ${response.status}`);
    }

    const xml = await response.text();
    for (const match of xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g)) {
      keys.push(decodeXml(match[1]));
    }

    const nextToken = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1];
    continuationToken = nextToken ? decodeXml(nextToken) : null;
  } while (continuationToken);

  return keys;
}

/** Delete R2 objects by key. */
export async function deleteR2Objects(keys: string[]): Promise<void> {
  if (!isR2Configured()) {
    throw new Error('R2 delete: R2 is not configured');
  }

  for (const key of keys) {
    if (!SAFE_KEY_RE.test(key) || key.startsWith('/') || key.includes('..')) {
      throw new Error(`R2 delete: unsafe object key ${JSON.stringify(key)}`);
    }

    const response = await client().fetch(`${r2BucketEndpoint()}/${key}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`R2 DELETE ${key} failed: ${response.status}`);
    }
  }
}

/**
 * Store a card image at `key`, returning its public URL.
 */
export async function storeCardImage(opts: {
  key: string;
  body: Body;
  contentType: string;
}): Promise<string> {
  return putToR2(opts.key, opts.body, opts.contentType);
}
