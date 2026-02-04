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
      return NextResponse.json({
        data: trending,
        fromCache: false,
      });
    }

    case 'movers': {
      const movers = await getMarketMovers(limit);
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
