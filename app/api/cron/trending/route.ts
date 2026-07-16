import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { redis } from '@/lib/redis/client';
import { formatDisplayNumber, formatSetName } from '@/lib/utils';

export const maxDuration = 60; // 1 minute max duration for vercel
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Verify cron secret for security (in a real app)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch popular/expensive cards
    const { data: cards, error } = await supabase
      .from('cards')
      .select(`
        id,
        name,
        slug,
        number,
        rarity,
        image_url,
        local_image_url,
        sets!inner (
          name,
          slug,
          games!inner (
            slug
          )
        ),
        price_cache (
          raw_prices
        )
      `)
      .not('price_cache', 'is', null)
      .limit(1000);

    if (error || !cards) {
      throw error || new Error('No cards found');
    }

    const scoredCards = cards.map((card: any) => {
      const marketPrice = card.price_cache?.[0]?.raw_prices?.market || 0;
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
