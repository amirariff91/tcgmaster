import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db/client';
import { redis } from '@/lib/redis/client';
import { formatDisplayNumber, formatSetName } from '@/lib/utils';

export const maxDuration = 60; // 1 minute max duration for vercel
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Deny by default: a missing CRON_SECRET must not make this endpoint public.
    // It triggers a full trending recompute, so an unauthenticated caller could hammer it.
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch popular/expensive cards
    const cards = await dbQuery<{
      id: string;
      name: string;
      slug: string;
      number: string;
      rarity: string | null;
      image_url: string | null;
      local_image_url: string | null;
      sets: {
        name: string;
        slug: string;
        games: { slug: string };
      };
      card_price_current: {
        headline_cents: number | null;
      };
    }>(`
      SELECT
        c.id,
        c.name,
        c.slug,
        c.number,
        c.rarity,
        c.image_url,
        c.local_image_url,
        json_build_object(
          'name', s.name,
          'slug', s.slug,
          'games', json_build_object('slug', g.slug)
        ) AS sets,
        json_build_object(
          'headline_cents', cpc.headline_cents
        ) AS card_price_current
      FROM cards c
      JOIN sets s ON s.id = c.set_id
      JOIN games g ON g.id = s.game_id
      JOIN card_price_current cpc ON cpc.card_id = c.id
      WHERE cpc.headline_cents > 0
      LIMIT 1000
    `);

    const scoredCards = cards.map((card: any) => {
      const marketPrice = typeof card.card_price_current?.headline_cents === 'number'
        ? card.card_price_current.headline_cents / 100
        : 0;
      const score = marketPrice + (Math.random() * 20);

      return {
        type: 'card' as const,
        id: card.id,
        name: card.name,
        slug: `${card.sets?.games?.slug}/${card.sets?.slug}/${card.slug}`,
        image_url: card.local_image_url || card.image_url,
        subtitle: `${formatSetName(card.sets?.name)} - #${formatDisplayNumber(card.games?.slug, card.number)}`,
        price: marketPrice,
        game: card.sets?.games?.slug,
        rarity: card.rarity,
        score: score
      };
    });

    scoredCards.sort((a, b) => b.score - a.score);
    const trendingList = scoredCards.slice(0, 24);

    const payload = {
      results: trendingList,
      parsed: {},
      pagination: {
        page: 1,
        pageSize: 24,
        totalCount: 24,
        hasMore: false,
      }
    };

    await redis.set('api:search:trending', payload);

    return NextResponse.json({ success: true, count: trendingList.length });
  } catch (error: any) {
    console.error('Cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
