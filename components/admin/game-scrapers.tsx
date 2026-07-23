import { createClient } from '@/lib/supabase/server';
import { Bot, Terminal } from 'lucide-react';
import { formatDistanceToNow, formatDistanceToNowStrict } from 'date-fns';

function formatShortTime(date: Date) {
  return formatDistanceToNowStrict(date)
    .replace(' seconds', 's')
    .replace(' second', 's')
    .replace(' minutes', 'm')
    .replace(' minute', 'm')
    .replace(' hours', 'h')
    .replace(' hour', 'h')
    .replace(' days', 'd')
    .replace(' day', 'd');
}

function formatPrice(price: number, source: string) {
  if (source === 'tcgplayer') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price);
  }
  return `¥${new Intl.NumberFormat('ja-JP').format(price)}`;
}

export async function GameScrapers() {
  const supabase = await createClient();

  const { data: games } = await supabase.from('games').select('id, name, slug');

  const gameDiagnostics = games ? await Promise.all(games.map(async (game) => {
    // These queries are heavy (using estimated joins) but because this component is wrapped in Suspense,
    // the UI will load instantly and stream this data in when it finishes!
    const { count: gameTotalCards } = await supabase.from('cards').select('*, sets!inner(game_id)', { count: 'estimated', head: true }).eq('sets.game_id', game.id);
    
    // Configured Cards
    const { count: snkrdunkConfigured } = await supabase.from('cards').select('*, sets!inner(game_id)', { count: 'estimated', head: true }).eq('sets.game_id', game.id).not('snkrdunk_url', 'is', null);
    const { count: yuyuteiConfigured } = await supabase.from('cards').select('*, sets!inner(game_id)', { count: 'estimated', head: true }).eq('sets.game_id', game.id).not('yuyutei_url', 'is', null);
    const { count: cardrushConfigured } = await supabase.from('cards').select('*, sets!inner(game_id)', { count: 'estimated', head: true }).eq('sets.game_id', game.id).not('cardrush_url', 'is', null);
    const { count: tcgPlayerConfigured } = await supabase.from('cards').select('*, sets!inner(game_id)', { count: 'estimated', head: true }).eq('sets.game_id', game.id).not('tcg_player_id', 'is', null);

    // Heartbeats and Live Feeds
    // We simplified this query to avoid the massive deep join scan.
    const sources = ['snkrdunk', 'yuyutei', 'tcgplayer', 'cardrush'];
    const heartbeats = await Promise.all(sources.map(async (source) => {
      const { data: logsData } = await supabase
        .from('price_history')
        .select(`
          recorded_at,
          price,
          cards(name, number)
        `)
        .eq('source', source)
        .order('recorded_at', { ascending: false })
        .limit(5);
        
      const logs = (logsData || []).map((log: any) => ({
        price: log.price,
        recorded_at: log.recorded_at,
        card_name: log.cards?.name || 'Unknown',
        card_number: log.cards?.number || '?'
      }));
      
      const dateStr = logs[0]?.recorded_at || null;
      const date = dateStr ? new Date(dateStr) : null;
      const isHealthy = date ? (new Date().getTime() - date.getTime()) < 1000 * 60 * 60 * 24 : false; // < 24h
      
      return {
        source,
        date,
        isHealthy,
        logs
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
                    <div className="mb-6">
                      <div className="flex justify-between items-end mb-1.5">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Database Configuration</p>
                        <p className="text-xs font-bold text-zinc-300 tabular-nums">{scraper.configCount.toLocaleString()} <span className="text-zinc-600">/ {game.totalCards.toLocaleString()} cards</span></p>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${scraper.theme === 'indigo' ? 'bg-indigo-500' : 'bg-blue-500'}`} style={{ width: `${coverage}%` }} />
                      </div>
                    </div>

                    {/* Live Terminal Logs */}
                    <div className="mt-auto">
                      <div className="bg-black/60 border border-white/5 rounded-xl p-3.5 relative">
                        <div className="flex items-center gap-2 border-b border-white/5 pb-2.5 mb-2.5">
                          <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Live Feed</p>
                        </div>
                        
                        <div className="space-y-2 font-mono text-[11px] leading-relaxed">
                          {hb?.logs && hb.logs.length > 0 ? (
                            hb.logs.map((log: any, i: number) => (
                              <div key={i} className="flex gap-2.5 text-zinc-400 items-start">
                                <span className="text-emerald-500 flex-shrink-0 mt-px">{'->'}</span>
                                <span className="text-zinc-500 min-w-[32px] flex-shrink-0 tabular-nums">
                                  {formatShortTime(new Date(log.recorded_at))}
                                </span>
                                <span className="truncate">
                                  {log.card_name} [{log.card_number}] to <span className="text-white font-semibold">{formatPrice(log.price, scraper.source)}</span>
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="text-zinc-600 italic py-2 flex items-center justify-center">
                              No recent activity detected.
                            </div>
                          )}
                        </div>
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
