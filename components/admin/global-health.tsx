import { dbQuery } from '@/lib/db/client';
import { Database, Trophy, Sparkles, Image as ImageIcon, BarChart3 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import fs from 'fs';
import path from 'path';

const STALE_PRICE_CUTOFF = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

export async function GlobalPlatformHealth() {
  type HealthRow = {
    total_cards: number;
    current_prices: number;
    cards_with_artist: number;
    cards_with_unknown_artist: number;
    total_tourneys: number;
    total_decks: number;
    stale_prices_count: number;
    latest_tourney_created_at: string | null;
    total_en_variants: number;
  };

  let health: HealthRow = {
    total_cards: 0,
    current_prices: 0,
    cards_with_artist: 0,
    cards_with_unknown_artist: 0,
    total_tourneys: 0,
    total_decks: 0,
    stale_prices_count: 0,
    latest_tourney_created_at: null,
    total_en_variants: 0,
  };

  try {
    health = (await dbQuery<HealthRow>(`
      SELECT
        (SELECT COUNT(*)::int FROM cards) AS total_cards,
        (SELECT COUNT(*)::int FROM card_price_current) AS current_prices,
        (SELECT COUNT(*)::int FROM cards WHERE artist IS NOT NULL AND artist <> 'Unknown') AS cards_with_artist,
        (SELECT COUNT(*)::int FROM cards WHERE artist = 'Unknown') AS cards_with_unknown_artist,
        (SELECT COUNT(*)::int FROM tournaments) AS total_tourneys,
        (SELECT COUNT(*)::int FROM decks) AS total_decks,
        (SELECT COUNT(*)::int FROM card_price_current WHERE computed_at < $1) AS stale_prices_count,
        (SELECT created_at FROM tournaments ORDER BY created_at DESC LIMIT 1) AS latest_tourney_created_at,
        (SELECT COUNT(*)::int FROM cards WHERE slug LIKE 'op-%_%' AND slug NOT LIKE '%-ja') AS total_en_variants
    `, [STALE_PRICE_CUTOFF]))[0] || health;
  } catch (error) {
    console.error('Failed to load platform health:', error);
  }

  const totalCards = health.total_cards;
  const currentPrices = health.current_prices;
  const cardsWithArtist = health.cards_with_artist;
  const cardsWithUnknownArtist = health.cards_with_unknown_artist;
  const totalTourneys = health.total_tourneys;
  const totalDecks = health.total_decks;
  const stalePricesCount = health.stale_prices_count;
  const latestTourneyDate = health.latest_tourney_created_at ? new Date(health.latest_tourney_created_at) : null;

  const priceCoverage = totalCards && totalCards > 0 ? Math.round(((currentPrices || 0) / totalCards) * 100) : 0;
  const artistCoverage = totalCards && totalCards > 0 ? Math.round(((cardsWithArtist || 0) / totalCards) * 100) : 0;

  const totalEnVariants = health.total_en_variants;

  let mappedVariantsCount = 0;
  let skippedVariantsCount = 0;
  try {
    const dictPath = path.join(process.cwd(), 'lib/price-engine/mapping-dictionary.json');
    if (fs.existsSync(dictPath)) {
      const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
      const values = Object.values(dict) as unknown[];
      mappedVariantsCount = values.filter((v) => v !== -1).length;
      skippedVariantsCount = values.filter((v) => v === -1).length;
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
              <h2 className="text-lg font-bold text-white">Current Price Integrity</h2>
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Live Database Coverage</p>
              <p className="text-2xl font-black text-white tabular-nums">
                {priceCoverage}%
              </p>
              <p className="text-xs font-medium text-zinc-400 mt-1">{currentPrices?.toLocaleString()} / {totalCards?.toLocaleString()} cards with current prices</p>
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
