import { NextRequest, NextResponse } from 'next/server';
import { getTrendingCards, getMarketMovers } from '@/lib/pricing/trending';
import { redis } from '@/lib/redis/client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const type = searchParams.get('type') || 'trending';
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const game = searchParams.get('game') || undefined;

  switch (type) {
    case 'trending': {
      // Try cache first
      const cached = await redis.get<object>('trending:cards');
      if (cached) {
        return NextResponse.json({
          data: cached,
          fromCache: true,
        });
      }

      const trending = await getTrendingCards(limit, game);

      if (trending.length === 0) {
        // trending_scores table is likely empty — no trending data has been
        // calculated yet. The updateAllTrendingScores() Inngest job must run
        // at least once to populate the trending_scores table.
        return NextResponse.json({
          data: [],
          fromCache: false,
          message:
            'No trending data available yet. The trending_scores table is empty — run the updateAllTrendingScores job to populate it.',
          hint: 'Trigger the Inngest sync-trending-scores function, or seed the trending_scores table manually.',
        });
      }

      return NextResponse.json({
        data: trending,
        fromCache: false,
      });
    }

    case 'movers': {
      const movers = await getMarketMovers(limit);

      const hasData =
        movers.gainers.length > 0 || movers.losers.length > 0;

      if (!hasData) {
        return NextResponse.json({
          data: { gainers: [], losers: [] },
          message:
            'No market mover data available yet. The trending_scores table is empty — run the updateAllTrendingScores job to populate it.',
        });
      }

      return NextResponse.json({
        data: movers,
      });
    }

    default:
      return NextResponse.json({
        error: 'Invalid type. Use "trending" or "movers"',
      }, { status: 400 });
  }
}
