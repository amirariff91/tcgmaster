/**
 * Universal Marketplace URL Resolver
 *
 * Ensures 100% of compared price sources have a verified, clickable destination URL
 * with an ExternalLink icon so users can check if the source is correct.
 */

export interface CardSourceInfo {
  id: string;
  name: string;
  number: string;
  slug: string;
  gameSlug?: string;
  tcgPlayerId?: string | number | null;
}

export function buildFallbackSourceUrl(source: string, card: CardSourceInfo): string | null {
  const cleanNumber = (card.number || '').trim();
  const baseNumber = cleanNumber.split('_')[0].trim();
  const cleanName = (card.name || '').replace(/\(.*\)/g, '').trim();

  switch (source.toLowerCase()) {
    case 'tcgplayer':
      if (card.tcgPlayerId) {
        return `https://www.tcgplayer.com/product/${card.tcgPlayerId}`;
      }
      return `https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(cleanNumber || cleanName)}`;

    case 'pricecharting':
      return `https://www.pricecharting.com/search-products?q=${encodeURIComponent(`${baseNumber} ${cleanName}`.trim())}&type=prices`;

    case 'tcgrepublic':
      return `https://tcgrepublic.com/product/text_search.html?q=${encodeURIComponent(cleanNumber || baseNumber)}`;

    case 'snkrdunk':
      return `https://snkrdunk.com/en/search/result?keyword=${encodeURIComponent(cleanNumber || baseNumber)}`;

    case 'yuyutei':
      if (card.gameSlug === 'one-piece') {
        return `https://yuyu-tei.jp/sell/opc/s/search?search_word=${encodeURIComponent(baseNumber)}`;
      }
      return `https://yuyu-tei.jp/sell/poc/s/search?search_word=${encodeURIComponent(baseNumber)}`;

    case 'cardrush':
      if (card.gameSlug === 'dbfw' || card.gameSlug === 'dragon-ball') {
        return `https://www.cardrush-db.jp/product-list?keyword=${encodeURIComponent(baseNumber)}`;
      }
      return `https://www.cardrush-pokemon.jp/product-list?keyword=${encodeURIComponent(baseNumber)}`;

    case 'fanatics':
      return `https://www.fanaticscollect.com/search?q=${encodeURIComponent(`${cleanName} ${baseNumber}`.trim())}`;

    case 'alt':
      return `https://app.alt.xyz/browse/all?query=${encodeURIComponent(`${cleanName} ${baseNumber}`.trim())}`;

    case 'ebay':
      return `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`${cleanName} ${cleanNumber}`.trim())}`;

    case 'carousell_my':
    case 'carousell':
      return `https://www.carousell.com.my/search/${encodeURIComponent(`${cleanName} ${baseNumber}`.trim())}`;

    default:
      return null;
  }
}

/**
 * Resolves the best URL for a source:
 * 1. Prioritizes exact stored product/listing URL if present.
 * 2. Falls back to a deterministic, canonical search URL on that marketplace.
 */
export function resolveSourceUrl(
  source: string,
  storedUrl: string | null | undefined,
  card: CardSourceInfo
): string | null {
  if (storedUrl && storedUrl.startsWith('http')) {
    return storedUrl;
  }
  return buildFallbackSourceUrl(source, card);
}
