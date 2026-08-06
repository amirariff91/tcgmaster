import { NextRequest, NextResponse } from 'next/server';
import { scrapePopulation } from '@/lib/scrapers/gemrate';
import { dbQuery } from '@/lib/db/client';

interface PopulationReport {
  cardName: string;
  setName: string;
  gradingCompany: 'psa' | 'bgs' | 'cgc' | 'sgc';
  totalPopulation: number;
  populations: Array<{ grade: number; count: number; gemRate: number | null }>;
  scrapedAt: string;
  sourceUrl: string;
}

interface RouteParams {
  params: Promise<{ cardId: string }>;
}

interface CardWithSet {
  id: string;
  name: string;
  sets: { name: string };
}

async function getPopulationFromPostgres(
  cardId: string,
  gradingCompany: PopulationReport['gradingCompany'],
): Promise<PopulationReport | null> {
  const rows = await dbQuery<{
    grade: number;
    count: number;
    gem_rate: number | null;
    total_population: number | null;
    scraped_at: string | null;
    source_url: string | null;
    card_name: string;
    company_slug: PopulationReport['gradingCompany'];
  }>(`
    SELECT
      pr.grade::float8 AS grade,
      pr.count,
      pr.gem_rate::float8 AS gem_rate,
      pr.total_population,
      pr.scraped_at,
      pr.source_url,
      c.name AS card_name,
      gc.slug AS company_slug
    FROM population_reports pr
    JOIN cards c ON c.id = pr.card_id
    JOIN grading_companies gc ON gc.id = pr.grading_company_id
    WHERE pr.card_id = $1
      AND gc.slug = $2
    ORDER BY pr.grade
  `, [cardId, gradingCompany]);

  const first = rows[0];
  if (!first) return null;

  return {
    cardName: first.card_name,
    setName: '',
    gradingCompany: first.company_slug,
    totalPopulation: first.total_population ?? 0,
    populations: rows.map((row) => ({
      grade: row.grade,
      count: row.count,
      gemRate: row.gem_rate,
    })),
    scrapedAt: first.scraped_at ?? '',
    sourceUrl: first.source_url ?? '',
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { cardId } = await params;
  const { searchParams } = new URL(request.url);

  const company = searchParams.get('company') as 'psa' | 'bgs' | 'cgc' | 'sgc' || 'psa';
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Get card details for scraping
  let card: CardWithSet | null = null;
  try {
    const rows = await dbQuery<CardWithSet>(`
      SELECT
        c.id,
        c.name,
        json_build_object('name', s.name) AS sets
      FROM cards c
      JOIN sets s ON s.id = c.set_id
      WHERE c.id = $1
      LIMIT 1
    `, [cardId]);
    card = rows[0] || null;
  } catch (error) {
    console.error('Error fetching card for population:', error);
    return NextResponse.json({ error: 'Failed to fetch card' }, { status: 500 });
  }

  if (!card) {
    return NextResponse.json({
      error: 'Card not found',
    }, { status: 404 });
  }

  // Try database first (unless force refresh)
  if (!forceRefresh) {
    let cached: PopulationReport | null = null;
    try {
      cached = await getPopulationFromPostgres(cardId, company);
    } catch (error) {
      console.error('Error fetching cached population:', error);
    }

    if (cached) {
      return NextResponse.json({
        data: {
          ...cached,
          source: 'database',
        },
      });
    }
  }

  // Scrape fresh data
  const setName = card.sets?.name || '';

  const population = await scrapePopulation(card.name, setName, company);

  if (!population) {
    return NextResponse.json({
      error: 'Failed to get population data',
    }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      ...population,
      source: 'scraped',
    },
  });
}
