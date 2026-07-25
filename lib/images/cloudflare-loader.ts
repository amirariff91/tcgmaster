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
 * Only absolute URLs whose host is the CDN host are transformed; foreign hosts
 * (tcgplayer, pokemontcg, onepiece-cardgame, Supabase during cutover), data/blob URLs,
 * relative paths, SVG/GIF/animated, and already-transformed URLs pass through unchanged.
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

export default function cloudflareImageLoader({
  src,
  width,
  quality,
}: ImageLoaderProps): string {
  if (!isImageCdnEnabled) return src;

  let url: URL;
  try {
    // Absolute URLs only. Relative paths, data:, blob: and protocol-relative "//host"
    // throw here (no base) → pass through untouched.
    url = new URL(src);
  } catch {
    return src;
  }

  if (url.host !== CDN_HOST) return src; // foreign host (incl. Supabase during cutover)
  if (url.pathname.startsWith('/cdn-cgi/image/')) return src; // don't double-transform
  if (BYPASS_EXTENSION_RE.test(url.pathname) || ANIMATED_HINT_RE.test(url.search)) {
    return src;
  }

  // fit=scale-down never upscales past the source (~600px card art).
  const opts = `width=${snapWidth(width)},quality=${quality ?? 75},format=auto,fit=scale-down`;
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
