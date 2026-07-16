import { NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/client';
import { redis } from '@/lib/redis/client';
import { formatSetName } from '@/lib/utils';

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

    const supabase = createPublicClient();
    
    // First find the game id
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('id')
      .eq('slug', game)
      .single();

    if (gameError || !gameData) {
      return NextResponse.json({ data: [] });
    }

    // Then get its sets
    let query = supabase
      .from('sets')
      .select(lang && lang !== 'all' ? 'id, name, slug, card_count, cards!inner (id)' : 'id, name, slug, card_count')
      .eq('game_id', (gameData as any).id)
      .gt('card_count', 0)
      .order('priority', { ascending: false })
      .order('name');

    if (lang === 'en') {
      query = query.not('cards.slug', 'ilike', '%-ja').limit(1, { foreignTable: 'cards' });
    } else if (lang === 'ja') {
      query = query.ilike('cards.slug', '%-ja').limit(1, { foreignTable: 'cards' });
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    let setsList: any[] = data || [];

    const getPrefixScore = (name: string) => {
      if (name.startsWith('OP')) return 1;
      if (name.startsWith('EB')) return 2;
      if (name.startsWith('PRB')) return 3;
      if (name.startsWith('ST')) return 4;
      return 5;
    };

    setsList = setsList.map(s => {
      // Remove the joined cards array from the final output payload to save bandwidth
      const { cards, ...rest } = s;
      return {
        ...rest,
        name: formatSetName(s.name)
      };
    });

    if (game === 'one-piece') {
      setsList.sort((a, b) => {
        const scoreA = getPrefixScore(a.name);
        const scoreB = getPrefixScore(b.name);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.name.localeCompare(b.name);
      });
    }

    // Cache for 1 hour
    await redis.set(cacheKey, setsList, { ex: 3600 });

    return NextResponse.json({ data: setsList });
  } catch (error) {
    console.error('Error fetching sets:', error);
    return NextResponse.json({ error: 'Failed to fetch sets' }, { status: 500 });
  }
}
