/**
 * PSA Certificate Verification Scraper
 * Scrapes PSA cert data from psa.com/cert/[number]
 */

import { dbQuery } from '@/lib/db/client';
import { redis, CACHE_KEYS, CACHE_TTL } from '@/lib/redis/client';

// Type definitions for database query results
interface CompanyIdRow {
  id: string;
}

interface CardIdRow {
  id: string;
}

interface CertHistoryRow {
  cert_number: string;
  grade: number;
  cert_date: string | null;
  holder_generation: string | null;
  holder_type: string | null;
  is_reholder: boolean;
  previous_cert_number: string | null;
  raw_data: Partial<PSACertData> | null;
  scraped_at: string;
  is_verified: boolean;
  grading_company_slug: string;
}

export interface PSACertData {
  certNumber: string;
  grade: number;
  cardDescription: string;
  year: string | null;
  brand: string | null;
  sport: string | null;
  cardNumber: string | null;
  variety: string | null;
  certDate: string | null;
  holderGeneration: string | null;
  isReholder: boolean;
  previousCertNumber: string | null;
  imageUrl: string | null;
  labelType: 'standard' | 'tuxedo' | 'dna' | 'pop-century' | null;
  scrapedAt: string;
  isValid: boolean;
  error?: string;
}

const PSA_CERT_URL = 'https://www.psacard.com/cert';

/**
 * Lookup a PSA certificate by number
 */
export async function lookupPSACert(certNumber: string): Promise<PSACertData | null> {
  // Validate cert number format
  const cleanCertNumber = certNumber.replace(/\D/g, '');
  if (!cleanCertNumber || cleanCertNumber.length < 6) {
    return {
      certNumber: cleanCertNumber,
      grade: 0,
      cardDescription: '',
      year: null,
      brand: null,
      sport: null,
      cardNumber: null,
      variety: null,
      certDate: null,
      holderGeneration: null,
      isReholder: false,
      previousCertNumber: null,
      imageUrl: null,
      labelType: null,
      scrapedAt: new Date().toISOString(),
      isValid: false,
      error: 'Invalid certificate number format',
    };
  }

  const cacheKey = CACHE_KEYS.cert(cleanCertNumber, 'psa');

  // Check cache first
  const cached = await redis.get<PSACertData>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const url = `${PSA_CERT_URL}/${cleanCertNumber}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TCGMaster/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          certNumber: cleanCertNumber,
          grade: 0,
          cardDescription: '',
          year: null,
          brand: null,
          sport: null,
          cardNumber: null,
          variety: null,
          certDate: null,
          holderGeneration: null,
          isReholder: false,
          previousCertNumber: null,
          imageUrl: null,
          labelType: null,
          scrapedAt: new Date().toISOString(),
          isValid: false,
          error: 'Certificate not found',
        };
      }
      throw new Error(`PSA lookup failed: ${response.status}`);
    }

    const html = await response.text();
    const certData = parsePSACertHtml(html, cleanCertNumber);

    if (certData.isValid) {
      // Cache valid results
      await redis.set(cacheKey, certData, { ex: CACHE_TTL.cert });

      // Store in database
      await storeCertData(certData);
    }

    return certData;
  } catch (error) {
    console.error('PSA cert lookup error:', error);
    return {
      certNumber: cleanCertNumber,
      grade: 0,
      cardDescription: '',
      year: null,
      brand: null,
      sport: null,
      cardNumber: null,
      variety: null,
      certDate: null,
      holderGeneration: null,
      isReholder: false,
      previousCertNumber: null,
      imageUrl: null,
      labelType: null,
      scrapedAt: new Date().toISOString(),
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Parse PSA certificate HTML
 */
function parsePSACertHtml(html: string, certNumber: string): PSACertData {
  // In production, use a proper HTML parser like cheerio
  // This is a simplified pattern-matching approach

  const result: PSACertData = {
    certNumber,
    grade: 0,
    cardDescription: '',
    year: null,
    brand: null,
    sport: null,
    cardNumber: null,
    variety: null,
    certDate: null,
    holderGeneration: null,
    isReholder: false,
    previousCertNumber: null,
    imageUrl: null,
    labelType: null,
    scrapedAt: new Date().toISOString(),
    isValid: false,
  };

  // Check if page contains "Certificate not found" or similar
  if (html.includes('Certificate not found') || html.includes('No results')) {
    result.error = 'Certificate not found';
    return result;
  }

  // Extract grade (common patterns)
  const gradeMatch = html.match(/Grade[:\s]*<[^>]*>([^<]+)<|PSA\s+(\d+(?:\.\d+)?)/i);
  if (gradeMatch) {
    result.grade = parseFloat(gradeMatch[1] || gradeMatch[2]);
  }

  // Extract card description
  const descMatch = html.match(/Description[:\s]*<[^>]*>([^<]+)</i);
  if (descMatch) {
    result.cardDescription = descMatch[1].trim();
  }

  // Extract year
  const yearMatch = html.match(/Year[:\s]*<[^>]*>(\d{4})</i);
  if (yearMatch) {
    result.year = yearMatch[1];
  }

  // Extract brand
  const brandMatch = html.match(/Brand[:\s]*<[^>]*>([^<]+)</i);
  if (brandMatch) {
    result.brand = brandMatch[1].trim();
  }

  // Extract card number
  const cardNumMatch = html.match(/Card\s*#?[:\s]*<[^>]*>([^<]+)</i);
  if (cardNumMatch) {
    result.cardNumber = cardNumMatch[1].trim();
  }

  // Extract variety/variant
  const varietyMatch = html.match(/Variety[:\s]*<[^>]*>([^<]+)</i);
  if (varietyMatch) {
    result.variety = varietyMatch[1].trim();
  }

  // Extract cert date
  const dateMatch = html.match(/Date[:\s]*<[^>]*>(\d{1,2}\/\d{1,2}\/\d{4})</i);
  if (dateMatch) {
    result.certDate = dateMatch[1];
  }

  // Check for reholder indicators
  result.isReholder = html.includes('Reholder') || html.includes('re-holder');

  // Extract image URL
  const imgMatch = html.match(/card-image[^"]*"([^"]+)"|src="([^"]+\.(?:jpg|png|jpeg))"/i);
  if (imgMatch) {
    result.imageUrl = imgMatch[1] || imgMatch[2];
  }

  // Detect label type
  if (html.includes('tuxedo')) {
    result.labelType = 'tuxedo';
  } else if (html.includes('DNA')) {
    result.labelType = 'dna';
  } else {
    result.labelType = 'standard';
  }

  // Determine holder generation from cert number range
  result.holderGeneration = getHolderGeneration(certNumber);

  // Mark as valid if we found essential data
  if (result.grade > 0 || result.cardDescription) {
    result.isValid = true;
  }

  return result;
}

/**
 * Determine PSA holder generation from cert number
 */
function getHolderGeneration(certNumber: string): string {
  const num = parseInt(certNumber, 10);

  // These ranges are approximate and based on historical data
  if (num < 10000000) {
    return 'Gen 1/2 (Pre-2006)';
  } else if (num < 25000000) {
    return 'Gen 3 (2006-2014)';
  } else if (num < 45000000) {
    return 'Gen 4 (2014-2019)';
  } else if (num < 70000000) {
    return 'Gen 5 (2019-2022)';
  } else {
    return 'Gen 6 (2022+)';
  }
}

/**
 * Store cert data in database
 */
async function storeCertData(certData: PSACertData): Promise<void> {
  // Get PSA grading company ID
  const companyRows = await dbQuery(
    `SELECT id FROM grading_companies WHERE slug = $1 LIMIT 1`,
    ['psa'],
  ) as CompanyIdRow[];
  const company = companyRows[0] ?? null;

  if (!company) return;

  // Try to match to a card in our database
  let cardId: string | null = null;
  if (certData.cardDescription) {
    const cardRows = await dbQuery(
      `SELECT id
       FROM cards
       WHERE name ILIKE $1
       LIMIT 1`,
      [`%${certData.cardDescription.split(' ').slice(0, 2).join(' ')}%`],
    ) as CardIdRow[];
    const card = cardRows[0] ?? null;
    cardId = card?.id || null;
  }

  // Upsert cert history
  await dbQuery(
    `INSERT INTO cert_history (
       cert_number, grading_company_id, card_id, grade, cert_date, holder_generation,
       holder_type, is_reholder, previous_cert_number, is_verified, last_verified_at,
       raw_data, scraped_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10, $11::jsonb, $12)
     ON CONFLICT (cert_number, grading_company_id) DO UPDATE SET
       card_id = EXCLUDED.card_id,
       grade = EXCLUDED.grade,
       cert_date = EXCLUDED.cert_date,
       holder_generation = EXCLUDED.holder_generation,
       holder_type = EXCLUDED.holder_type,
       is_reholder = EXCLUDED.is_reholder,
       previous_cert_number = EXCLUDED.previous_cert_number,
       is_verified = EXCLUDED.is_verified,
       last_verified_at = EXCLUDED.last_verified_at,
       raw_data = EXCLUDED.raw_data,
       scraped_at = EXCLUDED.scraped_at`,
    [
      certData.certNumber,
      company.id,
      cardId,
      certData.grade,
      certData.certDate,
      certData.holderGeneration,
      certData.labelType,
      certData.isReholder,
      certData.previousCertNumber,
      new Date().toISOString(),
      JSON.stringify(certData),
      certData.scrapedAt,
    ],
  );
}

/**
 * Batch lookup multiple cert numbers
 */
export async function batchLookupPSACerts(
  certNumbers: string[],
  options?: {
    concurrency?: number;
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<Map<string, PSACertData>> {
  const concurrency = options?.concurrency ?? 3;
  const results = new Map<string, PSACertData>();

  for (let i = 0; i < certNumbers.length; i += concurrency) {
    const batch = certNumbers.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map((certNumber) => lookupPSACert(certNumber))
    );

    batchResults.forEach((result, index) => {
      if (result) {
        results.set(batch[index], result);
      }
    });

    options?.onProgress?.(Math.min(i + concurrency, certNumbers.length), certNumbers.length);

    // Rate limiting - wait between batches
    if (i + concurrency < certNumbers.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Get cert data from database
 */
export async function getCertFromDb(certNumber: string): Promise<PSACertData | null> {
  const rows = await dbQuery(
    `SELECT ch.cert_number, ch.grade, ch.cert_date, ch.holder_generation,
            ch.holder_type, ch.is_reholder, ch.previous_cert_number, ch.raw_data,
            ch.scraped_at, ch.is_verified, gc.slug AS grading_company_slug
     FROM cert_history ch
     JOIN grading_companies gc ON gc.id = ch.grading_company_id
     WHERE ch.cert_number = $1
     LIMIT 1`,
    [certNumber],
  ) as CertHistoryRow[];
  const typedData = rows[0];
  if (!typedData) return null;
  const rawData = typedData.raw_data;

  return {
    certNumber: typedData.cert_number,
    grade: typedData.grade,
    cardDescription: rawData?.cardDescription || '',
    year: rawData?.year || null,
    brand: rawData?.brand || null,
    sport: rawData?.sport || null,
    cardNumber: rawData?.cardNumber || null,
    variety: rawData?.variety || null,
    certDate: typedData.cert_date,
    holderGeneration: typedData.holder_generation,
    isReholder: typedData.is_reholder,
    previousCertNumber: typedData.previous_cert_number,
    imageUrl: rawData?.imageUrl || null,
    labelType: typedData.holder_type as PSACertData['labelType'],
    scrapedAt: typedData.scraped_at,
    isValid: typedData.is_verified,
  };
}
