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
        'X-API-Key': this.apiKey,
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
    if (options.setId) params.set('setId', options.setId);
    if (options.search) params.set('search', options.search);
    if (options.includeHistory) params.set('includeHistory', 'true');
    if (options.includeEbay) params.set('includeEbay', 'true');
    if (options.days) params.set('days', options.days.toString());
    if (options.page) params.set('page', options.page.toString());
    if (options.pageSize) params.set('pageSize', options.pageSize.toString());

    const query = params.toString();
    return this.fetch<PPTSearchResult>(`/cards${query ? `?${query}` : ''}`);
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
    if (options.includeHistory) params.set('includeHistory', 'true');
    if (options.includeEbay) params.set('includeEbay', 'true');
    if (options.days) params.set('days', options.days.toString());

    const query = params.toString();
    return this.fetch<PPTCard>(`/cards/${tcgPlayerId}${query ? `?${query}` : ''}`);
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
