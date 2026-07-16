import { NextRequest, NextResponse } from 'next/server';
import { searchCards, getSearchSuggestions, getPopularSearches } from '@/lib/search/service';
import { formatDisplayNumber, formatSetName } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const game = searchParams.get('game') || undefined;
  const set = searchParams.get('set') || undefined;
  const rarity = searchParams.get('rarity') || undefined;
  const lang = searchParams.get('lang') as 'en' | 'ja' | 'all' | undefined;
  const autocomplete = searchParams.get('autocomplete') === 'true';
  const popular = searchParams.get('popular') === 'true';

  // Get popular searches
  if (popular) {
    const popularSearches = await getPopularSearches(limit);
    return NextResponse.json({ data: popularSearches });
  }

  // Let empty query pass through to get default list
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
        subtitle: `${formatSetName(card.setName)} - #${formatDisplayNumber(card.game, card.number)}`,
        price: card.marketPrice,
        game: card.game,
      })),
      ...suggestions.sets.map((set) => ({
        type: 'set' as const,
        id: set.slug,
        name: formatSetName(set.name),
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
  const sort = searchParams.get('sort') || undefined;
  const results = await searchCards(query, {
    page,
    pageSize,
    sort,
    filters: {
      game,
      set,
      rarity,
      lang,
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
        subtitle: `${formatSetName(card.setName)} - #${formatDisplayNumber(card.game, card.number)}`,
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
