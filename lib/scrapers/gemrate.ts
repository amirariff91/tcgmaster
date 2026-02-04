/**
 * GemRate Population Data Scraper
 * Scrapes population reports from GemRate.com
 */

import { createServerClient } from '@/lib/supabase/client';
import { redis, CACHE_TTL } from '@/lib/redis/client';

// Type definitions for Supabase query results
interface CardIdRow {
  id: string;
}

interface CompanyIdRow {
  id: string;
}

interface PopulationReportRow {
  grade: number;
  count: number;
  gem_rate: number | null;
  total_population: number | null;
  scraped_at: string;
  source_url: string | null;
  cards: { name: string };
  grading_companies: { slug: string };
}

export interface PopulationData {
  grade: number;
  count: number;
  gemRate: number | null;
}

export interface PopulationReport {
  cardName: string;
  setName: string;
  gradingCompany: 'psa' | 'bgs' | 'cgc' | 'sgc';
  totalPopulation: number;
  populations: PopulationData[];
  scrapedAt: string;
  sourceUrl: string;
}

// GemRate search URL patterns
const GEMRATE_BASE_URL = 'https://www.gemrate.com';

/**
 * Scrape population data for a card from GemRate
 */
export async function scrapePopulation(
  cardName: string,
  setName: string,
  gradingCompany: 'psa' | 'bgs' | 'cgc' | 'sgc' = 'psa'
): Promise<PopulationReport | null> {
  const cacheKey = `pop:${gradingCompany}:${cardName}:${setName}`;

  // Check cache first
  const cached = await redis.get<PopulationReport>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Build search URL
    const searchQuery = encodeURIComponent(`${cardName} ${setName}`);
    const searchUrl = `${GEMRATE_BASE_URL}/search?q=${searchQuery}&company=${gradingCompany}`;

    // Fetch the search results page
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TCGMaster/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      console.error(`GemRate scrape failed: ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Parse the HTML to extract population data
    const report = parseGemRateHtml(html, cardName, setName, gradingCompany, searchUrl);

    if (report) {
      // Cache the result
      await redis.set(cacheKey, report, { ex: CACHE_TTL.population });

      // Store in database
      await storePopulationReport(report);
    }

    return report;
  } catch (error) {
    console.error('GemRate scrape error:', error);
    return null;
  }
}

/**
 * Parse GemRate HTML to extract population data
 * This is a placeholder - actual implementation would use a proper HTML parser
 */
function parseGemRateHtml(
  html: string,
  cardName: string,
  setName: string,
  gradingCompany: 'psa' | 'bgs' | 'cgc' | 'sgc',
  sourceUrl: string
): PopulationReport | null {
  // In a real implementation, you would use a library like cheerio to parse HTML
  // For now, we'll return mock data structure

  // Look for population table patterns in HTML
  // This is simplified - real implementation would be more robust

  const populations: PopulationData[] = [];
  let totalPopulation = 0;

  // Pattern matching for PSA grades 1-10
  const gradePatterns = [
    { grade: 10, pattern: /PSA\s*10[:\s]+(\d+)/i },
    { grade: 9, pattern: /PSA\s*9[:\s]+(\d+)/i },
    { grade: 8, pattern: /PSA\s*8[:\s]+(\d+)/i },
    { grade: 7, pattern: /PSA\s*7[:\s]+(\d+)/i },
    { grade: 6, pattern: /PSA\s*6[:\s]+(\d+)/i },
    { grade: 5, pattern: /PSA\s*5[:\s]+(\d+)/i },
    { grade: 4, pattern: /PSA\s*4[:\s]+(\d+)/i },
    { grade: 3, pattern: /PSA\s*3[:\s]+(\d+)/i },
    { grade: 2, pattern: /PSA\s*2[:\s]+(\d+)/i },
    { grade: 1, pattern: /PSA\s*1[:\s]+(\d+)/i },
  ];

  for (const { grade, pattern } of gradePatterns) {
    const match = html.match(pattern);
    if (match) {
      const count = parseInt(match[1], 10);
      populations.push({
        grade,
        count,
        gemRate: null, // Would be calculated from data
      });
      totalPopulation += count;
    }
  }

  if (populations.length === 0) {
    return null;
  }

  // Calculate gem rates
  for (const pop of populations) {
    const higherGradesPop = populations
      .filter((p) => p.grade >= pop.grade)
      .reduce((sum, p) => sum + p.count, 0);
    pop.gemRate = Math.round((higherGradesPop / totalPopulation) * 100 * 100) / 100;
  }

  return {
    cardName,
    setName,
    gradingCompany,
    totalPopulation,
    populations,
    scrapedAt: new Date().toISOString(),
    sourceUrl,
  };
}

/**
 * Store population report in database
 */
async function storePopulationReport(report: PopulationReport): Promise<void> {
  const supabase = createServerClient();

  // Find the card in our database
  const { data: cardData } = await supabase
    .from('cards')
    .select('id')
    .ilike('name', `%${report.cardName}%`)
    .limit(1)
    .single();

  const card = cardData as CardIdRow | null;

  if (!card) {
    console.warn(`Card not found for population report: ${report.cardName}`);
    return;
  }

  // Find grading company
  const { data: companyData } = await supabase
    .from('grading_companies')
    .select('id')
    .eq('slug', report.gradingCompany)
    .single();

  const company = companyData as CompanyIdRow | null;

  if (!company) {
    return;
  }

  // Upsert population data for each grade
  for (const pop of report.populations) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('population_reports') as any)
      .upsert({
        card_id: card.id,
        grading_company_id: company.id,
        grade: pop.grade,
        count: pop.count,
        gem_rate: pop.gemRate,
        total_population: report.totalPopulation,
        scraped_at: report.scrapedAt,
        source_url: report.sourceUrl,
      }, {
        onConflict: 'card_id,grading_company_id,grade',
      });
  }
}

/**
 * Get population data for a card from database
 */
export async function getPopulationFromDb(
  cardId: string,
  gradingCompany?: 'psa' | 'bgs' | 'cgc' | 'sgc'
): Promise<PopulationReport | null> {
  const supabase = createServerClient();

  let query = supabase
    .from('population_reports')
    .select(`
      grade,
      count,
      gem_rate,
      total_population,
      scraped_at,
      source_url,
      cards!inner (name),
      grading_companies!inner (slug)
    `)
    .eq('card_id', cardId);

  if (gradingCompany) {
    query = query.eq('grading_companies.slug', gradingCompany);
  }

  const { data } = await query;

  if (!data || data.length === 0) {
    return null;
  }

  const typedData = data as PopulationReportRow[];
  const firstRow = typedData[0];
  const card = Array.isArray(firstRow.cards) ? firstRow.cards[0] : firstRow.cards;
  const company = Array.isArray(firstRow.grading_companies)
    ? firstRow.grading_companies[0]
    : firstRow.grading_companies;

  return {
    cardName: card?.name || '',
    setName: '', // Would need to join sets table
    gradingCompany: company?.slug as 'psa' | 'bgs' | 'cgc' | 'sgc',
    totalPopulation: firstRow.total_population || 0,
    populations: typedData.map((row) => ({
      grade: row.grade,
      count: row.count,
      gemRate: row.gem_rate,
    })),
    scrapedAt: firstRow.scraped_at,
    sourceUrl: firstRow.source_url || '',
  };
}

/**
 * Calculate population-adjusted rarity message
 */
export function getPopulationRarityMessage(
  grade: number,
  populations: PopulationData[],
  totalPopulation: number
): string {
  const gradeData = populations.find((p) => p.grade === grade);
  if (!gradeData) {
    return '';
  }

  const percentage = (gradeData.count / totalPopulation) * 100;

  if (percentage < 0.5) {
    return `Extremely rare - only ${gradeData.count} exist (top ${percentage.toFixed(2)}%)`;
  } else if (percentage < 2) {
    return `Very rare - only ${gradeData.count} graded at this level`;
  } else if (percentage < 5) {
    return `Rare - ${gradeData.count} exist (top ${percentage.toFixed(1)}%)`;
  } else if (percentage < 15) {
    return `Uncommon - ${gradeData.count} at this grade`;
  } else {
    return `${gradeData.count} graded copies`;
  }
}
