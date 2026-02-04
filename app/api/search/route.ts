import { NextRequest, NextResponse } from 'next/server';
import { searchCards, getSearchSuggestions, getPopularSearches } from '@/lib/search/service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const game = searchParams.get('game') || undefined;
  const set = searchParams.get('set') || undefined;
  const rarity = searchParams.get('rarity') || undefined;
  const autocomplete = searchParams.get('autocomplete') === 'true';
  const popular = searchParams.get('popular') === 'true';

  // Get popular searches
  if (popular) {
    const popularSearches = await getPopularSearches(limit);
    return NextResponse.json({ data: popularSearches });
  }

  // Return empty if no query
  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // Autocomplete mode - fast suggestions
  if (autocomplete) {
    const suggestions = await getSearchSuggestions(query, limit);

    // Transform to match existing frontend format
    const results = [
      ...suggestions.cards.map((card) => ({
        type: 'card' as const,
        id: card.id,
        name: card.name,
        slug: `${card.game}/${card.setSlug}/${card.slug}`,
        image_url: card.imageUrl,
        subtitle: `${card.setName} - #${card.number}`,
        price: card.marketPrice,
        game: card.game,
      })),
      ...suggestions.sets.map((set) => ({
        type: 'set' as const,
        id: set.slug,
        name: set.name,
        slug: `pokemon/${set.slug}`,
        image_url: null,
        subtitle: `${set.cardCount} cards`,
        price: null,
        game: 'pokemon',
      })),
    ];

    return NextResponse.json({
      results,
      suggestions: suggestions.suggestions,
    });
  }

  // Full search mode
  const results = await searchCards(query, {
    page,
    pageSize,
    filters: {
      game,
      set,
      rarity,
    },
  });

  return NextResponse.json({
    data: {
      results: results.results.map((card) => ({
        type: 'card' as const,
        id: card.id,
        name: card.name,
        slug: `${card.game}/${card.setSlug}/${card.slug}`,
        image_url: card.imageUrl,
        subtitle: `${card.setName} - #${card.number}`,
        price: card.marketPrice,
        game: card.game,
        rarity: card.rarity,
        score: card.score,
      })),
      parsed: results.parsed,
      pagination: {
        page: results.page,
        pageSize: results.pageSize,
        totalCount: results.totalCount,
        hasMore: results.hasMore,
      },
    },
  });
}
