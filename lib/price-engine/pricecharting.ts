import * as cheerio from 'cheerio';
import { getSharedBrowser } from './browser';
import { waitForSourceRateLimit } from './rate-limiter';

/** Strip punctuation/spacing so "OP16-067" and "Tsuru OP16-067" compare cleanly. */
function normalizeToken(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Variant printings use BOTH separators in this catalogue: One Piece writes
 * "OP05-119_p4" and Dragon Ball writes "E01-08-p1" (919 cards). Splitting on "_"
 * alone let every dash variant through to the matcher.
 */
const VARIANT_SUFFIX = /[-_][pr]\d+$/i;

/**
 * PriceCharting titles end with the card number ("Tsuru OP16-067", "Krillin
 * [Holo] FB01-008"), so compare against that trailing token rather than testing
 * for a substring anywhere in the title. Substring matching has no boundary:
 * "E-01" normalises to "E01", which is a prefix of "E01-09" -> "E0109", so a
 * card would silently price off a different one in the same set.
 */
function titleNumberMatches(rawTitle: string, wantedNumber: string): boolean {
  if (!wantedNumber) return false;
  const tokens = rawTitle.trim().split(/\s+/);
  const last = tokens[tokens.length - 1] ?? '';
  return normalizeToken(last) === wantedNumber;
}

// Returns both raw and PSA 10 graded prices
export async function fetchPriceChartingPrice(query: string): Promise<{ price: number; gradedPrice?: number } | null> {
  let page;

  // The number is the leading token; callers may append a qualifier
  // ("FB01-001 japanese"). Strip that before testing for a variant suffix.
  const [numberToken = '', ...restTokens] = query.trim().split(/\s+/);
  const isVariant = VARIANT_SUFFIX.test(numberToken);

  // Variant printings cannot be mapped onto PriceCharting's naming reliably —
  // see the note below. Bail before the rate-limit wait and the Puppeteer page
  // load rather than scraping ~7,200 variant cards to discard the result.
  if (isVariant) return null;

  const baseQuery = [numberToken, ...restTokens].join(' ');

  try {
    await waitForSourceRateLimit('pricecharting');

    const searchUrl = `https://www.pricecharting.com/search-products?type=prices&q=${encodeURIComponent(baseQuery)}`;
    
    const browser = await getSharedBrowser();
    page = await browser.newPage();
    
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 1000));
    
    const html = await page.content();
    const $ = cheerio.load(html);
    
    let selectedResult: any = null;
    const results = $('table#games_table tbody tr');

    // PriceCharting's search is fuzzy, and matching it by keyword guesswork put
    // wildly wrong prices on ~2,000 cards. Two distinct failures, both fixed here:
    //
    // 1. Wrong card entirely. Searching "OP16-067" returns "Charlotte Katakuri
    //    [SP Foil] OP11-067" ($127.65) first and the real "Tsuru OP16-067" ($0.24)
    //    third. Three unrelated "-119" cards all ended up sharing one $10,545.17.
    //    -> the row must actually name the number we asked for.
    //
    // 2. Wrong printing of the right card. OP05-119 has 21 printings listed,
    //    $4.70 to $10,545.17, every one of them titled "... OP05-119". The old
    //    suffix heuristics matched 'sp' as a substring, so every _p2/_p3/_p4
    //    variant grabbed "[SP Gold]" at $10,545.17.
    //    -> a base card is the printing with no bracketed qualifier, which lands
    //       at $13.71 against TCGPlayer's $11.41. A _pN/_rN variant has no
    //       reliable mapping onto PriceCharting's naming ([SP Gold], [Wanted],
    //       [Manga PRB01], [2nd Anniversary]...), so we decline rather than guess
    //       — the same rule tcgcsv.ts already applies to TCGPlayer variants.
    //
    // Returning null costs a price; returning the wrong one misprices the card.
    const wantedNumber = normalizeToken(numberToken);

    results.each((_, el) => {
      if (selectedResult) return;
      const rawTitle = $(el).find('td.title a').text().trim();

      if (!titleNumberMatches(rawTitle, wantedNumber)) return;
      if (/\[[^\]]*\]/.test(rawTitle)) return; // a qualified printing, not the base card

      selectedResult = el;
    });

    if (!selectedResult) return null;
    
    let rawPrice: number | undefined;
    let gradedPrice: number | undefined;

    // Extract Ungraded / Raw Price
    const priceText = $(selectedResult).find('td.price.used_price span.js-price').text();
    if (priceText) {
      const match = priceText.match(/([0-9.,]+)/);
      if (match) {
        const p = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(p) && p > 0) rawPrice = p;
      }
    }

    // Extract PSA 10 (Grade 10) Price
    const psaText = $(selectedResult).find('td.price.grade10_price span.js-price').text();
    if (psaText) {
      const match = psaText.match(/([0-9.,]+)/);
      if (match) {
        const p = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(p) && p > 0) gradedPrice = p;
      }
    }

    if (rawPrice !== undefined) {
      return { price: rawPrice, gradedPrice };
    }

  } catch (err) {
    console.error(`PriceCharting fetch error for ${query}:`, err);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
  return null;
}
