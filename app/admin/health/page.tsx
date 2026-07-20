import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { Activity, Database, Sparkles, Trophy, ExternalLink, BarChart3, Bot, Globe, DollarSign } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Mission Control | TCGMaster Admin',
  description: 'Surgical diagnostics for automated data pipelines and scrapers.',
};

export const revalidate = 0;

export default async function AdminHealthDashboard() {
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

  // 2. Fetch Games & Game-Specific Scraper Data
  const { data: games } = await supabase.from('games').select('id, name, slug');

  const gameDiagnostics = games ? await Promise.all(games.map(async (game) => {
    const { count: gameTotalCards } = await supabase.from('cards').select('*, sets!inner(game_id)', { count: 'exact', head: true }).eq('sets.game_id', game.id);
    
    // Configured Cards
    const { count: snkrdunkConfigured } = await supabase.from('cards').select('*, sets!inner(game_id)', { count: 'exact', head: true }).eq('sets.game_id', game.id).not('snkrdunk_url', 'is', null);
    const { count: yuyuteiConfigured } = await supabase.from('cards').select('*, sets!inner(game_id)', { count: 'exact', head: true }).eq('sets.game_id', game.id).not('yuyutei_url', 'is', null);
    const { count: cardrushConfigured } = await supabase.from('cards').select('*, sets!inner(game_id)', { count: 'exact', head: true }).eq('sets.game_id', game.id).not('cardrush_url', 'is', null);
    const { count: tcgPlayerConfigured } = await supabase.from('cards').select('*, sets!inner(game_id)', { count: 'exact', head: true }).eq('sets.game_id', game.id).not('tcg_player_id', 'is', null);

    // Heartbeats (Last successful price fetch in price_history)
    const sources = ['snkrdunk', 'yuyutei', 'tcgplayer', 'cardrush'];
    const heartbeats = await Promise.all(sources.map(async (source) => {
      const { data } = await supabase
        .from('price_history')
        .select('recorded_at, cards!inner(sets!inner(game_id))')
        .eq('source', source)
        .eq('cards.sets.game_id', game.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      // Extract recorded_at, fallback to null
      const dateStr = data ? (data as any).recorded_at : null;
      const date = dateStr ? new Date(dateStr) : null;
      const isHealthy = date ? (new Date().getTime() - date.getTime()) < 1000 * 60 * 60 * 24 : false; // < 24h
      
      return {
        source,
        date,
        isHealthy
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

        {/* TCG Game-by-Game Scrapers */}
        <div className="space-y-12">
          {gameDiagnostics.map((game) => (
            <div key={game.id} className="pt-8 border-t border-white/10">
              <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-3 capitalize">
                 <Bot className="w-6 h-6 text-indigo-400" /> {game.name.replace('-', ' ')} Scrapers
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Japanese Market (Hidden for Pokemon) */}
                {game.slug !== 'pokemon' && (
                  <div className="bg-[#0b1329] border border-white/10 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/10">
                      <Globe className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-lg font-black text-white">Japanese Market</h3>
                    </div>
                    
                    <div className="space-y-6">
                      
                      {/* Snkrdunk */}
                      {(() => {
                        const hb = game.heartbeats.find(h => h.source === 'snkrdunk');
                        const coverage = game.totalCards > 0 ? Math.round((game.config.snkrdunk / game.totalCards) * 100) : 0;
                        return (
                          <div className="bg-black/40 rounded-xl p-4 border border-white/5 relative overflow-hidden">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <div className={`w-2 h-2 rounded-full ${hb?.isHealthy ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse'}`} />
                                  <h4 className="font-bold text-white">Snkrdunk</h4>
                                </div>
                                <p className="text-xs text-zinc-500">Puppeteer Engine</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Last Sync</p>
                                <p className={`font-bold tabular-nums text-sm ${hb?.isHealthy ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {hb?.date ? formatDistanceToNow(hb.date, { addSuffix: true }) : 'Stalled'}
                                </p>
                              </div>
                            </div>
                            
                            <div>
                              <div className="flex justify-between items-end mb-1">
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">URL Coverage</p>
                                <p className="text-xs font-bold text-zinc-300 tabular-nums">{game.config.snkrdunk.toLocaleString()} <span className="text-zinc-600">/ {game.totalCards.toLocaleString()} cards</span></p>
                              </div>
                              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${coverage}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Yuyutei */}
                      {(() => {
                        const hb = game.heartbeats.find(h => h.source === 'yuyutei');
                        const coverage = game.totalCards > 0 ? Math.round((game.config.yuyutei / game.totalCards) * 100) : 0;
                        return (
                          <div className="bg-black/40 rounded-xl p-4 border border-white/5 relative overflow-hidden">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <div className={`w-2 h-2 rounded-full ${hb?.isHealthy ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse'}`} />
                                  <h4 className="font-bold text-white">Yuyutei</h4>
                                </div>
                                <p className="text-xs text-zinc-500">Fast Parser</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Last Sync</p>
                                <p className={`font-bold tabular-nums text-sm ${hb?.isHealthy ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {hb?.date ? formatDistanceToNow(hb.date, { addSuffix: true }) : 'Stalled'}
                                </p>
                              </div>
                            </div>
                            
                            <div>
                              <div className="flex justify-between items-end mb-1">
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">URL Coverage</p>
                                <p className="text-xs font-bold text-zinc-300 tabular-nums">{game.config.yuyutei.toLocaleString()} <span className="text-zinc-600">/ {game.totalCards.toLocaleString()} cards</span></p>
                              </div>
                              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${coverage}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Cardrush (DBFW only) */}
                      {game.slug === 'dbfw' && (() => {
                        const hb = game.heartbeats.find(h => h.source === 'cardrush');
                        const coverage = game.totalCards > 0 ? Math.round((game.config.cardrush / game.totalCards) * 100) : 0;
                        return (
                          <div className="bg-black/40 rounded-xl p-4 border border-white/5 relative overflow-hidden">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <div className={`w-2 h-2 rounded-full ${hb?.isHealthy ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse'}`} />
                                  <h4 className="font-bold text-white">Cardrush</h4>
                                </div>
                                <p className="text-xs text-zinc-500">Fast Parser</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Last Sync</p>
                                <p className={`font-bold tabular-nums text-sm ${hb?.isHealthy ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {hb?.date ? formatDistanceToNow(hb.date, { addSuffix: true }) : 'Stalled'}
                                </p>
                              </div>
                            </div>
                            
                            <div>
                              <div className="flex justify-between items-end mb-1">
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">URL Coverage</p>
                                <p className="text-xs font-bold text-zinc-300 tabular-nums">{game.config.cardrush.toLocaleString()} <span className="text-zinc-600">/ {game.totalCards.toLocaleString()} cards</span></p>
                              </div>
                              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${coverage}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* English Market */}
                <div className="bg-[#0b1329] border border-white/10 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/10">
                    <DollarSign className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-lg font-black text-white">English Market</h3>
                  </div>
                  
                  <div className="space-y-6">
                    
                    {/* TCGPlayer */}
                    {(() => {
                      const hb = game.heartbeats.find(h => h.source === 'tcgplayer');
                      const coverage = game.totalCards > 0 ? Math.round((game.config.tcgplayer / game.totalCards) * 100) : 0;
                      return (
                        <div className="bg-black/40 rounded-xl p-4 border border-white/5 relative overflow-hidden">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <div className={`w-2 h-2 rounded-full ${hb?.isHealthy ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse'}`} />
                                <h4 className="font-bold text-white">TCGPlayer</h4>
                              </div>
                              <p className="text-xs text-zinc-500">API Integration</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Last Sync</p>
                              <p className={`font-bold tabular-nums text-sm ${hb?.isHealthy ? 'text-emerald-400' : 'text-red-400'}`}>
                                {hb?.date ? formatDistanceToNow(hb.date, { addSuffix: true }) : 'Stalled'}
                              </p>
                            </div>
                          </div>
                          
                          <div>
                            <div className="flex justify-between items-end mb-1">
                              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">ID Coverage</p>
                              <p className="text-xs font-bold text-zinc-300 tabular-nums">{game.config.tcgplayer.toLocaleString()} <span className="text-zinc-600">/ {game.totalCards.toLocaleString()} cards</span></p>
                            </div>
                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${coverage}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                  </div>
                </div>

              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
