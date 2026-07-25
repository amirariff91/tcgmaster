import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Activity, Database, Sparkles, Trophy, ExternalLink, BarChart3, Bot, Terminal } from 'lucide-react';
import { formatDistanceToNow, formatDistanceToNowStrict } from 'date-fns';
import Link from 'next/link';
import { PriceChart } from '@/components/charts/price-chart';

export const metadata: Metadata = {
  title: 'Mission Control | TCGMaster Admin',
  description: 'Surgical diagnostics for automated data pipelines and scrapers.',
};

export const revalidate = 0;

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

export default async function AdminHealthDashboard() {
  // This page reports exact card/price row counts, artist coverage and scraper
  // pipeline health. It had no auth check of any kind and /admin was never in the
  // middleware's protectedPaths, so it was reachable by anyone who guessed the path.
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) redirect('/login?redirectTo=/admin/health');

  const supabase = await createClient();

  // 1. Fetch Global Vitals
  const { count: totalCards } = await supabase.from('cards').select('*', { count: 'exact', head: true });
  const { count: cachedPrices } = await supabase.from('price_cache').select('*', { count: 'exact', head: true });
  const { count: cardsWithArtist } = await supabase.from('cards').select('*', { count: 'exact', head: true }).not('artist', 'is', null);
  const { count: totalTourneys } = await supabase.from('tournaments').select('*', { count: 'exact', head: true });
  const { count: totalDecks } = await supabase.from('decks').select('*', { count: 'exact', head: true });

  const { data: latestTourney } = await supabase.from('tournaments').select('created_at').order('created_at', { ascending: false }).limit(1).single();
  const latestTourneyDate = latestTourney?.created_at ? new Date(latestTourney.created_at) : null;

  const priceCoverage = totalCards && totalCards > 0 ? Math.round(((cachedPrices || 0) / totalCards) * 100) : 0;
  const artistCoverage = totalCards && totalCards > 0 ? Math.round(((cardsWithArtist || 0) / totalCards) * 100) : 0;

  // Pre-calculate last 7 days for activity graphs
  const last7Days = Array.from({length: 7}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  }).reverse(); // chronological order

  // 2. Fetch Games & Game-Specific Scraper Data
  const { data: games } = await supabase.from('games').select('id, name, slug');

  const gameDiagnostics = games ? await Promise.all(games.map(async (game) => {
    const { count: gameTotalCards } = await supabase.from('cards').select('*, sets!inner(game_id)', { count: 'exact', head: true }).eq('sets.game_id', game.id);
    
    // Configured Cards
    const { count: snkrdunkConfigured } = await supabase.from('cards').select('*, sets!inner(game_id)', { count: 'exact', head: true }).eq('sets.game_id', game.id).not('snkrdunk_url', 'is', null);
    const { count: yuyuteiConfigured } = await supabase.from('cards').select('*, sets!inner(game_id)', { count: 'exact', head: true }).eq('sets.game_id', game.id).not('yuyutei_url', 'is', null);
    const { count: cardrushConfigured } = await supabase.from('cards').select('*, sets!inner(game_id)', { count: 'exact', head: true }).eq('sets.game_id', game.id).not('cardrush_url', 'is', null);
    const { count: tcgPlayerConfigured } = await supabase.from('cards').select('*, sets!inner(game_id)', { count: 'exact', head: true }).eq('sets.game_id', game.id).not('tcg_player_id', 'is', null);

    // Heartbeats, Live Feeds, and 7-Day Activity Volume
    const sources = ['snkrdunk', 'yuyutei', 'tcgplayer', 'cardrush'];
    const heartbeats = await Promise.all(sources.map(async (source) => {
      // A: Fetch 5 recent logs
      const { data: logsData } = await supabase
        .from('price_history')
        .select(`
          recorded_at,
          price,
          cards!inner(name, number, sets!inner(game_id))
        `)
        .eq('source', source)
        .eq('cards.sets.game_id', game.id)
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
      
      // B: Fetch 7-day activity counts in parallel
      const dailyCounts = await Promise.all(last7Days.map(async (dateStr) => {
        const nextDate = new Date(dateStr);
        nextDate.setDate(nextDate.getDate() + 1);
        const { count } = await supabase
          .from('price_history')
          .select('id, cards!inner(sets!inner(game_id))', { count: 'exact', head: true })
          .eq('source', source)
          .eq('cards.sets.game_id', game.id)
          .gte('recorded_at', dateStr)
          .lt('recorded_at', nextDate.toISOString().split('T')[0]);
          
        return {
          date: dateStr,
          price: count || 0 // Map to 'price' so PriceChart can render it perfectly
        };
      }));

      return {
        source,
        date,
        isHealthy,
        logs,
        activityChart: dailyCounts
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
    <div className="min-h-screen bg-[#060c18] pt-24 pb-20">
      <div className="container max-w-[1200px] mx-auto px-4 sm:px-6 space-y-12">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Activity className="w-8 h-8 text-indigo-400" />
              Mission Control
            </h1>
            <p className="text-zinc-400 font-medium mt-1">Surgical diagnostics for automated data pipelines and scrapers.</p>
          </div>
          
          <div className="mt-4 md:mt-0 flex items-center gap-3">
            <Link 
              href="https://app.inngest.com" 
              target="_blank"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-xl text-sm font-bold text-indigo-400 transition-colors shadow-[0_0_15px_rgba(99,102,241,0.2)]"
            >
              <ExternalLink className="w-4 h-4" />
              Inngest Dashboard
            </Link>
          </div>
        </div>

        {/* Global Summary */}
        <div>
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
             <BarChart3 className="w-5 h-5 text-zinc-400" /> Global Platform Health
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            <div className="bg-[#0b1329] border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5"><Database className="w-24 h-24 text-emerald-400" /></div>
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-3 h-3 rounded-full ${priceCoverage > 90 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'}`} />
                  <h2 className="text-lg font-bold text-white">Price Cache Integrity</h2>
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Live Database Coverage</p>
                  <p className="text-2xl font-black text-white tabular-nums">
                    {priceCoverage}%
                  </p>
                  <p className="text-xs font-medium text-zinc-400 mt-1">{cachedPrices?.toLocaleString()} / {totalCards?.toLocaleString()} cards cached</p>
                </div>
              </div>
            </div>

            <div className="bg-[#0b1329] border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5"><Trophy className="w-24 h-24 text-amber-400" /></div>
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                  <h2 className="text-lg font-bold text-white">Tournaments (Limitless)</h2>
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Latest Event Ingested</p>
                  <p className="text-2xl font-black text-white tabular-nums">
                    {latestTourneyDate ? formatDistanceToNow(latestTourneyDate, { addSuffix: true }) : 'Never'}
                  </p>
                  <p className="text-xs font-medium text-zinc-400 mt-1">{totalTourneys?.toLocaleString()} Events • {totalDecks?.toLocaleString()} Decks</p>
                </div>
              </div>
            </div>

            <div className="bg-[#0b1329] border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5"><Sparkles className="w-24 h-24 text-purple-400" /></div>
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-3 h-3 rounded-full ${artistCoverage > 50 ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
                  <h2 className="text-lg font-bold text-white">AI Enrichment (Gemini)</h2>
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Artist Extraction</p>
                  <p className="text-2xl font-black text-white tabular-nums">
                    {artistCoverage}%
                  </p>
                  <p className="text-xs font-medium text-zinc-400 mt-1">{cardsWithArtist?.toLocaleString()} / {totalCards?.toLocaleString()} cards enriched</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* TCG Game-by-Game Scrapers (3-Column Grid) */}
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

                        {/* 7-Day Activity Chart */}
                        <div className="mb-6 h-[80px]">
                          <PriceChart 
                            data={hb?.activityChart || []} 
                            height={80} 
                            showGradient={true}
                            variant="recharts"
                            className="-ml-2 pointer-events-none" // Disable tooltip interaction for the mini-chart
                          />
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

      </div>
    </div>
  );
}
