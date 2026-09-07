import { getSharedBrowser } from '../browser';

export interface AltItemDocument {
  id: string;
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
}

export const altClient = new AltClient();
