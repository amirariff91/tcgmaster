import { NextRequest, NextResponse } from 'next/server';
import { scrapePopulation, getPopulationFromDb } from '@/lib/scrapers/gemrate';
import { createServerClient } from '@/lib/supabase/client';

interface RouteParams {
  params: Promise<{ cardId: string }>;
}

interface CardWithSet {
  id: string;
  name: string;
  sets: { name: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { cardId } = await params;
  const { searchParams } = new URL(request.url);

  const company = searchParams.get('company') as 'psa' | 'bgs' | 'cgc' | 'sgc' || 'psa';
  const forceRefresh = searchParams.get('refresh') === 'true';

  const supabase = createServerClient();

  // Get card details for scraping
  const { data: cardData, error } = await supabase
    .from('cards')
    .select(`
      id,
      name,
      sets!inner (name)
    `)
    .eq('id', cardId)
    .single();

  const card = cardData as CardWithSet | null;

  if (error || !card) {
    return NextResponse.json({
      error: 'Card not found',
    }, { status: 404 });
  }

  // Try database first (unless force refresh)
  if (!forceRefresh) {
    const cached = await getPopulationFromDb(cardId, company);
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
