import type { ImageLoaderProps } from 'next/image';

/**
 * Per-image next/image loader for Cloudflare Image Transformations in front of R2.
 *
 * Applied ONLY to card <Image>s via the `loader` prop, so /public backgrounds, the
 * hero, deck art, and static imports keep using Next's built-in optimizer.
 *
 * Enabled only when NEXT_PUBLIC_IMAGE_CDN is a VALID URL (e.g. https://images.tcgmaster.com).
 * NEXT_PUBLIC_* is inlined at BUILD time — set it as a Coolify BUILD variable and rebuild
 * at cutover (see docs/r2-migration-runbook.md); a runtime-only env will NOT flip it.
 * While disabled, card <Image>s pass `unoptimized`, so behaviour is identical to today.
 *
 * Supabase `card-images` URLs are deterministically host-swapped to the matching R2
 * object key when the CDN is enabled. Foreign hosts (tcgplayer, pokemontcg,
 * onepiece-cardgame), data/blob URLs, relative paths, SVG/GIF/animated, and already-
 * transformed URLs pass through unchanged.
 */

function parseOrigin(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    // Only an http(s) origin counts as "enabled"; anything else (data:, junk)
    // must fall back to disabled/pass-through, not half-enable the loader.
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null;
  } catch {
    return null; // malformed value must not silently enable a broken origin
  }
}

const CDN_URL = parseOrigin(process.env.NEXT_PUBLIC_IMAGE_CDN);

/** True only when a valid CDN origin is configured at build time. */
export const isImageCdnEnabled = CDN_URL !== null;

const CDN_ORIGIN = CDN_URL ? CDN_URL.origin : '';
const CDN_HOST = CDN_URL ? CDN_URL.host : '';
const SUPABASE_CARD_IMAGES_ORIGIN = 'https://mquqwlxqrsvfflsgfhmi.supabase.co';
const SUPABASE_CARD_IMAGES_PATH = '/storage/v1/object/public/card-images/';

const BYPASS_EXTENSION_RE = /\.(svg|gif)(?:$|\?)/i;
const ANIMATED_HINT_RE = /(?:^|[?&])(?:anim|animated)=/i;

/**
 * Cloudflare bills — and on the Free plan hard-caps at 5,000/month (error 9422) —
 * *unique* transformations, keyed on the full option string. Next's default srcset
 * spans 8 device widths + 8 image widths, so 15k card images could mint six figures
 * of distinct variants and start failing site-wide.
 *
 * Snapping to four buckets bounds the whole catalogue at 4 variants per image. Source
 * art is ~600px, and `fit=scale-down` never upscales, so 1280 covers retina without
 * paying for widths the origin cannot fill.
 */
const WIDTH_BUCKETS = [160, 320, 640, 1280] as const;

function snapWidth(width: number): number {
  return WIDTH_BUCKETS.find((bucket) => width <= bucket) ?? WIDTH_BUCKETS[WIDTH_BUCKETS.length - 1];
}

/**
 * Resolve a card image to its delivery origin without probing either backend.
 *
 * The R2 bucket deliberately mirrors Supabase Storage's object keys, so a legacy
 * Supabase URL can be mapped locally and deterministically once the build-time CDN
 * switch is enabled. With the switch unset, return the original URL byte-for-byte.
 */
export function resolveCardImageUrl(
  src: string | null | undefined,
): string | null | undefined {
  if (!src || !isImageCdnEnabled) return src;

  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return src;
  }

  if (
    url.origin !== SUPABASE_CARD_IMAGES_ORIGIN ||
    !url.pathname.startsWith(SUPABASE_CARD_IMAGES_PATH)
  ) {
    return src;
  }

  const objectKey = url.pathname.slice(SUPABASE_CARD_IMAGES_PATH.length);
  if (!objectKey) return src;

  return `${CDN_ORIGIN}/${objectKey}${url.search}${url.hash}`;
}

export default function cloudflareImageLoader({
  src,
  width,
  quality,
}: ImageLoaderProps): string {
  if (!isImageCdnEnabled) return src;

  const resolvedSrc = resolveCardImageUrl(src) ?? src;
  let url: URL;
  try {
    // Absolute URLs only. Relative paths, data:, blob: and protocol-relative "//host"
    // throw here (no base) → pass through untouched.
    url = new URL(resolvedSrc);
  } catch {
    return src;
  }

  if (url.host !== CDN_HOST) return src; // foreign host (incl. Supabase during cutover)
  if (url.pathname.startsWith('/cdn-cgi/image/')) return resolvedSrc; // don't double-transform
  if (BYPASS_EXTENSION_RE.test(url.pathname) || ANIMATED_HINT_RE.test(url.search)) {
    return resolvedSrc;
  }

  // fit=scale-down never upscales past the source (~600px card art).
  // onerror=redirect is the safety net for the Free-tier 5,000 unique-transformation
  // cap: past it Cloudflare answers 9422 instead of an image, which would break every
  // card image at once, mid-month, with no deploy to correlate it to. With the
  // redirect, overflow falls back to the original R2 object — already edge-HIT with
  // max-age=2592000 — so the failure mode degrades to "larger images", not "no images".
  const opts = `width=${snapWidth(width)},quality=${quality ?? 75},format=auto,fit=scale-down,onerror=redirect`;
  // pathname/search are already percent-encoded by URL — do NOT re-encode.
  return `${CDN_ORIGIN}/cdn-cgi/image/${opts}${url.pathname}${url.search}`;
}

/**
 * Same transform for raw img elements (which don't use next/image). Returns the src
 * unchanged when the CDN is disabled or the src is not a CDN-hosted image, so it's
 * safe to wrap any thumbnail. `width` is the intended render width in px (pass ~2× the
 * CSS px for retina).
 */
export function cdnImageUrl(
  src: string | null | undefined,
  width: number,
  quality = 75,
): string | null | undefined {
  if (!src) return src;
  return cloudflareImageLoader({ src, width, quality });
}
