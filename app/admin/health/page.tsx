import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { Activity, Database, Sparkles, Trophy, ExternalLink, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'System Health Dashboard | TCGMaster Admin',
  description: 'Monitor scrapers, price engines, and AI enrichment.',
};

export const revalidate = 0; // Disable caching for admin dashboard

export default async function AdminHealthDashboard() {
  const supabase = await createClient();

  // 1. Price Engine Vitals
  const { count: totalCards } = await supabase.from('cards').select('*', { count: 'exact', head: true });
  const { count: cachedPrices } = await supabase.from('price_cache').select('*', { count: 'exact', head: true });
  
  const { data: latestPrice } = await supabase
    .from('price_cache')
    .select('fetched_at')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .single();

  const latestPriceDate = latestPrice?.fetched_at ? new Date(latestPrice.fetched_at) : null;
  const isPriceHealthy = latestPriceDate ? (new Date().getTime() - latestPriceDate.getTime()) < 1000 * 60 * 60 * 24 : false; // < 24h

  // 2. Tournament Vitals
  const { count: totalTourneys } = await supabase.from('tournaments').select('*', { count: 'exact', head: true });
  const { count: totalDecks } = await supabase.from('decks').select('*', { count: 'exact', head: true });
  
  const { data: latestTourney } = await supabase
    .from('tournaments')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
    
  const latestTourneyDate = latestTourney?.created_at ? new Date(latestTourney.created_at) : null;

  // 3. AI Enrichment Vitals
  const { count: cardsWithArtist } = await supabase
    .from('cards')
    .select('*', { count: 'exact', head: true })
    .not('artist', 'is', null);

  const priceCoverage = totalCards && totalCards > 0 ? Math.round(((cachedPrices || 0) / totalCards) * 100) : 0;
  const artistCoverage = totalCards && totalCards > 0 ? Math.round(((cardsWithArtist || 0) / totalCards) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#060c18] pt-24 pb-20">
      <div className="container max-w-[1200px] mx-auto px-4 sm:px-6">
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Activity className="w-8 h-8 text-indigo-400" />
              System Health & Scrapers
            </h1>
            <p className="text-zinc-400 font-medium mt-1">Live monitoring for automated data pipelines and AI enrichment.</p>
          </div>
          
          <div className="mt-4 md:mt-0 flex items-center gap-3">
            <Link 
              href="https://app.inngest.com" 
              target="_blank"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-white transition-colors"
            >
              <ExternalLink className="w-4 h-4 text-zinc-400" />
              Inngest Dashboard
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Price Engine Module */}
          <div className="bg-[#0b1329] border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
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
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Coverage</p>
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
             <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <Trophy className="w-24 h-24 text-amber-400" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                <h2 className="text-lg font-bold text-white">Tournaments (Limitless)</h2>
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
             <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <Sparkles className="w-24 h-24 text-purple-400" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                <h2 className="text-lg font-bold text-white">AI Enrichment (Gemini)</h2>
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
                
                <div className="pt-2">
                  <p className="text-xs font-medium text-zinc-400 leading-relaxed">
                    Background jobs run via Gemini 1.5 to map raw card names to standardized artists and variant definitions.
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
