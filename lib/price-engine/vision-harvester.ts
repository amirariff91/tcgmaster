import 'dotenv/config';

export interface CandidateProduct {
  source: 'snkrdunk' | 'yuyutei' | 'pricecharting' | 'tcgplayer';
  productId: string;
  name: string;
  imageUrl: string;
  price?: number;
  url: string;
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

type JsonRecord = Record<string, unknown>;

function asRecords(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => typeof item === 'object' && item !== null && !Array.isArray(item))
    : [];
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '');
}

/**
 * Harvest candidate products across all 4 sources for a base card number (e.g. OP05-119)
 */
export async function harvestCandidatesForCard(cardNumber: string): Promise<Record<string, CandidateProduct[]>> {
  const baseNumber = cardNumber.split('_')[0].trim().toUpperCase();
  const results: Record<string, CandidateProduct[]> = {
    snkrdunk: [],
    yuyutei: [],
    pricecharting: [],
    tcgplayer: [],
  };

  // 1. Harvest Snkrdunk candidates
  try {
    const snkrdunkUrl = `https://snkrdunk.com/en/v1/brands/onepiece/streetwears?perPage=20&page=1&department=tradingCard&keyword=${encodeURIComponent(baseNumber)}`;
    const res = await fetch(snkrdunkUrl, { headers: HEADERS });
    if (res.ok) {
      const data = await res.json() as JsonRecord;
      const items = asRecords(data.streetwears ?? data.products);
      results.snkrdunk = items.map((it) => ({
        source: 'snkrdunk' as const,
        productId: asString(it.id),
        name: asString(it.name),
        imageUrl: asString(it.imageUrl ?? it.smallImageUrl),
        price: it.minPrice ? Number(it.minPrice) : undefined,
        url: `https://snkrdunk.com/en/trading-cards/${asString(it.id)}`,
      }));
    }
  } catch {}

  // 2. Harvest PriceCharting candidates
  try {
    const pcUrl = `https://www.pricecharting.com/api/products?t=${process.env.PRICECHARTING_API_KEY || ''}&q=${encodeURIComponent('One Piece ' + baseNumber)}`;
    const res = await fetch(pcUrl, { headers: HEADERS });
    if (res.ok) {
      const data = await res.json() as JsonRecord;
      const items = asRecords(data.products);
      results.pricecharting = items.map((it) => ({
        source: 'pricecharting' as const,
        productId: asString(it.id),
        name: asString(it['product-name']),
        imageUrl: asString(it['image-url']),
        price: it['loose-price'] ? Number(it['loose-price']) / 100 : undefined,
        url: `https://www.pricecharting.com/game/one-piece-japanese/${asString(it.id)}`,
      }));
    }
  } catch {}

  // 3. Harvest TCGPlayer candidates via tcgcsv
  try {
    const groupsRes = await fetch('https://tcgcsv.com/tcgplayer/68/groups', { headers: HEADERS });
    if (groupsRes.ok) {
      const groupsPayload = await groupsRes.json() as JsonRecord;
      const groups = asRecords(groupsPayload.results);
      for (const g of groups.slice(0, 5)) {
        const prodRes = await fetch(`https://tcgcsv.com/tcgplayer/68/${asString(g.groupId)}/products`, { headers: HEADERS });
        if (prodRes.ok) {
          const productsPayload = await prodRes.json() as JsonRecord;
          const products = asRecords(productsPayload.results);
          const matches = products.filter((p) => {
            const numberData = asRecords(p.extendedData).find((d) => d.name === 'Number');
            const num = typeof numberData?.value === 'string' ? numberData.value : '';
            return num.toUpperCase() === baseNumber;
          });
          matches.forEach((p) => {
            results.tcgplayer.push({
              source: 'tcgplayer',
              productId: asString(p.productId),
              name: asString(p.name),
              imageUrl: asString(p.imageUrl),
              url: `https://www.tcgplayer.com/product/${asString(p.productId)}`,
            });
          });
        }
      }
    }
  } catch {}

  return results;
}
