import { dbQuery } from '@/lib/db/client';
import { Bot } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export async function GameScrapers() {
  type DiagnosticRow = {
    id: string;
    name: string;
    slug: string;
    total_cards: number;
    snkrdunk_configured: number;
    yuyutei_configured: number;
    cardrush_configured: number;
    tcgplayer_configured: number;
    heartbeats: Array<{ source: string; date: string | null; isHealthy: boolean }>;
  };

  let diagnostics: DiagnosticRow[] = [];
  try {
    diagnostics = await dbQuery<DiagnosticRow>(`
      SELECT
        g.id,
        g.name,
        g.slug,
        COUNT(c.id)::int AS total_cards,
        COUNT(c.id) FILTER (WHERE c.snkrdunk_url IS NOT NULL)::int AS snkrdunk_configured,
        COUNT(c.id) FILTER (WHERE c.yuyutei_url IS NOT NULL)::int AS yuyutei_configured,
        COUNT(c.id) FILTER (WHERE c.cardrush_url IS NOT NULL)::int AS cardrush_configured,
        COUNT(c.id) FILTER (WHERE c.tcg_player_id IS NOT NULL)::int AS tcgplayer_configured,
        COALESCE((
          SELECT json_agg(json_build_object(
            'source', sources.source_name,
            'date', latest.recorded_at,
            'isHealthy', COALESCE(latest.recorded_at >= NOW() - INTERVAL '24 hours', false)
          ) ORDER BY sources.source_name)
          FROM (VALUES
            ('snkrdunk'::text),
            ('yuyutei'::text),
            ('tcgplayer'::text),
            ('cardrush'::text)
          ) AS sources(source_name)
          LEFT JOIN LATERAL (
            SELECT ph.recorded_at
            FROM price_history ph
            WHERE ph.source::text = sources.source_name
            ORDER BY ph.recorded_at DESC NULLS LAST
            LIMIT 1
          ) latest ON true
        ), '[]'::json) AS heartbeats
      FROM games g
      LEFT JOIN sets s ON s.game_id = g.id
      LEFT JOIN cards c ON c.set_id = s.id
      GROUP BY g.id, g.name, g.slug
      ORDER BY g.name
    `);
  } catch (error) {
    console.error('Failed to load scraper diagnostics:', error);
  }

  const gameDiagnostics = diagnostics.map((game) => ({
    id: game.id,
    name: game.name,
    slug: game.slug,
    totalCards: game.total_cards || 0,
    config: {
      snkrdunk: game.snkrdunk_configured || 0,
      yuyutei: game.yuyutei_configured || 0,
      cardrush: game.cardrush_configured || 0,
      tcgplayer: game.tcgplayer_configured || 0,
    },
    heartbeats: (game.heartbeats || []).map((heartbeat) => ({
      source: heartbeat.source,
      date: heartbeat.date ? new Date(heartbeat.date) : null,
      isHealthy: heartbeat.isHealthy,
    })),
  }));

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
