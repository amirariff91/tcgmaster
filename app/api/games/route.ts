import { NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/client';
import { redis, CACHE_KEYS, CACHE_TTL } from '@/lib/redis/client';

export async function GET() {
  try {
    const cacheKey = 'api:games:all';
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return NextResponse.json({ data: cached });
    }

    const supabase = createPublicClient();
    
    const { data, error } = await supabase
      .from('games')
      .select('id, name, slug, display_name')
      .order('display_name');

    if (error) {
      throw error;
    }

    const gamesList = data || [];
    
    // Cache for 1 hour since games don't change often
    await redis.set(cacheKey, gamesList, { ex: 3600 });

    return NextResponse.json({ data: gamesList });
  } catch (error) {
    console.error('Error fetching games:', error);
    return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 });
  }
}
