import { getSharedBrowser } from '../browser';

export interface AltItemDocument {
  id: string;
  assetId?: string;
  name: string;
  itemName?: string;
  rawName?: string;
  brand: string;
  cardNumber: string;
  year?: number;
  category: string;
  grade?: string;
  gradeKey?: string;
  gradingCompany?: string;
  altValue?: number;
  altValueCents?: number;
  altValueConfidenceMetric?: number;
  altValueLowerBound?: number;
  altValueUpperBound?: number;
  price?: number;
  priceCents?: number;
  listingType?: string;
  auctionHouse?: string;
  bidCount?: number | null;
  pop?: number;
  url?: string;
  images?: Array<{ position: string; url: string }>;
  latestExternalTransaction?: {
    platform: string;
    price: number;
  } | null;
  createdAt?: number;
  updatedAt?: number;
  expiresAtEpoch?: number;
}

export interface AltSearchResult {
  found: number;
  hits: Array<{
    document: AltItemDocument;
  }>;
}

class AltClient {
  private cachedApiKey: string | null = null;
  private keyExpiresAt: number = 0;
  private typesenseHost = 'https://tlzfv6xaq81nhsbyp.a1.typesense.net';

  /**
   * Retrieves a valid Typesense API key, harvesting fresh if expired.
   */
  async getApiKey(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.cachedApiKey && this.keyExpiresAt > now + 300) {
      return this.cachedApiKey;
    }

    console.log('[AltClient] Harvesting fresh Typesense API key from alt.xyz...');
    const browser = await getSharedBrowser();
    const page = await browser.newPage();

    let harvestedKey: string | null = null;
    let expiresAt: number = 0;

    try {
      page.on('request', (req) => {
        if (req.url().includes('typesense.net')) {
          try {
            const urlObj = new URL(req.url());
            const key = urlObj.searchParams.get('x-typesense-api-key');
            if (key) {
              harvestedKey = key;
              const parts = key.split('7RnB');
              if (parts.length > 1) {
                const jsonStr = Buffer.from(parts[1], 'base64').toString('utf-8');
                const parsed = JSON.parse(jsonStr);
                if (parsed.expires_at) {
                  expiresAt = parsed.expires_at;
                }
              }
            }
          } catch (e) {}
        }
      });

      await page.goto('https://alt.xyz/browse?category=POKEMON_CARDS', { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise((r) => setTimeout(r, 2000));
    } finally {
      await page.close().catch(() => {});
    }

    if (!harvestedKey) {
      throw new Error('Failed to harvest Typesense API key from Alt');
    }

    this.cachedApiKey = harvestedKey;
    this.keyExpiresAt = expiresAt || now + 3600;
    console.log('[AltClient] Fresh API key obtained. Expires in ~', Math.round((this.keyExpiresAt - now) / 60), 'minutes.');
    return this.cachedApiKey;
  }

  /**
   * Search Pokémon cards on Alt Typesense index.
   */
  async searchPokemon(params: {
    query?: string;
    cardNumber?: string;
    brandFilter?: string;
    gradingCompany?: string;
    perPage?: number;
    page?: number;
  }): Promise<AltSearchResult> {
    const apiKey = await this.getApiKey();
    const { query = '', cardNumber, brandFilter, gradingCompany, perPage = 20, page = 1 } = params;

    const filters: string[] = ['category:[POKEMON_CARDS]', 'showResult:true'];
    if (cardNumber) {
      filters.push(`cardNumber:=\`${cardNumber}\``);
    }
    if (gradingCompany) {
      filters.push(`gradingCompany:[${gradingCompany}]`);
    }

    const payload = {
      searches: [
        {
          q: query,
          preset: 'timestamp_desc',
          filter_by: filters.join('&&'),
          per_page: perPage,
          page,
        },
      ],
    };

    const url = `${this.typesenseHost}/multi_search?collection=production_universal_search&use_cache=true&x-typesense-api-key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 401) {
      // Token expired, clear cache and retry once
      this.cachedApiKey = null;
      return this.searchPokemon(params);
    }

    if (!res.ok) {
      throw new Error(`Alt Typesense query failed with status ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    return (
      data.results?.[0] || {
        found: 0,
        hits: [],
      }
    );
  }

  /**
   * Universal search across all TCGs (One Piece, Pokemon, Dragon Ball) on Alt Typesense index.
   */
  async searchUniversal(params: {
    query: string;
    cardNumber?: string;
    category?: 'POKEMON_CARDS' | 'ONE_PIECE_CARDS' | string;
    perPage?: number;
    page?: number;
  }): Promise<AltSearchResult> {
    const apiKey = await this.getApiKey();
    const { query, cardNumber, category, perPage = 20, page = 1 } = params;

    const filters: string[] = ['showResult:true'];
    if (category) {
      filters.push(`category:[${category}]`);
    }
    if (cardNumber) {
      filters.push(`cardNumber:=\`${cardNumber}\``);
    }

    const payload = {
      searches: [
        {
          q: query,
          preset: 'timestamp_desc',
          filter_by: filters.join('&&'),
          per_page: perPage,
          page,
        },
      ],
    };

    const url = `${this.typesenseHost}/multi_search?collection=production_universal_search&use_cache=true&x-typesense-api-key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 401) {
      this.cachedApiKey = null;
      return this.searchUniversal(params);
    }

    if (!res.ok) {
      return { found: 0, hits: [] };
    }

    const data = await res.json();
    return data.results?.[0] || { found: 0, hits: [] };
  }

  /**
   * Fetches verified multi-year market transactions (completed sales from eBay, PWCC/Fanatics, Alt Vault)
   * via Alt's public GraphQL platform server.
   */
  async fetchMarketTransactions(assetId: string, maxTransactions: number = 50): Promise<AltMarketTransaction[]> {
    const cleanId = assetId.replace(/^live_/, '').replace(/^itm\//, '');
    const query = `
      query AssetMarketTransactions($id: ID!, $marketTransactionFilter: MarketTransactionFilter!) {
        asset(id: $id) {
          marketTransactions(marketTransactionFilter: $marketTransactionFilter) {
            id
            date
            auctionHouse
            auctionType
            price
            attributes {
              gradeNumber
              gradingCompany
              url
            }
          }
        }
      }
    `;

    try {
      const res = await fetch('https://alt-platform-server.production.internal.onlyalt.com/graphql/AssetMarketTransactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
          operationName: 'AssetMarketTransactions',
          variables: {
            id: cleanId,
            marketTransactionFilter: {
              allGrades: true,
              showSkipped: false,
              maxTransactionsPerGrade: maxTransactions,
            },
          },
          query,
        }),
      });

      if (!res.ok) return [];
      const data = await res.json();
      return (data.data?.asset?.marketTransactions || []) as AltMarketTransaction[];
    } catch (err: any) {
      console.warn(`[AltClient] fetchMarketTransactions error for ${cleanId}:`, err.message);
      return [];
    }
  }
}

export interface AltMarketTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  auctionHouse?: string;
  auctionType?: string;
  price: string | number;
  attributes?: {
    gradeNumber?: string;
    gradingCompany?: string;
    url?: string;
  };
}

export const altClient = new AltClient();

