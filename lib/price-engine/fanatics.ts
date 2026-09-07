/**
 * Fanatics Collect API & Search Client
 *
 * Provides structured access to Fanatics Collect (formerly PWCC Marketplace):
 * - Real-time Buy It Now listings (marketplace: FIXED, status: Live)
 * - Historical auction and fixed sold records (status: Sold)
 *
 * Uses public GraphQL token minting and Algolia index prod_item_state_v1.
 */

export interface FanaticsHit {
  listingId: number | string;
  listingUuid: string;
  title: string;
  subtitle?: string;
  currentPrice: number; // In USD
  purchasePrice?: number;
  currentBid?: number;
  grade?: number | string;
  gradingService?: string; // PSA, BGS, CGC, SGC
  marketplace: 'FIXED' | 'WEEKLY' | 'PREMIER' | string;
  status: 'Live' | 'Sold' | string;
  soldDate?: number; // Unix epoch seconds
  auctionStartDatetime?: number;
  auctionEndDatetime?: number;
  lotNumber?: string;
  year?: number;
  serial?: string;
  brand?: string;
  images?: {
    primary?: {
      large?: string;
      medium?: string;
    };
    secondary?: {
      large?: string;
      medium?: string;
    };
  };
}

export interface FanaticsSearchResult {
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
  hits: FanaticsHit[];
}

export interface FanaticsCardQueryParams {
  query: string;
  cardNumber?: string;
  status?: 'Live' | 'Sold';
  marketplace?: 'FIXED' | 'WEEKLY' | 'PREMIER';
  gradingService?: string;
  grade?: number | string;
  hitsPerPage?: number;
  page?: number;
}

export class FanaticsClient {
  private appId = '3XT9C4X62I';
  private searchKey: string | null = null;
  private keyExpiresAt: number = 0; // Unix epoch seconds

  /**
   * Retrieves a valid secured Algolia search key from Fanatics Collect GraphQL endpoint.
   */
  async getSearchKey(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    // Use cached key if valid for at least 3 more minutes
    if (this.searchKey && this.keyExpiresAt > now + 180) {
      return this.searchKey;
    }

    const gqlUrl = 'https://app.fanaticscollect.com/graphql';
    const query = `
      query webSearchKeyQuery {
        collectSearchKeyV2 {
          key
          validUntil
        }
      }
    `;

    try {
      const res = await fetch(gqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
          operationName: 'webSearchKeyQuery',
          query,
        }),
      });

      if (!res.ok) {
        throw new Error(`GraphQL search key request failed with status ${res.status}`);
      }

      const json = await res.json();
      const keyData = json?.data?.collectSearchKeyV2;
      if (!keyData?.key) {
        throw new Error('GraphQL response missing collectSearchKeyV2.key');
      }

      this.searchKey = keyData.key;
      this.keyExpiresAt = keyData.validUntil ? Math.floor(new Date(keyData.validUntil).getTime() / 1000) : now + 3600;
      return this.searchKey;
    } catch (err) {
      console.error('[FanaticsClient] Failed to obtain Algolia search key:', err);
      throw err;
    }
  }

  /**
   * Performs an Algolia query against prod_item_state_v1.
   */
  async search(params: FanaticsCardQueryParams): Promise<FanaticsSearchResult> {
    const searchKey = await this.getSearchKey();
    const {
      query,
      status,
      marketplace,
      gradingService,
      grade,
      hitsPerPage = 20,
      page = 0,
    } = params;

    const facetFilters: string[] = [];
    if (status) {
      facetFilters.push(`status:${status}`);
    }
    if (marketplace) {
      facetFilters.push(`marketplace:${marketplace}`);
    }
    if (gradingService) {
      facetFilters.push(`gradingService:${gradingService}`);
    }
    if (grade !== undefined && grade !== null) {
      facetFilters.push(`grade:${grade}`);
    }

    const searchParams: Record<string, string> = {
      query,
      hitsPerPage: hitsPerPage.toString(),
      page: page.toString(),
    };

    if (facetFilters.length > 0) {
      searchParams.facetFilters = JSON.stringify(facetFilters);
    }

    const url = `https://${this.appId}-dsn.algolia.net/1/indexes/*/queries`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Algolia-Application-Id': this.appId,
        'X-Algolia-API-Key': searchKey,
      },
      body: JSON.stringify({
        requests: [
          {
            indexName: 'prod_item_state_v1',
            params: new URLSearchParams(searchParams).toString(),
          },
        ],
      }),
    });

    if (res.status === 403 || res.status === 401) {
      // Key expired, invalidate and retry once
      this.searchKey = null;
      this.keyExpiresAt = 0;
      return this.search(params);
    }

    if (!res.ok) {
      throw new Error(`Fanatics Algolia search failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const result = data.results?.[0];

    return {
      nbHits: result?.nbHits || 0,
      page: result?.page || 0,
      nbPages: result?.nbPages || 0,
      hitsPerPage: result?.hitsPerPage || hitsPerPage,
      hits: result?.hits || [],
    };
  }

  /**
   * Helper to build canonical URL for an item.
   */
  getItemUrl(hit: FanaticsHit): string {
    if (hit.marketplace === 'FIXED' && hit.listingUuid) {
      return `https://www.fanaticscollect.com/buy-now/${hit.listingUuid}`;
    }
    if (hit.listingId) {
      return `https://www.fanaticscollect.com/items/${hit.listingId}`;
    }
    return `https://www.fanaticscollect.com/marketplace?type=${hit.marketplace || 'FIXED'}`;
  }
}

export const fanaticsClient = new FanaticsClient();
