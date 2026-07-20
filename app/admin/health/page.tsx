import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { Activity, Database, Sparkles, Trophy, ExternalLink, AlertCircle, BarChart3 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'System Health Dashboard | TCGMaster Admin',
  description: 'Monitor scrapers, price engines, and AI enrichment.',
};

export const revalidate = 0; // Disable caching for admin dashboard

export default async function AdminHealthDashboard() {
  const supabase = await createClient();

  // 1. Fetch Global Vitals
  const { count: totalCards } = await supabase.from('cards').select('*', { count: 'exact', head: true });
  const { count: cachedPrices } = await supabase.from('price_cache').select('*', { count: 'exact', head: true });
  const { count: cardsWithArtist } = await supabase.from('cards').select('*', { count: 'exact', head: true }).not('artist', 'is', null);
  const { count: totalTourneys } = await supabase.from('tournaments').select('*', { count: 'exact', head: true });
  const { count: totalDecks } = await supabase.from('decks').select('*', { count: 'exact', head: true });

  const { data: latestPrice } = await supabase.from('price_cache').select('fetched_at').order('fetched_at', { ascending: false }).limit(1).single();
  const { data: latestTourney } = await supabase.from('tournaments').select('created_at').order('created_at', { ascending: false }).limit(1).single();

  const latestPriceDate = latestPrice?.fetched_at ? new Date(latestPrice.fetched_at) : null;
  const isPriceHealthy = latestPriceDate ? (new Date().getTime() - latestPriceDate.getTime()) < 1000 * 60 * 60 * 24 : false; // < 24h
  const latestTourneyDate = latestTourney?.created_at ? new Date(latestTourney.created_at) : null;

  const priceCoverage = totalCards && totalCards > 0 ? Math.round(((cachedPrices || 0) / totalCards) * 100) : 0;
  const artistCoverage = totalCards && totalCards > 0 ? Math.round(((cardsWithArtist || 0) / totalCards) * 100) : 0;

  // 2. Fetch Detailed Game Breakdowns
  const { data: games } = await supabase.from('games').select('id, name, slug');
  
  const gameStats = games ? await Promise.all(games.map(async (game) => {
    const { count: gameTotalCards } = await supabase.from('cards').select('*, sets!inner(game_id)', { count: 'exact', head: true }).eq('sets.game_id', game.id);
    const { count: gameCardsWithArtist } = await supabase.from('cards').select('*, sets!inner(game_id)', { count: 'exact', head: true }).eq('sets.game_id', game.id).not('artist', 'is', null);
    const { count: gameCachedPrices } = await supabase.from('price_cache').select('*, cards!inner(sets!inner(game_id))', { count: 'exact', head: true }).eq('cards.sets.game_id', game.id);
    const { count: gameTournaments } = await supabase.from('tournaments').select('*', { count: 'exact', head: true }).eq('game_id', game.id);
    const { count: gameDecks } = await supabase.from('decks').select('*, tournaments!inner(game_id)', { count: 'exact', head: true }).eq('tournaments.game_id', game.id);

    return {
      name: game.name,
      slug: game.slug,
      totalCards: gameTotalCards || 0,
      cardsWithArtist: gameCardsWithArtist || 0,
      cachedPrices: gameCachedPrices || 0,
      tournaments: gameTournaments || 0,
      decks: gameDecks || 0,
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
            <p className="text-zinc-400 font-medium mt-1">Live monitoring for data pipelines, scrapers, and AI enrichment.</p>
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
             <BarChart3 className="w-5 h-5 text-zinc-400" /> Global Metrics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Price Engine Module */}
            <div className="bg-[#0b1329] border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <Database className="w-24 h-24 text-emerald-400" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className={`w-3 h-3 rounded-full ${isPriceHealthy ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
                  <h2 className="text-lg font-bold text-white">Price Engine</h2>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Latest Sync</p>
                    <p className="text-2xl font-black text-white tabular-nums">
                      {latestPriceDate ? formatDistanceToNow(latestPriceDate, { addSuffix: true }) : 'Never'}
                    </p>
                    {!isPriceHealthy && (
                      <p className="text-xs font-medium text-red-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Scrapers may be failing
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Global Coverage</p>
                    <p className="text-lg font-bold text-zinc-200">
                      <span className="text-emerald-400">{priceCoverage}%</span> ({cachedPrices?.toLocaleString()}/{totalCards?.toLocaleString()})
                    </p>
                    <div className="w-full h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${priceCoverage}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tournament Module */}
            <div className="bg-[#0b1329] border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <Trophy className="w-24 h-24 text-amber-400" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                  <h2 className="text-lg font-bold text-white">Tournaments</h2>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Latest Event Scraped</p>
                    <p className="text-2xl font-black text-white tabular-nums">
                      {latestTourneyDate ? formatDistanceToNow(latestTourneyDate, { addSuffix: true }) : 'Never'}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Tournaments</p>
                      <p className="text-xl font-bold text-zinc-200 tabular-nums">{totalTourneys?.toLocaleString() || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Decks</p>
                      <p className="text-xl font-bold text-zinc-200 tabular-nums">{totalDecks?.toLocaleString() || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Enrichment Module */}
            <div className="bg-[#0b1329] border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <Sparkles className="w-24 h-24 text-purple-400" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                  <h2 className="text-lg font-bold text-white">AI Enrichment</h2>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Artist Extraction</p>
                    <p className="text-lg font-bold text-zinc-200">
                      <span className="text-purple-400">{artistCoverage}%</span> ({cardsWithArtist?.toLocaleString()}/{totalCards?.toLocaleString()})
                    </p>
                    <div className="w-full h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${artistCoverage}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Game By Game Breakdown */}
        <div>
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
             <Activity className="w-5 h-5 text-zinc-400" /> Game-by-Game Vitals
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {gameStats.map(stat => {
              const gamePriceCoverage = stat.totalCards > 0 ? Math.round((stat.cachedPrices / stat.totalCards) * 100) : 0;
              const gameArtistCoverage = stat.totalCards > 0 ? Math.round((stat.cardsWithArtist / stat.totalCards) * 100) : 0;

              return (
                <div key={stat.slug} className="bg-[#0b1329] border border-white/10 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                    <h3 className="text-lg font-black text-white capitalize">{stat.name.replace('-', ' ')}</h3>
                    <Link 
                      href={`https://app.inngest.com`} 
                      target="_blank"
                      className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded"
                    >
                      View Logs
                    </Link>
                  </div>
                  
                  <div className="space-y-6">
                    {/* Prices */}
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Price Sync</p>
                        <p className="text-sm font-bold text-white tabular-nums">{stat.cachedPrices.toLocaleString()} <span className="text-zinc-500 font-medium">/ {stat.totalCards.toLocaleString()} cards</span></p>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${gamePriceCoverage}%` }} />
                      </div>
                    </div>

                    {/* AI */}
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">AI Enrichment</p>
                        <p className="text-sm font-bold text-white tabular-nums">{stat.cardsWithArtist.toLocaleString()} <span className="text-zinc-500 font-medium">/ {stat.totalCards.toLocaleString()} cards</span></p>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${gameArtistCoverage}%` }} />
                      </div>
                    </div>

                    {/* Tournaments */}
                    <div className="bg-black/30 rounded-xl p-4 flex items-center justify-between border border-white/5">
                       <div>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Tournaments</p>
                          <p className="text-lg font-black text-white">{stat.tournaments}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-0.5">Decks</p>
                          <p className="text-lg font-black text-white">{stat.decks}</p>
                       </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
