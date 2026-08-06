import { createClient } from '@/lib/supabase/server';
import { Bot } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export async function GameScrapers() {
  const supabase = await createClient();

  const { data: gamesData } = await supabase.from('games').select('id, name, slug');
  const games = gamesData as { id: string; name: string; slug: string }[] | null;

  const gameDiagnostics = games ? await Promise.all(games.map(async (game) => {
    const { count: gameTotalCards } = await supabase
      .from('cards')
      .select('*, sets!inner(game_id)', { count: 'estimated', head: true })
      .eq('sets.game_id', game.id);

    // Configured Cards per game
    const { count: snkrdunkConfigured } = await supabase
      .from('cards')
      .select('*, sets!inner(game_id)', { count: 'estimated', head: true })
      .eq('sets.game_id', game.id)
      .not('snkrdunk_url', 'is', null);

    const { count: yuyuteiConfigured } = await supabase
      .from('cards')
      .select('*, sets!inner(game_id)', { count: 'estimated', head: true })
      .eq('sets.game_id', game.id)
      .not('yuyutei_url', 'is', null);

    const { count: cardrushConfigured } = await supabase
      .from('cards')
      .select('*, sets!inner(game_id)', { count: 'estimated', head: true })
      .eq('sets.game_id', game.id)
      .not('cardrush_url', 'is', null);

    const { count: tcgPlayerConfigured } = await supabase
      .from('cards')
      .select('*, sets!inner(game_id)', { count: 'estimated', head: true })
      .eq('sets.game_id', game.id)
      .not('tcg_player_id', 'is', null);

    // Fast Single-Record Heartbeat Check (No Join)
    const sources = ['snkrdunk', 'yuyutei', 'tcgplayer', 'cardrush'] as const;
    const heartbeats = await Promise.all(sources.map(async (source) => {
      const { data: latestRecord } = await supabase
        .from('price_history')
        .select('recorded_at')
        .eq('source', source)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const dateStr = (latestRecord as { recorded_at: string } | null)?.recorded_at || null;
      const date = dateStr ? new Date(dateStr) : null;
      const isHealthy = date ? (new Date().getTime() - date.getTime()) < 1000 * 60 * 60 * 24 : false; // < 24h

      return {
        source,
        date,
        isHealthy,
      };
    }));

    return {
      id: game.id,
      name: game.name,
      slug: game.slug,
      totalCards: gameTotalCards || 0,
      config: {
        snkrdunk: snkrdunkConfigured || 0,
        yuyutei: yuyuteiConfigured || 0,
        cardrush: cardrushConfigured || 0,
        tcgplayer: tcgPlayerConfigured || 0,
      },
      heartbeats
    };
  })) : [];

  return (
    <div className="space-y-12">
      {gameDiagnostics.map((game) => {

        // Build the scrapers array dynamically based on game
        const gameScrapers = [];
        if (game.slug !== 'pokemon') {
          gameScrapers.push({ source: 'snkrdunk', title: 'Snkrdunk', subtitle: 'Puppeteer Engine', configCount: game.config.snkrdunk, theme: 'blue' });
          gameScrapers.push({ source: 'yuyutei', title: 'Yuyutei', subtitle: 'Fast Parser', configCount: game.config.yuyutei, theme: 'blue' });
          if (game.slug === 'dbfw') {
            gameScrapers.push({ source: 'cardrush', title: 'Cardrush', subtitle: 'Fast Parser', configCount: game.config.cardrush, theme: 'blue' });
          }
        }
        gameScrapers.push({ source: 'tcgplayer', title: 'TCGPlayer', subtitle: 'API Integration', configCount: game.config.tcgplayer, theme: 'indigo' });

        return (
          <div key={game.id} className="pt-8 border-t border-white/10">
            <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3 capitalize">
               <Bot className="w-6 h-6 text-indigo-400" /> {game.name.replace('-', ' ')} Active Scrapers
            </h2>

            {/* 3-Column Grid for Scrapers */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {gameScrapers.map((scraper) => {
                const hb = game.heartbeats.find(h => h.source === scraper.source);
                const coverage = game.totalCards > 0 ? Math.round((scraper.configCount / game.totalCards) * 100) : 0;

                return (
                  <div key={scraper.source} className="bg-[#0b1329] border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col relative overflow-hidden group">

                    {/* Header: Status and Title */}
                    <div className="flex justify-between items-start mb-5">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2.5 h-2.5 rounded-full ${hb?.isHealthy ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse'}`} />
                          <h3 className="font-black text-white text-lg tracking-tight">{scraper.title}</h3>
                        </div>
                        <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest">{scraper.subtitle}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Last Sync</p>
                        <p className={`font-bold tabular-nums text-sm ${hb?.isHealthy ? 'text-emerald-400' : 'text-red-400'}`}>
                          {hb?.date ? formatDistanceToNow(hb.date, { addSuffix: true }) : 'Stalled'}
                        </p>
                      </div>
                    </div>

                    {/* Configuration Coverage */}
                    <div>
                      <div className="flex justify-between items-end mb-1.5">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Database Configuration</p>
                        <p className="text-xs font-bold text-zinc-300 tabular-nums">{scraper.configCount.toLocaleString()} <span className="text-zinc-600">/ {game.totalCards.toLocaleString()} cards</span></p>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${scraper.theme === 'indigo' ? 'bg-indigo-500' : 'bg-blue-500'}`} style={{ width: `${coverage}%` }} />
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
