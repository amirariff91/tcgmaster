const DEFAULT_CATEGORY_ID = 68; // One Piece
const DBFW_CATEGORY_ID = 80;

let cachedGroups: Record<number, any[]> = {};
const cachedProducts: Record<number, any[]> = {};
const cachedPrices: Record<number, any[]> = {};

async function getGroups(categoryId: number) {
  if (cachedGroups[categoryId]) return cachedGroups[categoryId];
  const res = await fetch(`https://tcgcsv.com/tcgplayer/${categoryId}/groups`, {
    headers: { 'User-Agent': 'curl/8.4.0' }
  });
  const data = await res.json();
  cachedGroups[categoryId] = data.results || [];
  return cachedGroups[categoryId];
}

async function getProducts(categoryId: number, groupId: number) {
  if (cachedProducts[groupId]) return cachedProducts[groupId];
  const res = await fetch(`https://tcgcsv.com/tcgplayer/${categoryId}/${groupId}/products`, {
    headers: { 'User-Agent': 'curl/8.4.0' }
  });
  const data = await res.json();
  cachedProducts[groupId] = data.results || [];
  return cachedProducts[groupId];
}

async function getPrices(categoryId: number, groupId: number) {
  if (cachedPrices[groupId]) return cachedPrices[groupId];
  const res = await fetch(`https://tcgcsv.com/tcgplayer/${categoryId}/${groupId}/prices`, {
    headers: { 'User-Agent': 'curl/8.4.0' }
  });
  const data = await res.json();
  cachedPrices[groupId] = data.results || [];
  return cachedPrices[groupId];
}

function matchVariant(products: any[], baseNumber: string, suffix: string) {
  // First, filter by the card number in extendedData
  const matchedNumber = products.filter(p => {
    const numData = p.extendedData?.find((d: any) => d.name === 'Number');
    return numData && numData.value === baseNumber;
  });

  if (matchedNumber.length === 0) return null;
  if (matchedNumber.length === 1 && !suffix) return matchedNumber[0]; // Only auto-match base cards

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

export async function fetchEnglishPrice(query: string, setName?: string, existingTcgProductId?: string, categoryId: number = DEFAULT_CATEGORY_ID): Promise<{ price: number, tcgProductId: number, tcgProductName: string } | null> {
  try {
    const groups = await getGroups(categoryId);

    // NEW: Check static dictionary for variants to guarantee no mismatches
    let mappedTcgId = existingTcgProductId;
    if (!mappedTcgId) {
      try {
        const dictPath = require('path').resolve(process.cwd(), 'lib/price-engine/mapping-dictionary.json');
        const dict = JSON.parse(require('fs').readFileSync(dictPath, 'utf8'));
        const slugKey = query.toLowerCase().startsWith('op-') ? query.toLowerCase() : `op-${query.toLowerCase()}`;
        if (dict[query]) {
          mappedTcgId = String(dict[query]);
        } else if (dict[slugKey]) {
          mappedTcgId = String(dict[slugKey]);
        }
      } catch(e) {
        // ignore if not exists
      }
    }

    // 1. Direct fetch if existing ID is known
    if (mappedTcgId) {
      const numericId = parseInt(mappedTcgId, 10);
      if (!isNaN(numericId)) {
        // If we know the ID, we don't know the exact group, but we can search products?
        let foundGroupId = null;
        let productMatch = null;
        if (groups) {
          for (const g of groups) {
             const products = await getProducts(categoryId, g.groupId);
             const p = products.find(p => p.productId === numericId);
             if (p) {
               foundGroupId = g.groupId;
               productMatch = p;
               break;
             }
          }
        }
        if (foundGroupId && productMatch) {
          const prices = await getPrices(categoryId, foundGroupId);
          const priceData = prices.find(p => p.productId === numericId);
          if (priceData && priceData.marketPrice) {
            return { price: priceData.marketPrice, tcgProductId: numericId, tcgProductName: productMatch.name };
          }
          return null;
        }
      }
    }

    let suffix = '';
    let baseQuery = query;
    if (query.includes('_')) {
      [baseQuery, suffix] = query.split('_');
    }
    
    let groupMatch = null;

    if (setName) {
      const GROUP_ALIASES: Record<string, string> = {
        'the best': 'premium booster -the best-',
        'one piece card the best': 'premium booster -the best-'
      };
      
      const cleanSetName = setName.split(':').pop()?.trim().toLowerCase() || setName.toLowerCase();
      const aliasedName = GROUP_ALIASES[cleanSetName] || cleanSetName;
      
      groupMatch = groups?.find(g => aliasedName.includes(g.name.toLowerCase()) || g.name.toLowerCase().includes(aliasedName));
    }

    if (!groupMatch) {
      const prefixMatch = baseQuery.match(/^([A-Z]+[0-9]+)-/);
      if (prefixMatch) {
        const abbr = prefixMatch[1];
        groupMatch = groups?.find(g => g.abbreviation === abbr || g.abbreviation?.includes(abbr));
      }
    }

    let product = null;
    let foundGroupId = null;

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
      return { price: priceData.marketPrice, tcgProductId: product.productId, tcgProductName: product.name };
    }

  } catch (err) {
    console.error(`TCGCSV fetch error for ${query}:`, err);
  }
  return null;
}
