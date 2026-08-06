/**
 * Image Service
 * Handles lazy downloading of card images to Supabase Storage
 * Integrates with Pokemon TCG API for Pokemon cards
 */

import { dbQuery } from '@/lib/db/client';
import { createServerClient } from '@/lib/supabase/client';
import { getPokemonTCGClient } from '@/lib/pokemon-tcg/client';
import { storeCardImage } from '@/lib/images/r2';

const STORAGE_BUCKET = 'card-images';

// Image size variants
const IMAGE_SIZES = {
  thumbnail: 100,
  medium: 400,
  large: 800,
} as const;

export type ImageSize = keyof typeof IMAGE_SIZES;

export interface ImageResult {
  url: string;
  isLocal: boolean;
  error?: string;
}

export interface ImageVariants {
  thumbnail: string;
  medium: string;
  large: string;
}

/**
 * Get image URL for a card, downloading if not yet cached
 */
export async function getCardImageUrl(
  cardId: string,
  sourceUrl: string,
  options?: {
    size?: 'small' | 'large';
    forceDownload?: boolean;
  }
): Promise<ImageResult> {
  const supabase = createServerClient();

  // Check if we already have the image locally
  if (!options?.forceDownload) {
    const cardRows = await dbQuery<{ local_image_url: string | null; image_fetched_at: string | null }>(`
      SELECT local_image_url, image_fetched_at
      FROM cards
      WHERE id = $1
      LIMIT 1
    `, [cardId]);
    const card = cardRows[0] || null;

    if (card?.local_image_url) {
      return {
        url: card.local_image_url,
        isLocal: true,
      };
    }
  }

  // Download and store the image
  try {
    const localUrl = await downloadAndStoreImage(cardId, sourceUrl);

    // Update the card record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('cards') as any)
      .update({
        local_image_url: localUrl,
        image_fetched_at: new Date().toISOString(),
      })
      .eq('id', cardId);

    return {
      url: localUrl,
      isLocal: true,
    };
  } catch (error) {
    console.error(`Failed to download image for card ${cardId}:`, error);

    // Fall back to source URL
    return {
      url: sourceUrl,
      isLocal: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch Pokemon card image from Pokemon TCG API
 */
export async function fetchPokemonCardImage(
  cardId: string,
  pokeTcgId: string
): Promise<ImageResult> {
  const supabase = createServerClient();
  const client = getPokemonTCGClient();

  try {
    // Fetch card from Pokemon TCG API
    const card = await client.getCard(pokeTcgId);
    if (!card) {
      return {
        url: '',
        isLocal: false,
        error: `Card not found: ${pokeTcgId}`,
      };
    }

    // Download the large image and create variants
    const variants = await downloadAndStoreWithVariants(cardId, card.images.large);

    // Update card record with image URL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('cards') as any)
      .update({
        local_image_url: variants.large,
        image_fetched_at: new Date().toISOString(),
      })
      .eq('id', cardId);

    return {
      url: variants.large,
      isLocal: true,
    };
  } catch (error) {
    console.error(`Failed to fetch Pokemon card image for ${pokeTcgId}:`, error);
    return {
      url: '',
      isLocal: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Find and fetch Pokemon card image by name and set
 */
export async function fetchPokemonCardImageByNameAndSet(
  cardId: string,
  cardName: string,
  setSlug: string
): Promise<ImageResult> {
  const client = getPokemonTCGClient();

  try {
    const card = await client.findCard(cardName, setSlug);
    if (!card) {
      return {
        url: '',
        isLocal: false,
        error: `Card not found: ${cardName} in ${setSlug}`,
      };
    }

    return fetchPokemonCardImage(cardId, card.id);
  } catch (error) {
    console.error(`Failed to find Pokemon card ${cardName} in ${setSlug}:`, error);
    return {
      url: '',
      isLocal: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Download image from source and upload to Supabase Storage
 */
async function downloadAndStoreImage(
  cardId: string,
  sourceUrl: string
): Promise<string> {
  const supabase = createServerClient();

  // Fetch the image
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'image/png';
  const extension = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';
  const blob = await response.blob();

  // Generate storage path (identical key on R2 or Supabase)
  const storagePath = `cards/${cardId}.${extension}`;

  // Store to R2 (preferred) or Supabase Storage fallback; returns the public URL.
  return storeCardImage({ key: storagePath, body: blob, contentType, supabase, bucket: STORAGE_BUCKET });
}

/**
 * Download image and create multiple size variants
 * Stores thumbnail (100px), medium (400px), and large (800px)
 */
async function downloadAndStoreWithVariants(
  cardId: string,
  sourceUrl: string
): Promise<ImageVariants> {
  const supabase = createServerClient();

  // Fetch the original image
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'image/png';
  const isJpeg = contentType.includes('jpeg') || contentType.includes('jpg');
  const extension = isJpeg ? 'jpg' : 'png';
  const arrayBuffer = await response.arrayBuffer();

  // For now, store the original at different paths
  // In production, use sharp to resize images server-side
  const variants: ImageVariants = {
    thumbnail: '',
    medium: '',
    large: '',
  };

  // Upload the large variant (original) to R2 (preferred) or Supabase fallback.
  const largePath = `cards/${cardId}/large.${extension}`;
  variants.large = await storeCardImage({
    key: largePath, body: arrayBuffer, contentType, supabase, bucket: STORAGE_BUCKET,
  });

  // Medium and thumbnail reference the same object; the CF Image Transformations loader
  // (or the next/image loader) handles actual resizing at the edge.
  variants.medium = `${variants.large}?width=${IMAGE_SIZES.medium}`;
  variants.thumbnail = `${variants.large}?width=${IMAGE_SIZES.thumbnail}`;

  return variants;
}

/**
 * Batch download images for multiple cards
 * Useful for set import
 */
export async function batchDownloadImages(
  cards: Array<{ id: string; sourceUrl: string }>,
  options?: {
    concurrency?: number;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<{
  successful: number;
  failed: Array<{ id: string; error: string }>;
}> {
  const concurrency = options?.concurrency ?? 5;
  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  // Process in batches
  for (let i = 0; i < cards.length; i += concurrency) {
    const batch = cards.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map(async (card) => {
        try {
          await getCardImageUrl(card.id, card.sourceUrl);
          return { id: card.id, success: true };
        } catch (error) {
          return {
            id: card.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    }

    options?.onProgress?.(Math.min(i + concurrency, cards.length), cards.length);
  }

  return {
    successful: results.filter((r) => r.success).length,
    failed: results
      .filter((r) => !r.success)
      .map((r) => ({ id: r.id, error: r.error || 'Unknown error' })),
  };
}

/**
 * Batch download Pokemon card images using Pokemon TCG API IDs
 */
export async function batchDownloadPokemonImages(
  cards: Array<{ id: string; pokeTcgId: string }>,
  options?: {
    concurrency?: number;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<{
  successful: number;
  failed: Array<{ id: string; error: string }>;
}> {
  const concurrency = options?.concurrency ?? 3; // Lower concurrency for API rate limits
  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (let i = 0; i < cards.length; i += concurrency) {
    const batch = cards.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map(async (card) => {
        const result = await fetchPokemonCardImage(card.id, card.pokeTcgId);
        if (result.error) {
          return { id: card.id, success: false, error: result.error };
        }
        return { id: card.id, success: true };
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          id: batch[results.length % batch.length]?.id || 'unknown',
          success: false,
          error: result.reason?.message || 'Unknown error',
        });
      }
    }

    options?.onProgress?.(Math.min(i + concurrency, cards.length), cards.length);

    // Add delay between batches to respect rate limits
    if (i + concurrency < cards.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return {
    successful: results.filter((r) => r.success).length,
    failed: results
      .filter((r) => !r.success)
      .map((r) => ({ id: r.id, error: r.error || 'Unknown error' })),
  };
}

/**
 * Generate responsive image URLs for srcset
 */
export function getResponsiveImageUrls(baseUrl: string): {
  small: string;
  medium: string;
  large: string;
  srcSet: string;
} {
  // If using Supabase Storage, we can use image transformations
  if (baseUrl.includes('supabase')) {
    return {
      small: `${baseUrl}?width=200`,
      medium: `${baseUrl}?width=400`,
      large: `${baseUrl}?width=800`,
      srcSet: `${baseUrl}?width=200 200w, ${baseUrl}?width=400 400w, ${baseUrl}?width=800 800w`,
    };
  }

  // For external URLs, return as-is
  return {
    small: baseUrl,
    medium: baseUrl,
    large: baseUrl,
    srcSet: baseUrl,
  };
}

/**
 * Generate a tiny base64 blur placeholder
 * In production, use plaiceholder library or sharp to generate proper blur hashes
 */
export function generateBlurPlaceholder(): string {
  // Return a simple gray placeholder data URL
  // In production, generate actual blur from image
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAOCAYAAAAWo42rAAAACXBIWXMAAAsTAAALEwEAmpwYAAABIklEQVQoz2NgGAWkgv///zMxMDAwMjAwMP7//5/h////TIwMDAz/GRgYGP7//8/EwMDAwMTAwMD4HwAAAAD//wQA';
}

/**
 * Clean up orphaned images (images not linked to any card)
 */
export async function cleanupOrphanedImages(): Promise<{
  deleted: number;
  errors: string[];
}> {
  const supabase = createServerClient();
  const errors: string[] = [];
  let deleted = 0;

  try {
    // List all files in storage
    const { data: files, error: listError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list('cards');

    if (listError) {
      errors.push(`Failed to list files: ${listError.message}`);
      return { deleted, errors };
    }

    if (!files || files.length === 0) {
      return { deleted, errors };
    }

    // Get all card IDs with local images
    const cards = await dbQuery<{ id: string }>(
      'SELECT id FROM cards WHERE local_image_url IS NOT NULL',
    );
    const cardIds = new Set(cards.map((c) => c.id));

    // Find orphaned files
    const orphanedFiles: string[] = [];
    for (const file of files) {
      const cardId = file.name.replace(/\.(jpg|png)$/, '');
      if (!cardIds.has(cardId)) {
        orphanedFiles.push(`cards/${file.name}`);
      }
    }

    // Delete orphaned files
    if (orphanedFiles.length > 0) {
      const { error: deleteError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove(orphanedFiles);

      if (deleteError) {
        errors.push(`Failed to delete files: ${deleteError.message}`);
      } else {
        deleted = orphanedFiles.length;
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return { deleted, errors };
}

/**
 * Check if a card needs image fetching
 */
export async function needsImageFetch(cardId: string): Promise<boolean> {
  const rows = await dbQuery<{ local_image_url: string | null; image_fetched_at: string | null }>(`
    SELECT local_image_url, image_fetched_at
    FROM cards
    WHERE id = $1
    LIMIT 1
  `, [cardId]);
  const card = rows[0] || null;

  // Needs fetch if no local URL
  if (!card?.local_image_url) return true;

  // Could also check if image is stale (e.g., older than 30 days)
  return false;
}

/**
 * Get cards that need image fetching (for batch jobs)
 */
export async function getCardsNeedingImages(
  gameSlug: string,
  limit: number = 100
): Promise<Array<{ id: string; name: string; setSlug: string; pokeTcgId: string | null }>> {
  const data = await dbQuery<{
    id: string;
    name: string;
    set_slug: string;
  }>(`
    SELECT c.id, c.name, s.slug AS set_slug
    FROM cards c
    JOIN sets s ON s.id = c.set_id
    JOIN games g ON g.id = s.game_id
    WHERE g.slug = $1
      AND c.local_image_url IS NULL
    LIMIT $2
  `, [gameSlug, limit]);

  return data.map((card) => ({
    id: card.id,
    name: card.name,
    setSlug: card.set_slug,
    pokeTcgId: null,
  }));
}
