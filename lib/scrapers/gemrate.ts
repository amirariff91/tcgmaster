/**
 * GemRate Population Data Scraper
 * Scrapes population reports from GemRate.com
 */

import { dbQuery } from '@/lib/db/client';
import { redis, CACHE_TTL } from '@/lib/redis/client';

// Type definitions for database query results
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
  card_name: string;
  grading_company_slug: string;
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
  // Find the card in our database
  const cardRows = await dbQuery(
    `SELECT id
     FROM cards
     WHERE name ILIKE $1
     LIMIT 1`,
    [`%${report.cardName}%`],
  ) as CardIdRow[];
  const card = cardRows[0] ?? null;

  if (!card) {
    console.warn(`Card not found for population report: ${report.cardName}`);
    return;
  }

  // Find grading company
  const companyRows = await dbQuery(
    `SELECT id FROM grading_companies WHERE slug = $1 LIMIT 1`,
    [report.gradingCompany],
  ) as CompanyIdRow[];
  const company = companyRows[0] ?? null;

  if (!company) {
    return;
  }

  // Upsert population data for each grade
  for (const pop of report.populations) {
    await dbQuery(
      `INSERT INTO population_reports (
         card_id, grading_company_id, grade, count, gem_rate, total_population, scraped_at, source_url
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (card_id, grading_company_id, grade) DO UPDATE SET
         count = EXCLUDED.count,
         gem_rate = EXCLUDED.gem_rate,
         total_population = EXCLUDED.total_population,
         scraped_at = EXCLUDED.scraped_at,
         source_url = EXCLUDED.source_url`,
      [
        card.id,
        company.id,
        pop.grade,
        pop.count,
        pop.gemRate,
        report.totalPopulation,
        report.scrapedAt,
        report.sourceUrl,
      ],
    );
  }
}

/**
 * Get population data for a card from database
 */
export async function getPopulationFromDb(
  cardId: string,
  gradingCompany?: 'psa' | 'bgs' | 'cgc' | 'sgc'
): Promise<PopulationReport | null> {
  const params: unknown[] = [cardId];
  let companyClause = '';
  if (gradingCompany) {
    params.push(gradingCompany);
    companyClause = ' AND gc.slug = $2';
  }

  const rows = await dbQuery(
    `SELECT pr.grade, pr.count, pr.gem_rate, pr.total_population,
            pr.scraped_at, pr.source_url, c.name AS card_name,
            gc.slug AS grading_company_slug
     FROM population_reports pr
     JOIN cards c ON c.id = pr.card_id
     JOIN grading_companies gc ON gc.id = pr.grading_company_id
     WHERE pr.card_id = $1${companyClause}
     ORDER BY pr.grade`,
    params,
  ) as PopulationReportRow[];

  if (rows.length === 0) {
    return null;
  }

  const firstRow = rows[0];

  return {
    cardName: firstRow.card_name || '',
    setName: '', // Would need to join sets table
    gradingCompany: firstRow.grading_company_slug as 'psa' | 'bgs' | 'cgc' | 'sgc',
    totalPopulation: firstRow.total_population || 0,
    populations: rows.map((row) => ({
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
