/**
 * BGS/Beckett Certificate Verification Scraper
 * Scrapes BGS cert data from beckett.com
 */

import { createServerClient } from '@/lib/supabase/client';
import { redis, CACHE_KEYS, CACHE_TTL } from '@/lib/redis/client';

// Type definitions for Supabase query results
interface CompanyIdRow {
  id: string;
}

interface CardIdRow {
  id: string;
}

export interface BGSSubgrades {
  centering: number | null;
  corners: number | null;
  edges: number | null;
  surface: number | null;
}

export interface BGSCertData {
  certNumber: string;
  grade: number;
  subgrades: BGSSubgrades | null;
  cardDescription: string;
  year: string | null;
  brand: string | null;
  sport: string | null;
  cardNumber: string | null;
  variety: string | null;
  certDate: string | null;
  holderType: 'standard' | 'black-label' | 'pristine' | null;
  isAuto: boolean;
  autoGrade: number | null;
  isReholder: boolean;
  previousCertNumber: string | null;
  imageUrl: string | null;
  scrapedAt: string;
  isValid: boolean;
  error?: string;
}

const BGS_CERT_URL = 'https://www.beckett.com/grading/card-lookup';

/**
 * Lookup a BGS certificate by number
 */
export async function lookupBGSCert(certNumber: string): Promise<BGSCertData | null> {
  const cleanCertNumber = certNumber.replace(/\D/g, '');
  if (!cleanCertNumber || cleanCertNumber.length < 6) {
    return {
      certNumber: cleanCertNumber,
      grade: 0,
      subgrades: null,
      cardDescription: '',
      year: null,
      brand: null,
      sport: null,
      cardNumber: null,
      variety: null,
      certDate: null,
      holderType: null,
      isAuto: false,
      autoGrade: null,
      isReholder: false,
      previousCertNumber: null,
      imageUrl: null,
      scrapedAt: new Date().toISOString(),
      isValid: false,
      error: 'Invalid certificate number format',
    };
  }

  const cacheKey = CACHE_KEYS.cert(cleanCertNumber, 'bgs');

  // Check cache first
  const cached = await redis.get<BGSCertData>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // BGS requires a form submission or API call
    const response = await fetch(`${BGS_CERT_URL}/${cleanCertNumber}`, {
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
          subgrades: null,
          cardDescription: '',
          year: null,
          brand: null,
          sport: null,
          cardNumber: null,
          variety: null,
          certDate: null,
          holderType: null,
          isAuto: false,
          autoGrade: null,
          isReholder: false,
          previousCertNumber: null,
          imageUrl: null,
          scrapedAt: new Date().toISOString(),
          isValid: false,
          error: 'Certificate not found',
        };
      }
      throw new Error(`BGS lookup failed: ${response.status}`);
    }

    const html = await response.text();
    const certData = parseBGSCertHtml(html, cleanCertNumber);

    if (certData.isValid) {
      await redis.set(cacheKey, certData, { ex: CACHE_TTL.cert });
      await storeBGSCertData(certData);
    }

    return certData;
  } catch (error) {
    console.error('BGS cert lookup error:', error);
    return {
      certNumber: cleanCertNumber,
      grade: 0,
      subgrades: null,
      cardDescription: '',
      year: null,
      brand: null,
      sport: null,
      cardNumber: null,
      variety: null,
      certDate: null,
      holderType: null,
      isAuto: false,
      autoGrade: null,
      isReholder: false,
      previousCertNumber: null,
      imageUrl: null,
      scrapedAt: new Date().toISOString(),
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Parse BGS certificate HTML
 */
function parseBGSCertHtml(html: string, certNumber: string): BGSCertData {
  const result: BGSCertData = {
    certNumber,
    grade: 0,
    subgrades: null,
    cardDescription: '',
    year: null,
    brand: null,
    sport: null,
    cardNumber: null,
    variety: null,
    certDate: null,
    holderType: null,
    isAuto: false,
    autoGrade: null,
    isReholder: false,
    previousCertNumber: null,
    imageUrl: null,
    scrapedAt: new Date().toISOString(),
    isValid: false,
  };

  if (html.includes('not found') || html.includes('No results')) {
    result.error = 'Certificate not found';
    return result;
  }

  // Extract overall grade
  const gradeMatch = html.match(/Grade[:\s]*<[^>]*>(\d+(?:\.\d+)?)</i) ||
                     html.match(/BGS\s+(\d+(?:\.\d+)?)/i);
  if (gradeMatch) {
    result.grade = parseFloat(gradeMatch[1]);
  }

  // Extract subgrades
  const subgrades: BGSSubgrades = {
    centering: null,
    corners: null,
    edges: null,
    surface: null,
  };

  const centeringMatch = html.match(/Centering[:\s]*(\d+(?:\.\d+)?)/i);
  if (centeringMatch) subgrades.centering = parseFloat(centeringMatch[1]);

  const cornersMatch = html.match(/Corners[:\s]*(\d+(?:\.\d+)?)/i);
  if (cornersMatch) subgrades.corners = parseFloat(cornersMatch[1]);

  const edgesMatch = html.match(/Edges[:\s]*(\d+(?:\.\d+)?)/i);
  if (edgesMatch) subgrades.edges = parseFloat(edgesMatch[1]);

  const surfaceMatch = html.match(/Surface[:\s]*(\d+(?:\.\d+)?)/i);
  if (surfaceMatch) subgrades.surface = parseFloat(surfaceMatch[1]);

  if (subgrades.centering || subgrades.corners || subgrades.edges || subgrades.surface) {
    result.subgrades = subgrades;
  }

  // Extract description
  const descMatch = html.match(/Description[:\s]*<[^>]*>([^<]+)</i);
  if (descMatch) {
    result.cardDescription = descMatch[1].trim();
  }

  // Detect holder type
  if (result.grade === 10 && result.subgrades &&
      Object.values(result.subgrades).every((v) => v === 10)) {
    result.holderType = 'black-label';
  } else if (result.grade >= 9.5) {
    result.holderType = 'pristine';
  } else {
    result.holderType = 'standard';
  }

  // Check for autograph
  if (html.includes('Auto') || html.includes('autograph')) {
    result.isAuto = true;
    const autoMatch = html.match(/Auto[:\s]*(\d+(?:\.\d+)?)/i);
    if (autoMatch) {
      result.autoGrade = parseFloat(autoMatch[1]);
    }
  }

  if (result.grade > 0 || result.cardDescription) {
    result.isValid = true;
  }

  return result;
}

/**
 * Store BGS cert data in database
 */
async function storeBGSCertData(certData: BGSCertData): Promise<void> {
  const supabase = createServerClient();

  const { data: companyData } = await supabase
    .from('grading_companies')
    .select('id')
    .eq('slug', 'bgs')
    .single();

  const company = companyData as CompanyIdRow | null;

  if (!company) return;

  let cardId: string | null = null;
  if (certData.cardDescription) {
    const { data: cardData } = await supabase
      .from('cards')
      .select('id')
      .ilike('name', `%${certData.cardDescription.split(' ').slice(0, 2).join(' ')}%`)
      .limit(1)
      .single();

    const card = cardData as CardIdRow | null;
    cardId = card?.id || null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('cert_history') as any)
    .upsert({
      cert_number: certData.certNumber,
      grading_company_id: company.id,
      card_id: cardId,
      grade: certData.grade,
      subgrades: certData.subgrades,
      cert_date: certData.certDate,
      holder_type: certData.holderType,
      is_reholder: certData.isReholder,
      previous_cert_number: certData.previousCertNumber,
      is_verified: true,
      last_verified_at: new Date().toISOString(),
      raw_data: certData,
      scraped_at: certData.scrapedAt,
    }, {
      onConflict: 'cert_number,grading_company_id',
    });
}

/**
 * Check if a BGS grade qualifies for special labels
 */
export function getBGSLabelType(
  grade: number,
  subgrades: BGSSubgrades | null
): 'black-label' | 'pristine-gold' | 'pristine' | 'standard' {
  if (grade === 10 && subgrades) {
    const allTens = Object.values(subgrades).every((v) => v === 10);
    if (allTens) return 'black-label';
  }

  if (grade >= 9.5 && subgrades) {
    const allNineFiveOrHigher = Object.values(subgrades).every((v) => v !== null && v >= 9.5);
    if (allNineFiveOrHigher) return 'pristine-gold';
  }

  if (grade >= 9.5) {
    return 'pristine';
  }

  return 'standard';
}

/**
 * Format BGS subgrades for display
 */
export function formatBGSSubgrades(subgrades: BGSSubgrades): string {
  const parts: string[] = [];

  if (subgrades.centering !== null) parts.push(`C: ${subgrades.centering}`);
  if (subgrades.corners !== null) parts.push(`Co: ${subgrades.corners}`);
  if (subgrades.edges !== null) parts.push(`E: ${subgrades.edges}`);
  if (subgrades.surface !== null) parts.push(`S: ${subgrades.surface}`);

  return parts.join(' | ');
}
