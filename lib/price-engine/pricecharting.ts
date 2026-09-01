import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import { getSharedBrowser } from './browser';
import { waitForSourceRateLimit } from './rate-limiter';
import type { MatchEvidence } from './identity';

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
 * True when some whitespace token of the title IS the card number.
 *
 * Compare token-wise, never as a substring: "E-01" normalises to "E01", which is
 * a prefix of "E01-09" -> "E0109", so substring matching would silently price a
 * card off a different one in its own set.
 *
 * Position varies by page — search rows end with the number ("Tsuru OP16-067")
 * while a product page puts it mid-heading ("Roronoa Zoro OP07-034 One Piece
 * Japanese 500 Years in the Future") — so match any token rather than the last.
 */
function titleHasNumberToken(rawTitle: string, wantedNumber: string): boolean {
  if (!wantedNumber) return false;
  return rawTitle.trim().split(/\s+/).some((t) => normalizeToken(t) === wantedNumber);
}

/** A bracketed qualifier ("[SP Gold]", "[Holo]") marks a specific printing, not the base card. */
function isQualifiedPrinting(rawTitle: string): boolean {
  return /\[[^\]]*\]/.test(rawTitle);
}

function parsePrice(text: string): number | undefined {
  const match = text.match(/([0-9.,]+)/);
  if (!match) return undefined;
  const value = parseFloat(match[1].replace(/,/g, ''));
  return Number.isNaN(value) || value <= 0 ? undefined : value;
}

function readGradedPrices($: cheerio.CheerioAPI): Record<string, number> {
  const gradedPrices: Record<string, number> = {};
  $('#full-prices tr, #price_data tr').each((_, row) => {
    const label = $(row).find('td.label').text().replace(/\s+/g, ' ').trim().toLowerCase();

    // Normalize common PriceCharting grade labels to our DB format
    let normalizedGrade: string | null = null;
    if (label === 'psa 10') normalizedGrade = 'psa10';
    else if (label === 'psa 9') normalizedGrade = 'psa9';
    else if (label === 'psa 8') normalizedGrade = 'psa8';
    else if (label === 'bgs 10') normalizedGrade = 'bgs10';
    else if (label === 'bgs 9.5') normalizedGrade = 'bgs9.5';
    else if (label === 'bgs 9') normalizedGrade = 'bgs9';
    else if (label === 'cgc 10') normalizedGrade = 'cgc10';
    else if (label === 'cgc 9.5') normalizedGrade = 'cgc9.5';
    else if (label === 'cgc 9') normalizedGrade = 'cgc9';

    if (!normalizedGrade || gradedPrices[normalizedGrade] !== undefined) return;

    const price = parsePrice($(row).find('td.price').text());
    if (price !== undefined) {
      gradedPrices[normalizedGrade] = price;
    }
  });
  return gradedPrices;
}

// Returns both raw and PSA 10 graded prices
export interface PriceChartingResult {
  price: number;
  gradedPrices?: Record<string, number>;
  evidence: MatchEvidence;
}

export interface PriceChartingCandidate {
  title: string;
  url: string;
  price?: number;
  gradedPrices?: Record<string, number>;
}

function readProductPage(
  $: cheerio.CheerioAPI,
  externalUrl: string,
  matchedBy: MatchEvidence['matchedBy'],
  wantedNumber?: string,
): PriceChartingResult | null {
  const heading = $('h1').first().text().trim();
  // Only reject bracketed variants if we are guessing from search results.
  // If explicitly mapped (cached-url), trust the URL.
  if (wantedNumber && matchedBy !== 'cached-url' && (!titleHasNumberToken(heading, wantedNumber) || isQualifiedPrinting(heading))) {
    return null;
  }

  const productPrice = parsePrice($('#used_price').find('.price').first().text());
  const externalSet = $('.console, .platform, .system, .set').first().text().trim() || undefined;

  // Graded prices from the explicit table
  const gradedPrices = readGradedPrices($);

  if (productPrice === undefined && Object.keys(gradedPrices).length === 0) {
    return null;
  }

  return {
    price: productPrice || 0, // Fallback to 0 if only graded prices exist
    ...(Object.keys(gradedPrices).length > 0 ? { gradedPrices } : {}),
    evidence: {
      externalTitle: heading,
      externalUrl,
      matchedBy,
      ...(externalSet ? { externalSet } : {}),
    },
  };
}

export async function fetchPriceChartingByAnchor(productUrl: string): Promise<PriceChartingResult | null> {
  let page;

  try {
    await waitForSourceRateLimit('pricecharting');

    const browser = await getSharedBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 1000));

    const html = await page.content();
    return readProductPage(cheerio.load(html), productUrl, 'cached-url');
  } catch (err) {
    console.error(`PriceCharting anchor fetch error for ${productUrl}:`, err);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
  return null;
}

export async function searchPriceChartingCandidates(query: string): Promise<PriceChartingCandidate[]> {
  let page;

  try {
    await waitForSourceRateLimit('pricecharting');

    const searchUrl = `https://www.pricecharting.com/search-products?type=prices&q=${encodeURIComponent(query.trim())}`;
    const browser = await getSharedBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 1000));

    const html = await page.content();
    const $ = cheerio.load(html);
    const results = $('table#games_table tbody tr');
    const pageUrl = page.url();

    if (results.length === 0) {
      const title = $('h1').first().text().trim();
      const price = parsePrice($('#used_price').find('.price').first().text());
      const gradedPrices = readGradedPrices($);

      return [{
        title,
        url: pageUrl,
        ...(price !== undefined ? { price } : {}),
        ...(Object.keys(gradedPrices).length > 0 ? { gradedPrices } : {}),
      }];
    }

    return results.toArray().map((row) => {
      const title = $(row).find('td.title a').text().trim();
      const href = $(row).find('td.title a').attr('href');
      const url = href ? new URL(href, pageUrl).toString() : pageUrl;
      const price = parsePrice($(row).find('td.price.used_price span.js-price').text());
      const psa10Price = parsePrice($(row).find('td.price.grade10_price span.js-price').text());

      return {
        title,
        url,
        ...(price !== undefined ? { price } : {}),
        ...(psa10Price !== undefined ? { gradedPrices: { psa10: psa10Price } } : {}),
      };
    });
  } catch (err) {
    console.error(`PriceCharting candidate search error for ${query}:`, err);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }

  return [];
}

export async function fetchPriceChartingPrice(query: string): Promise<PriceChartingResult | null> {
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

    let selectedResult: Element | null = null;
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

    // When the search has exactly one strong match, PriceCharting 302s straight to
    // the product page and there is no results table at all — so the selector below
    // found nothing and we discarded a price. That is the *most* reliable case:
    // "OP07-034 japanese" redirects to a page quoting $1.59 while the table parser
    // sees zero rows. Verify the heading names our number, then read it directly.
    //
    // The graded price is taken from the product page only when a cell is
    // explicitly labelled "PSA 10" (see readProductPage) — the positional grade
    // tiers are never guessed, which would recreate exactly the mislabelling
    // this function exists to prevent.
    if (results.length === 0) {
      return readProductPage(cheerio.load(html), page.url(), 'search', wantedNumber);
    }

    results.each((_, el) => {
      if (selectedResult) return;
      const rawTitle = $(el).find('td.title a').text().trim();

      if (!titleHasNumberToken(rawTitle, wantedNumber)) return;
      if (isQualifiedPrinting(rawTitle)) return; // a specific printing, not the base card

      selectedResult = el;
    });

    if (!selectedResult) return null;

    let rawPrice: number | undefined;
    const gradedPrices: Record<string, number> = {};

    // Extract Ungraded / Raw Price
    const priceText = $(selectedResult).find('td.price.used_price span.js-price').text();
    if (priceText) {
      const match = priceText.match(/([0-9.,]+)/);
      if (match) {
        const p = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(p) && p > 0) rawPrice = p;
      }
    }

    // Extract PSA 10 (Grade 10) Price from search table
    const psaText = $(selectedResult).find('td.price.grade10_price span.js-price').text();
    if (psaText) {
      const match = psaText.match(/([0-9.,]+)/);
      if (match) {
        const p = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(p) && p > 0) gradedPrices.psa10 = p;
      }
    }

    if (rawPrice !== undefined) {
      const rawTitle = $(selectedResult).find('td.title a').text().trim();
      const href = $(selectedResult).find('td.title a').attr('href');
      const externalSet = $(selectedResult).find('td.console, td.platform, td.system, td.set').text().trim() || undefined;
      const externalUrl = href ? new URL(href, 'https://www.pricecharting.com').toString() : undefined;
      return {
        price: rawPrice,
        ...(Object.keys(gradedPrices).length > 0 ? { gradedPrices } : {}),
        evidence: {
          externalTitle: rawTitle,
          externalUrl,
          externalSet,
          matchedBy: 'search',
        },
      };
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
