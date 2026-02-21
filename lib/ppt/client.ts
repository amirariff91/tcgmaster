/**
 * PokemonPriceTracker API v2 Client
 *
 * Base URL: https://www.pokemonpricetracker.com/api/v2
 * Credit costs: 1/card + 1 for history + 1 for eBay data
 */

const PPT_BASE_URL = 'https://www.pokemonpricetracker.com/api/v2';

// API Response Types
export interface PPTSet {
  id: string;
  name: string;
  releaseDate: string;
  cardCount: number;
  language: string;
  tcgPlayerGroupId?: string;
  imageUrl?: string;
}

export interface PPTCardPrices {
  market: number | null;
  low: number | null;
  mid: number | null;
  high: number | null;
  conditions: {
    nearMint: number | null;
    lightlyPlayed: number | null;
    moderatelyPlayed: number | null;
    heavilyPlayed: number | null;
    damaged: number | null;
  };
}

export interface PPTEbaySale {
  price: number;
  date: string;
  title: string;
  saleType: 'auction' | 'buy-it-now' | 'best-offer';
}

export interface PPTEbayGradeData {
  average: number | null;
  median: number | null;
  low: number | null;
  high: number | null;
  count: number;
  recentSales: PPTEbaySale[];
}

export interface PPTCard {
  id: string;
  tcgPlayerId: string;
  name: string;
  setName: string;
  setId: string;
  cardNumber: string;
  rarity: string;
  artist?: string;
  prices: PPTCardPrices;
  ebay?: {
    salesByGrade: {
      raw?: PPTEbayGradeData;
      psa1?: PPTEbayGradeData;
      psa2?: PPTEbayGradeData;
      psa3?: PPTEbayGradeData;
      psa4?: PPTEbayGradeData;
      psa5?: PPTEbayGradeData;
      psa6?: PPTEbayGradeData;
      psa7?: PPTEbayGradeData;
      psa8?: PPTEbayGradeData;
      psa9?: PPTEbayGradeData;
      psa10?: PPTEbayGradeData;
      bgs85?: PPTEbayGradeData;
      bgs9?: PPTEbayGradeData;
      bgs95?: PPTEbayGradeData;
      bgs10?: PPTEbayGradeData;
    };
  };
  priceHistory?: Array<{
    date: string;
    price: number;
  }>;
  imageCdnUrl: {
    small: string;
    large: string;
  };
  lastUpdated: string;
}

export interface PPTSearchResult {
  cards: PPTCard[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalCards: number;
  };
}

export interface PPTApiError {
  error: string;
  message: string;
  code: string;
}

// API Options
interface GetSetsOptions {
  language?: 'en' | 'jp';
  sortBy?: 'releaseDate' | 'name' | 'cardCount';
  sortDirection?: 'asc' | 'desc';
}

interface GetCardsOptions {
  setId?: string;
  search?: string;
  includeHistory?: boolean;
  includeEbay?: boolean;
  days?: number;
  page?: number;
  pageSize?: number;
}

interface GetCardOptions {
  includeHistory?: boolean;
  includeEbay?: boolean;
  days?: number;
}

class PokemonPriceTrackerClient {
  private apiKey: string;
  private dailyCreditsUsed: number = 0;
  private dailyCreditsLimit: number = 20000; // API tier
  private lastResetDate: string = '';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.PPT_API_KEY || '';
    if (!this.apiKey) {
      console.warn('PokemonPriceTracker API key not configured');
    }
  }

  private async fetch<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${PPT_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: 'Unknown error',
        message: response.statusText,
        code: response.status.toString(),
      })) as PPTApiError;

      throw new PPTError(
        error.message || 'API request failed',
        response.status,
        error.code
      );
    }

    // Track credit usage from response headers if available
    const creditsUsed = response.headers.get('X-Credits-Used');
    if (creditsUsed) {
      this.dailyCreditsUsed += parseInt(creditsUsed, 10);
    }

    return response.json();
  }

  /**
   * Get all sets
   * Credit cost: 1 credit per request
   */
  async getSets(options: GetSetsOptions = {}): Promise<PPTSet[]> {
    const params = new URLSearchParams();
    if (options.language) params.set('language', options.language);
    if (options.sortBy) params.set('sortBy', options.sortBy);
    if (options.sortDirection) params.set('sortDirection', options.sortDirection);

    const query = params.toString();
    return this.fetch<PPTSet[]>(`/sets${query ? `?${query}` : ''}`);
  }

  /**
   * Get cards with optional filters
   * Credit cost: 1 per card + 1 for history + 1 for eBay
   */
  async getCards(options: GetCardsOptions = {}): Promise<PPTSearchResult> {
    const params = new URLSearchParams();
    params.set('language', 'english');
    if (options.setId) params.set('setId', options.setId);
    if (options.search) params.set('search', options.search);
    if (options.includeHistory) params.set('includeHistory', 'true');
    if (options.includeEbay) params.set('includeEbay', 'true');
    if (options.days) params.set('days', options.days.toString());
    if (options.page) params.set('page', options.page.toString());
    if (options.pageSize) params.set('pageSize', options.pageSize.toString());

    // API returns { data: PPTCard[], metadata: { total, hasMore, ... } }
    const raw = await this.fetch<{ data: PPTCard[]; metadata: { total: number; hasMore: boolean; offset: number; limit: number } }>(
      `/cards?${params.toString()}`
    );

    // Normalise to PPTSearchResult shape
    const cards = Array.isArray(raw.data) ? raw.data : [raw.data].filter(Boolean);
    const meta = raw.metadata || {};
    return {
      cards,
      pagination: {
        page: options.page || 1,
        pageSize: options.pageSize || cards.length,
        totalPages: meta.total && options.pageSize ? Math.ceil(meta.total / (options.pageSize || 50)) : 1,
        totalCards: meta.total || cards.length,
      },
    };
  }

  /**
   * Get a single card by TCGPlayer ID
   * Credit cost: 1 + 1 for history + 1 for eBay
   */
  async getCard(
    tcgPlayerId: string,
    options: GetCardOptions = {}
  ): Promise<PPTCard> {
    const params = new URLSearchParams();
    params.set('tcgPlayerId', tcgPlayerId);
    params.set('language', 'english');
    if (options.includeHistory) params.set('includeHistory', 'true');
    if (options.includeEbay) params.set('includeEbay', 'true');
    if (options.days) params.set('days', options.days.toString());

    // API returns { data: PPTCard, metadata: {...} } — unwrap data
    const result = await this.fetch<{ data: PPTCard; metadata: Record<string, unknown> }>(
      `/cards?${params.toString()}`
    );

    if (!result.data) {
      throw new PPTError(`Card not found: ${tcgPlayerId}`, 404, 'NOT_FOUND');
    }

    // Normalise price shape: map API response to expected PPTCardPrices format
    const raw = result.data as unknown as Record<string, unknown>;
    const prices = raw.prices as Record<string, unknown> | undefined;
    if (prices && !prices.conditions) {
      // API returns variants.Holofoil["Near Mint Holofoil"].price etc.
      // Map to conditions shape that sync-prices expects
      const variants = (prices.variants as Record<string, Record<string, { price: number }>> | undefined) || {};
      const nmPrice = Object.values(variants)
        .flatMap(v => Object.entries(v))
        .find(([k]) => k.toLowerCase().includes('near mint'))?.[1]?.price ?? null;
      const mktPrice = (prices.market as number | null) ?? nmPrice;

      (raw as Record<string, unknown>).prices = {
        market: mktPrice,
        low: prices.low ?? null,
        mid: null,
        high: null,
        conditions: {
          nearMint: nmPrice ?? mktPrice,
          lightlyPlayed: nmPrice ? Math.round(nmPrice * 0.75 * 100) / 100 : null,
          moderatelyPlayed: nmPrice ? Math.round(nmPrice * 0.50 * 100) / 100 : null,
          heavilyPlayed: nmPrice ? Math.round(nmPrice * 0.30 * 100) / 100 : null,
          damaged: nmPrice ? Math.round(nmPrice * 0.15 * 100) / 100 : null,
        },
      };
    }

    return result.data;
  }

  /**
   * Get cards by set ID
   * Useful for bulk importing a set
   */
  async getCardsBySet(
    setId: string,
    options: Omit<GetCardsOptions, 'setId'> = {}
  ): Promise<PPTCard[]> {
    const allCards: PPTCard[] = [];
    let page = 1;
    const pageSize = options.pageSize || 100;

    while (true) {
      const result = await this.getCards({
        ...options,
        setId,
        page,
        pageSize,
      });

      allCards.push(...result.cards);

      if (page >= result.pagination.totalPages) {
        break;
      }
      page++;
    }

    return allCards;
  }

  /**
   * Search cards by name
   */
  async searchCards(
    query: string,
    options: Omit<GetCardsOptions, 'search'> = {}
  ): Promise<PPTSearchResult> {
    return this.getCards({
      ...options,
      search: query,
    });
  }

  /**
   * Parse a card title/description to extract card info
   * Useful for eBay listing parsing
   */
  async parseTitle(title: string): Promise<{
    cardName?: string;
    setName?: string;
    grade?: number;
    gradingCompany?: string;
    variant?: string;
    confidence: number;
  }> {
    return this.fetch('/parse-title', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  /**
   * Get current credit usage
   */
  getCreditsUsed(): number {
    return this.dailyCreditsUsed;
  }

  /**
   * Get remaining credits
   */
  getCreditsRemaining(): number {
    return Math.max(0, this.dailyCreditsLimit - this.dailyCreditsUsed);
  }

  /**
   * Check if we have enough credits for an operation
   */
  hasCredits(needed: number = 1): boolean {
    return this.getCreditsRemaining() >= needed;
  }
}

// Custom error class
export class PPTError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'PPTError';
  }

  isRateLimited(): boolean {
    return this.statusCode === 429;
  }

  isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  isNotFound(): boolean {
    return this.statusCode === 404;
  }
}

// Export singleton instance
export const pptClient = new PokemonPriceTrackerClient();

// Export class for custom instances
export { PokemonPriceTrackerClient };
