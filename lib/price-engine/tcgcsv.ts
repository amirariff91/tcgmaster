import { parseCardNumber } from './card-number';
import type { MatchEvidence } from './identity';

const DEFAULT_CATEGORY_ID = 68; // One Piece

interface TcgExtendedData {
  name: string;
  value: string;
}

interface TcgProduct {
  productId: number;
  name: string;
  extendedData?: TcgExtendedData[];
}

interface TcgGroup {
  groupId: number;
  name: string;
  abbreviation?: string;
}

interface TcgPrice {
  productId: number;
  marketPrice?: number;
}

const cachedGroups: Record<number, TcgGroup[]> = {};
const cachedProducts: Record<number, TcgProduct[]> = {};
const cachedPrices: Record<number, TcgPrice[]> = {};

async function getGroups(categoryId: number): Promise<TcgGroup[]> {
  if (cachedGroups[categoryId]) return cachedGroups[categoryId];
  const res = await fetch(`https://tcgcsv.com/tcgplayer/${categoryId}/groups`, {
    headers: { 'User-Agent': 'curl/8.4.0' }
  });
  const data = await res.json();
  cachedGroups[categoryId] = data.results || [];
  return cachedGroups[categoryId];
}

async function getProducts(categoryId: number, groupId: number): Promise<TcgProduct[]> {
  if (cachedProducts[groupId]) return cachedProducts[groupId];
  const res = await fetch(`https://tcgcsv.com/tcgplayer/${categoryId}/${groupId}/products`, {
    headers: { 'User-Agent': 'curl/8.4.0' }
  });
  const data = await res.json();
  cachedProducts[groupId] = data.results || [];
  return cachedProducts[groupId];
}

async function getPrices(categoryId: number, groupId: number): Promise<TcgPrice[]> {
  if (cachedPrices[groupId]) return cachedPrices[groupId];
  const res = await fetch(`https://tcgcsv.com/tcgplayer/${categoryId}/${groupId}/prices`, {
    headers: { 'User-Agent': 'curl/8.4.0' }
  });
  const data = await res.json();
  cachedPrices[groupId] = data.results || [];
  return cachedPrices[groupId];
}

function matchVariant(products: TcgProduct[], baseNumber: string, suffix: string): TcgProduct | null {
  // First, filter by the card number in extendedData
  const matchedNumber = products.filter(p => {
    const numData = p.extendedData?.find((d) => d.name === 'Number');
    return numData && numData.value === baseNumber;
  });

  if (matchedNumber.length === 0) return null;
  if (matchedNumber.length === 1 && !suffix) {
    const text = matchedNumber[0].name.toLowerCase();
    const isBasePrinting = !text.includes('alternate art')
      && !text.includes('parallel')
      && !text.includes('manga')
      && !text.includes('flagship')
      && !text.includes('serial')
      && !text.includes('treasure')
      && !text.includes('sp')
      && !text.includes('wanted poster');
    return isBasePrinting ? matchedNumber[0] : null;
  }

  // If there are multiple versions or it's a variant (has suffix), we REFUSE to guess.
  // We must rely strictly on the explicit mapping-dictionary.json for variants
  // to prevent locking in the wrong RM200 price for a RM4k card.
  if (suffix) {
    return null; // Force failure. Will only succeed if explicitly mapped via dictionary.
  }

  // Base version strict fallback (only if no suffix)
  let selected = null;
  for (const p of matchedNumber) {
    const text = p.name.toLowerCase();
    if (!text.includes('alternate art') && !text.includes('parallel') && !text.includes('manga') && !text.includes('flagship') && !text.includes('serial') && !text.includes('treasure') && !text.includes('sp') && !text.includes('wanted poster')) {
      selected = p;
      break;
    }
  }

  return selected;
}

export interface EnglishPriceResult {
  price: number;
  tcgProductId: number;
  tcgProductName: string;
  evidence: MatchEvidence;
}

function productEvidence(
  product: TcgProduct,
  matchedBy: MatchEvidence['matchedBy'],
  externalSet?: string,
): MatchEvidence {
  const numberData = product.extendedData?.find((data) => data.name === 'Number');
  const productNumber = numberData?.value ? String(numberData.value) : '';
  return {
    externalId: product.productId ? String(product.productId) : undefined,
    // TCGCSV exposes the card number in extendedData rather than its URL. Keep
    // the scraped name and that identity field together in the evidence title.
    externalTitle: [product.name, productNumber].filter(Boolean).join(' '),
    externalSet,
    matchedBy,
  };
}

export async function fetchEnglishPrice(query: string, setName?: string, existingTcgProductId?: string, categoryId: number = DEFAULT_CATEGORY_ID): Promise<EnglishPriceResult | null> {
  try {
    const groups = await getGroups(categoryId);

    let mappedTcgId = existingTcgProductId;

    // 1. Direct fetch if existing ID is known
    if (mappedTcgId) {
      const numericId = parseInt(mappedTcgId, 10);
      if (!isNaN(numericId)) {
        // If we know the ID, we don't know the exact group, but we can search products?
        let foundGroupId: number | null = null;
        let productMatch: TcgProduct | null = null;
        let productGroupName: string | undefined;
        if (groups) {
          for (const g of groups) {
             const products = await getProducts(categoryId, g.groupId);
             const p = products.find(p => p.productId === numericId);
             if (p) {
               foundGroupId = g.groupId;
               productMatch = p;
               productGroupName = g.name;
               break;
             }
          }
        }
        if (foundGroupId && productMatch) {
          const prices = await getPrices(categoryId, foundGroupId);
          const priceData = prices.find(p => p.productId === numericId);
          if (priceData && priceData.marketPrice) {
            return {
              price: priceData.marketPrice,
              tcgProductId: numericId,
              tcgProductName: productMatch.name,
              evidence: productEvidence(
                productMatch,
                'product-id',
                productGroupName,
              ),
            };
          }
          return null;
        }
      }
    }

    const parsedQuery = parseCardNumber(query);
    const baseQuery = parsedQuery.base;
    const suffix = parsedQuery.suffix ?? '';
    
    let groupMatch: TcgGroup | null = null;

    if (setName) {
      const GROUP_ALIASES: Record<string, string> = {
        'the best': 'premium booster -the best-',
        'one piece card the best': 'premium booster -the best-'
      };
      
      const cleanSetName = setName.split(':').pop()?.trim().toLowerCase() || setName.toLowerCase();
      const aliasedName = GROUP_ALIASES[cleanSetName] || cleanSetName;
      
      groupMatch = groups.find(g => aliasedName.includes(g.name.toLowerCase()) || g.name.toLowerCase().includes(aliasedName)) ?? null;
    }

    if (!groupMatch) {
      const prefixMatch = baseQuery.match(/^([A-Z]+[0-9]+)-/);
      if (prefixMatch) {
        const abbr = prefixMatch[1];
        groupMatch = groups.find(g => g.abbreviation === abbr || g.abbreviation?.includes(abbr)) ?? null;
      }
    }

    let product: TcgProduct | null = null;
    let foundGroupId: number | null = null;

    if (groupMatch) {
      const products = await getProducts(categoryId, groupMatch.groupId);
      product = matchVariant(products, baseQuery, suffix);
      if (product) foundGroupId = groupMatch.groupId;
    }

    if (!product && groups && !groupMatch) {
      for (const g of groups) {
        if (product) break;
        const products = await getProducts(categoryId, g.groupId);
        product = matchVariant(products, baseQuery, suffix);
        if (product) foundGroupId = g.groupId;
      }
    }

    if (!product || !foundGroupId) return null;

    const prices = await getPrices(categoryId, foundGroupId);
    const priceData = prices.find(p => p.productId === product.productId);

    if (priceData && priceData.marketPrice) {
      return {
        price: priceData.marketPrice,
        tcgProductId: product.productId,
        tcgProductName: product.name,
        evidence: productEvidence(product, 'search', groupMatch?.name),
      };
    }

  } catch (err) {
    console.error(`TCGCSV fetch error for ${query}:`, err);
  }
  return null;
}

export async function fetchTcgplayerByAnchor(
  externalId: string,
  categoryId: number = DEFAULT_CATEGORY_ID,
): Promise<EnglishPriceResult | null> {
  if (!externalId.trim()) throw new Error('TCGPlayer anchor must be a non-empty product ID');
  return fetchEnglishPrice('', undefined, externalId, categoryId);
}
