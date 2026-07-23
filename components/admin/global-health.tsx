import { createClient } from '@/lib/supabase/server';
import { Database, Trophy, Sparkles, Image as ImageIcon, BarChart3 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import fs from 'fs';
import path from 'path';

export async function GlobalPlatformHealth() {
  const supabase = await createClient();

  const { count: totalCards } = await supabase.from('cards').select('*', { count: 'estimated', head: true });
  const { count: cachedPrices } = await supabase.from('price_cache').select('*', { count: 'estimated', head: true });
  const { count: cardsWithArtist } = await supabase.from('cards').select('*', { count: 'estimated', head: true }).not('artist', 'is', null).neq('artist', 'Unknown');
  const { count: cardsWithUnknownArtist } = await supabase.from('cards').select('*', { count: 'estimated', head: true }).eq('artist', 'Unknown');
  const { count: totalTourneys } = await supabase.from('tournaments').select('*', { count: 'estimated', head: true });
  const { count: totalDecks } = await supabase.from('decks').select('*', { count: 'estimated', head: true });

  const { count: stalePricesCount } = await supabase.from('price_cache')
    .select('*', { count: 'estimated', head: true })
    .lt('fetched_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const { data: latestTourneyData } = await supabase.from('tournaments').select('created_at').order('created_at', { ascending: false }).limit(1).single();
  const latestTourney = latestTourneyData as { created_at: string } | null;
  const latestTourneyDate = latestTourney?.created_at ? new Date(latestTourney.created_at) : null;

  const priceCoverage = totalCards && totalCards > 0 ? Math.round(((cachedPrices || 0) / totalCards) * 100) : 0;
  const artistCoverage = totalCards && totalCards > 0 ? Math.round(((cardsWithArtist || 0) / totalCards) * 100) : 0;

  const { count: totalEnVariants } = await supabase
    .from('cards')
    .select('*', { count: 'estimated', head: true })
    .like('slug', 'op-%_%')
    .not('slug', 'like', '%-ja');
    
  let mappedVariantsCount = 0;
  let skippedVariantsCount = 0;
  try {
    const dictPath = path.join(process.cwd(), 'lib/price-engine/mapping-dictionary.json');
    if (fs.existsSync(dictPath)) {
      const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
      const values = Object.values(dict);
      mappedVariantsCount = values.filter((v: any) => v !== -1).length;
      skippedVariantsCount = values.filter((v: any) => v === -1).length;
    }
  } catch (e) {
    console.error("Failed to read mapping dictionary", e);
  }
  
  const variantCoverage = totalEnVariants && totalEnVariants > 0 ? Math.round((mappedVariantsCount / totalEnVariants) * 100) : 0;

  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
         <BarChart3 className="w-5 h-5 text-zinc-400" /> Global Platform Health
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="bg-[#0b1329] border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col h-full">
          <div className="absolute top-0 right-0 p-6 opacity-5"><Database className="w-24 h-24 text-emerald-400" /></div>
          <div className="relative z-10 space-y-4 flex-grow">
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
          
          <div className="mt-6 pt-4 border-t border-white/10 relative z-10 font-mono text-[11px] space-y-1.5 text-zinc-400">
            <div className="flex justify-between">
              <span>Engine Clusters</span>
              <span className="text-white">4 Active</span>
            </div>
            <div className="flex justify-between">
              <span>Stale (&gt;24h)</span>
              <span className={stalePricesCount && stalePricesCount > 100 ? 'text-amber-400' : 'text-emerald-400'}>{stalePricesCount?.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#0b1329] border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col h-full">
          <div className="absolute top-0 right-0 p-6 opacity-5"><Trophy className="w-24 h-24 text-amber-400" /></div>
          <div className="relative z-10 space-y-4 flex-grow">
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

          <div className="mt-6 pt-4 border-t border-white/10 relative z-10 font-mono text-[11px] space-y-1.5 text-zinc-400">
            <div className="flex justify-between">
              <span>Avg Decks/Event</span>
              <span className="text-white">{totalTourneys ? Math.round((totalDecks || 0) / totalTourneys) : 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Tracked Games</span>
              <span className="text-indigo-400">OP, DBFW</span>
            </div>
          </div>
        </div>

        <div className="bg-[#0b1329] border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col h-full">
          <div className="absolute top-0 right-0 p-6 opacity-5"><Sparkles className="w-24 h-24 text-purple-400" /></div>
          <div className="relative z-10 space-y-4 flex-grow">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-3 h-3 rounded-full ${artistCoverage > 50 ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
              <h2 className="text-lg font-bold text-white">Artist Extractor (Gemini)</h2>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Artist Data</p>
              <p className="text-2xl font-black text-white tabular-nums">
                {artistCoverage}%
              </p>
              <p className="text-xs font-medium text-zinc-400 mt-1">{cardsWithArtist?.toLocaleString()} / {totalCards?.toLocaleString()} cards enriched</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 relative z-10 font-mono text-[11px] space-y-1.5 text-zinc-400">
            <div className="flex justify-between">
              <span>Artists Found</span>
              <span className="text-purple-400">{cardsWithArtist?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Unknown (Skipped)</span>
              <span className="text-zinc-500">{cardsWithUnknownArtist?.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#0b1329] border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col h-full">
          <div className="absolute top-0 right-0 p-6 opacity-5"><ImageIcon className="w-24 h-24 text-blue-400" /></div>
          <div className="relative z-10 space-y-4 flex-grow">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-3 h-3 rounded-full ${variantCoverage > 50 ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-pulse'}`} />
              <h2 className="text-lg font-bold text-white">Variant Mapping (Ollama)</h2>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Vision AI Sync Progress</p>
              <p className="text-2xl font-black text-white tabular-nums">
                {variantCoverage}%
              </p>
              <p className="text-xs font-medium text-zinc-400 mt-1">{mappedVariantsCount.toLocaleString()} / {totalEnVariants?.toLocaleString()} variants mapped</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 relative z-10 font-mono text-[11px] space-y-1.5 text-zinc-400">
            <div className="flex justify-between">
              <span>Variants Matched</span>
              <span className="text-blue-400">{mappedVariantsCount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Unmatched (Skipped)</span>
              <span className="text-zinc-500">{skippedVariantsCount.toLocaleString()}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
