/**
 * Image Service
 * Handles lazy downloading of card images to Supabase Storage
 * Integrates with Pokemon TCG API for Pokemon cards
 */

import { createServerClient } from '@/lib/supabase/client';
import { getPokemonTCGClient } from '@/lib/pokemon-tcg/client';
import { SET_ID_MAP } from '@/lib/pokemon-tcg/types';

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
    const { data: cardData } = await supabase
      .from('cards')
      .select('local_image_url, image_fetched_at')
      .eq('id', cardId)
      .single();

    const card = cardData as { local_image_url: string | null; image_fetched_at: string | null } | null;

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

  // Generate storage path
  const storagePath = `cards/${cardId}.${extension}`;

  // Upload to Supabase Storage
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, blob, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  return urlData.publicUrl;
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

  // Upload the large variant (original)
  const largePath = `cards/${cardId}/large.${extension}`;
  const { error: largeError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(largePath, arrayBuffer, {
      contentType,
      upsert: true,
    });

  if (largeError) {
    throw new Error(`Failed to upload large image: ${largeError.message}`);
  }

  const { data: largeUrl } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(largePath);
  variants.large = largeUrl.publicUrl;

  // For medium and thumbnail, use Supabase image transforms if available
  // Otherwise, store the same image (can be resized via URL params if using Supabase Pro)
  variants.medium = `${largeUrl.publicUrl}?width=${IMAGE_SIZES.medium}`;
  variants.thumbnail = `${largeUrl.publicUrl}?width=${IMAGE_SIZES.thumbnail}`;

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
    const { data: cardsData } = await supabase
      .from('cards')
      .select('id')
      .not('local_image_url', 'is', null);

    const cards = cardsData as Array<{ id: string }> | null;
    const cardIds = new Set(cards?.map((c) => c.id) || []);

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
  const supabase = createServerClient();

  const { data } = await supabase
    .from('cards')
    .select('local_image_url, image_fetched_at')
    .eq('id', cardId)
    .single();

  const card = data as { local_image_url: string | null; image_fetched_at: string | null } | null;

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
  const supabase = createServerClient();

  const { data } = await supabase
    .from('cards')
    .select(`
      id,
      name,
      poke_tcg_id,
      sets!inner (
        slug,
        games!inner (
          slug
        )
      )
    `)
    .eq('sets.games.slug', gameSlug)
    .is('local_image_url', null)
    .limit(limit);

  if (!data) return [];

  return data.map((card: {
    id: string;
    name: string;
    poke_tcg_id: string | null;
    sets: { slug: string; games: { slug: string } };
  }) => ({
    id: card.id,
    name: card.name,
    setSlug: card.sets.slug,
    pokeTcgId: card.poke_tcg_id,
  }));
}
