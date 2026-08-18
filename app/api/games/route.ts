import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db/client';
import { redis } from '@/lib/redis/client';

export async function GET() {
  try {
    const cacheKey = 'api:games:all';
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return NextResponse.json({ data: cached });
    }

    const gamesList = await dbQuery(`
      SELECT id, name, slug, display_name
      FROM games
      ORDER BY display_name
    `);
    
    // Cache for 1 hour since games don't change often
    await redis.set(cacheKey, gamesList, { ex: 3600 });

    return NextResponse.json({ data: gamesList });
  } catch (error) {
    console.error('Error fetching games:', error);
    return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 });
  }
}
