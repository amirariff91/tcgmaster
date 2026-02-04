/**
 * Pokemon TCG API Client
 * https://docs.pokemontcg.io/
 */

import type {
  PokemonTCGCard,
  PokemonTCGResponse,
  PokemonTCGSearchParams,
  SET_ID_MAP,
  CARD_NAME_MAP,
} from './types';

const BASE_URL = 'https://api.pokemontcg.io/v2';

// Rate limiting: 20,000 requests/day without API key, 1000/day limit is conservative
// We'll batch requests and cache results
const RATE_LIMIT_DELAY_MS = 100;

export interface PokemonTCGClientOptions {
  apiKey?: string;
  timeout?: number;
}

export class PokemonTCGClient {
  private apiKey?: string;
  private timeout: number;
  private lastRequestTime = 0;

  constructor(options: PokemonTCGClientOptions = {}) {
    this.apiKey = options.apiKey || process.env.POKEMON_TCG_API_KEY;
    this.timeout = options.timeout || 10000;
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < RATE_LIMIT_DELAY_MS) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private async fetch<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    await this.rateLimit();

    const url = new URL(`${BASE_URL}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.append(key, value);
      });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['X-Api-Key'] = this.apiKey;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new PokemonTCGError(
          `API request failed: ${response.status} ${response.statusText}`,
          response.status
        );
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get a specific card by its Pokemon TCG API ID
   * Example: base1-4 (Charizard from Base Set)
   */
  async getCard(id: string): Promise<PokemonTCGCard | null> {
    try {
      const response = await this.fetch<PokemonTCGResponse<PokemonTCGCard>>(`/cards/${id}`);
      return response.data;
    } catch (error) {
      if (error instanceof PokemonTCGError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Search for cards with Lucene query syntax
   * Examples:
   * - name:Charizard set.id:base1
   * - name:"Pikachu" supertype:Pokemon
   */
  async searchCards(params: PokemonTCGSearchParams): Promise<{
    cards: PokemonTCGCard[];
    totalCount: number;
    page: number;
    pageSize: number;
  }> {
    const queryParams: Record<string, string> = {};

    if (params.q) queryParams.q = params.q;
    if (params.page) queryParams.page = String(params.page);
    if (params.pageSize) queryParams.pageSize = String(params.pageSize);
    if (params.orderBy) queryParams.orderBy = params.orderBy;
    if (params.select) queryParams.select = params.select;

    const response = await this.fetch<PokemonTCGResponse<PokemonTCGCard[]>>('/cards', queryParams);

    return {
      cards: response.data,
      totalCount: response.totalCount || 0,
      page: response.page || 1,
      pageSize: response.pageSize || 250,
    };
  }

  /**
   * Find a card by name and set slug
   * Converts our internal slugs to Pokemon TCG API format
   */
  async findCard(cardName: string, setSlug: string): Promise<PokemonTCGCard | null> {
    // Convert set slug to Pokemon TCG API set ID
    const setId = (await import('./types')).SET_ID_MAP[setSlug];
    if (!setId) {
      console.warn(`Unknown set slug: ${setSlug}`);
      return null;
    }

    // Build search query
    const query = `name:"${cardName}" set.id:${setId}`;
    const result = await this.searchCards({ q: query, pageSize: 1 });

    return result.cards[0] || null;
  }

  /**
   * Get card image URLs
   * Returns both small (245px) and large (734px) variants
   */
  async getCardImages(cardId: string): Promise<{ small: string; large: string } | null> {
    const card = await this.getCard(cardId);
    if (!card) return null;

    return card.images;
  }

  /**
   * Bulk fetch card images for multiple Pokemon TCG IDs
   * Returns a map of cardId to images
   */
  async bulkGetCardImages(
    cardIds: string[]
  ): Promise<Map<string, { small: string; large: string }>> {
    const results = new Map<string, { small: string; large: string }>();

    // Process in batches to respect rate limits
    const batchSize = 10;
    for (let i = 0; i < cardIds.length; i += batchSize) {
      const batch = cardIds.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (cardId) => {
          try {
            const images = await this.getCardImages(cardId);
            if (images) {
              results.set(cardId, images);
            }
          } catch (error) {
            console.error(`Failed to fetch images for card ${cardId}:`, error);
          }
        })
      );
    }

    return results;
  }

  /**
   * Search for cards by name with fuzzy matching
   * Useful when exact card slug doesn't map cleanly
   */
  async searchByName(name: string, options?: { setId?: string; limit?: number }): Promise<PokemonTCGCard[]> {
    let query = `name:"${name}"`;
    if (options?.setId) {
      query += ` set.id:${options.setId}`;
    }

    const result = await this.searchCards({
      q: query,
      pageSize: options?.limit || 10,
    });

    return result.cards;
  }
}

export class PokemonTCGError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = 'PokemonTCGError';
  }
}

// Default singleton instance
let defaultClient: PokemonTCGClient | null = null;

export function getPokemonTCGClient(options?: PokemonTCGClientOptions): PokemonTCGClient {
  if (!defaultClient) {
    defaultClient = new PokemonTCGClient(options);
  }
  return defaultClient;
}

// Convenience functions using the default client
export async function getCardById(id: string): Promise<PokemonTCGCard | null> {
  return getPokemonTCGClient().getCard(id);
}

export async function findCardByNameAndSet(
  cardName: string,
  setSlug: string
): Promise<PokemonTCGCard | null> {
  return getPokemonTCGClient().findCard(cardName, setSlug);
}

export async function getCardImageUrls(
  cardId: string
): Promise<{ small: string; large: string } | null> {
  return getPokemonTCGClient().getCardImages(cardId);
}
