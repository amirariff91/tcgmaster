import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db/client';
import { redis } from '@/lib/redis/client';
import { formatSetName } from '@/lib/utils';
import { sortSetsForGame } from '@/lib/sets/sorting';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const game = searchParams.get('game');
    const lang = searchParams.get('lang');

    if (!game || game === 'all') {
      return NextResponse.json({ data: [] });
    }

    const cacheKey = `api:sets:${game}${lang && lang !== 'all' ? `:${lang}` : ''}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return NextResponse.json({ data: cached });
    }

    // First find the game id
    const gameRows = await dbQuery<{ id: string }>(
      'SELECT id FROM games WHERE slug = $1 LIMIT 1',
      [game],
    );

    if (gameRows.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Then get its sets
    const languageCondition = lang === 'en'
      ? 'AND EXISTS (SELECT 1 FROM cards c WHERE c.set_id = s.id AND c.slug NOT ILIKE $2)'
      : lang === 'ja'
        ? 'AND EXISTS (SELECT 1 FROM cards c WHERE c.set_id = s.id AND c.slug ILIKE $2)'
        : '';
    const params = lang === 'en' || lang === 'ja'
      ? [gameRows[0].id, '%-ja']
      : [gameRows[0].id];

    let setsList = await dbQuery<{ id: string; name: string; slug: string; card_count: number | null; release_date: string | null; priority: number | null }>(`
      SELECT s.id, s.name, s.slug, s.card_count, s.release_date::text AS release_date, s.priority
      FROM sets s
      WHERE s.game_id = $1
        AND s.card_count > 0
        ${languageCondition}
    `, params);

    setsList = setsList.map(s => ({
      ...s,
      name: formatSetName(s.name)
    }));

    const sortedSets = sortSetsForGame(setsList, game);

    // Cache for 1 hour
    await redis.set(cacheKey, sortedSets, { ex: 3600 });

    return NextResponse.json({ data: sortedSets });
  } catch (error) {
    console.error('Error fetching sets:', error);
    return NextResponse.json({ error: 'Failed to fetch sets' }, { status: 500 });
  }
}
