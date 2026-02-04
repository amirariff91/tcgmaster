/**
 * Inngest Functions for Image Fetching
 * Handles background image fetching with retry logic
 */

import { inngest } from '../client';
import {
  fetchPokemonCardImage,
  fetchPokemonCardImageByNameAndSet,
  getCardsNeedingImages,
} from '@/lib/images/service';
import { createServerClient } from '@/lib/supabase/client';

// Event types
interface FetchCardImageEvent {
  name: 'images/fetch-card';
  data: {
    cardId: string;
    pokeTcgId?: string;
    cardName?: string;
    setSlug?: string;
    priority?: 'high' | 'normal' | 'low';
  };
}

interface BatchFetchImagesEvent {
  name: 'images/batch-fetch';
  data: {
    gameSlug: string;
    limit?: number;
  };
}

// Maximum retry attempts for failed image fetches
const MAX_FETCH_ATTEMPTS = 3;

/**
 * Fetch a single card image
 * Triggered by: images/fetch-card event
 */
export const fetchCardImage = inngest.createFunction(
  {
    id: 'fetch-card-image',
    name: 'Fetch Card Image',
    retries: 3,
    throttle: {
      limit: 10,
      period: '1m',
      key: 'event.data.cardId',
    },
  },
  { event: 'images/fetch-card' },
  async ({ event, step }) => {
    const { cardId, pokeTcgId, cardName, setSlug } = event.data;

    // Check current fetch attempt count
    const supabase = createServerClient();
    const { data: cardData } = await supabase
      .from('cards')
      .select('image_fetch_attempts, local_image_url')
      .eq('id', cardId)
      .single();

    const card = cardData as {
      image_fetch_attempts: number | null;
      local_image_url: string | null;
    } | null;

    // Skip if already has image
    if (card?.local_image_url) {
      return { success: true, skipped: true, reason: 'Image already exists' };
    }

    // Skip if too many attempts
    const attempts = card?.image_fetch_attempts ?? 0;
    if (attempts >= MAX_FETCH_ATTEMPTS) {
      return {
        success: false,
        skipped: true,
        reason: `Max attempts (${MAX_FETCH_ATTEMPTS}) reached`,
      };
    }

    // Increment attempt counter
    await step.run('increment-attempts', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('cards') as any)
        .update({ image_fetch_attempts: attempts + 1 })
        .eq('id', cardId);
    });

    // Fetch the image
    const result = await step.run('fetch-image', async () => {
      // Try by Pokemon TCG API ID first
      if (pokeTcgId) {
        return fetchPokemonCardImage(cardId, pokeTcgId);
      }

      // Fall back to name + set search
      if (cardName && setSlug) {
        return fetchPokemonCardImageByNameAndSet(cardId, cardName, setSlug);
      }

      return {
        url: '',
        isLocal: false,
        error: 'No Pokemon TCG ID or name/set provided',
      };
    });

    if (result.error) {
      throw new Error(result.error);
    }

    return {
      success: true,
      cardId,
      imageUrl: result.url,
      isLocal: result.isLocal,
    };
  }
);

/**
 * Batch fetch images for cards missing images
 * Runs on a schedule to gradually populate images
 */
export const batchFetchImages = inngest.createFunction(
  {
    id: 'batch-fetch-images',
    name: 'Batch Fetch Card Images',
    retries: 1,
    throttle: {
      limit: 1,
      period: '6h',
      key: 'event.data.gameSlug',
    },
  },
  { event: 'images/batch-fetch' },
  async ({ event, step }) => {
    const { gameSlug, limit = 100 } = event.data;

    // Get cards needing images
    const cards = await step.run('get-cards-needing-images', async () => {
      return getCardsNeedingImages(gameSlug, limit);
    });

    if (cards.length === 0) {
      return { success: true, processed: 0, message: 'No cards need images' };
    }

    // Queue individual fetch events
    const queued = await step.run('queue-fetch-events', async () => {
      const events: FetchCardImageEvent[] = cards.map((card) => ({
        name: 'images/fetch-card' as const,
        data: {
          cardId: card.id,
          pokeTcgId: card.pokeTcgId || undefined,
          cardName: card.name,
          setSlug: card.setSlug,
          priority: 'normal' as const,
        },
      }));

      // Send events in batches
      await inngest.send(events);
      return events.length;
    });

    return {
      success: true,
      queued,
      gameSlug,
    };
  }
);

/**
 * Scheduled function to fetch Pokemon card images
 * Runs every 6 hours
 */
export const scheduledPokemonImageFetch = inngest.createFunction(
  {
    id: 'scheduled-pokemon-image-fetch',
    name: 'Scheduled Pokemon Image Fetch',
  },
  { cron: '0 */6 * * *' }, // Every 6 hours
  async ({ step }) => {
    // Trigger batch fetch for Pokemon cards
    await step.sendEvent('trigger-pokemon-batch', {
      name: 'images/batch-fetch',
      data: {
        gameSlug: 'pokemon',
        limit: 100, // Max 100 per run to respect API limits
      },
    });

    return { triggered: true, game: 'pokemon' };
  }
);

/**
 * Retry failed image fetches
 * Runs daily to retry cards that failed with transient errors
 */
export const retryFailedImageFetches = inngest.createFunction(
  {
    id: 'retry-failed-image-fetches',
    name: 'Retry Failed Image Fetches',
  },
  { cron: '0 4 * * *' }, // Daily at 4 AM
  async ({ step }) => {
    const supabase = createServerClient();

    // Define the card type for this query
    type FailedCard = {
      id: string;
      name: string;
      poke_tcg_id: string | null;
      sets: { slug: string; games: { slug: string } };
    };

    // Find cards with failed attempts that haven't exceeded max
    const failedCardsResult = await step.run('get-failed-cards', async (): Promise<FailedCard[]> => {
      const { data } = await supabase
        .from('cards')
        .select(`
          id,
          name,
          poke_tcg_id,
          image_fetch_attempts,
          sets!inner (
            slug,
            games!inner (
              slug
            )
          )
        `)
        .is('local_image_url', null)
        .gt('image_fetch_attempts', 0)
        .lt('image_fetch_attempts', MAX_FETCH_ATTEMPTS)
        .eq('sets.games.slug', 'pokemon')
        .limit(50);
      return (data as FailedCard[]) || [];
    });

    if (failedCardsResult.length === 0) {
      return { retried: 0, message: 'No failed cards to retry' };
    }

    // Queue retry events
    const events: FetchCardImageEvent[] = failedCardsResult.map((card) => ({
      name: 'images/fetch-card' as const,
      data: {
        cardId: card.id,
        pokeTcgId: card.poke_tcg_id || undefined,
        cardName: card.name,
        setSlug: card.sets.slug,
        priority: 'low' as const,
      },
    }));

    await step.sendEvent('queue-retries', events);

    return { retried: events.length };
  }
);

// Export all image-related functions
export const imageFunctions = [
  fetchCardImage,
  batchFetchImages,
  scheduledPokemonImageFetch,
  retryFailedImageFetches,
];
