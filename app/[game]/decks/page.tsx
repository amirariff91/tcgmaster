import { Metadata } from 'next';
import { dbQuery } from '@/lib/db/client';
import { Card, CardContent } from '@/components/ui/card';
import { FormattedPrice } from '@/components/ui/formatted-price';
import { Trophy, Calendar, Users, Target } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { resolveCardImageUrl } from '@/lib/images/cloudflare-loader';

export const metadata: Metadata = {
  title: 'Top Decks & Tournaments | TCGMaster',
  description: 'View the latest winning decklists and tournament results.',
};

export const revalidate = 60; // Revalidate every minute to keep meta fresh

// Next 16 only puts a dynamic segment on the ISR path when it declares
// generateStaticParams. Prerender nothing; generate and cache on first request.
export async function generateStaticParams() {
  return [];
}

type DeckLeader = {
  name: string;
  image_url: string | null;
  local_image_url: string | null;
};

type DeckRow = {
  id: string;
  placement: string;
  player_name: string | null;
  total_price: number | null;
  cards: DeckLeader | null;
};

type TournamentRow = {
  id: string;
  date: string;
  name: string;
  format: string | null;
  source_url: string | undefined;
  num_players: number | null;
};

export default async function DecksPage({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const { game } = await params;
  let deckRows: DeckRow[] = [];
  let tournamentRows: TournamentRow[] = [];

  try {
    // JOINs replace tournaments!inner(games!inner(...)) and cards(...).
    tournamentRows = await dbQuery<TournamentRow>(`
      SELECT t.id, t.date, t.name, t.format, t.source_url, t.num_players
      FROM tournaments t
      JOIN games g ON g.id = t.game_id
      WHERE g.slug = $1
      ORDER BY t.date DESC
      LIMIT 10
    `, [game]);

    deckRows = await dbQuery<DeckRow>(`
      SELECT
        d.id,
        d.placement,
        d.player_name,
        d.total_price::float8 AS total_price,
        CASE WHEN c.id IS NULL THEN NULL ELSE json_build_object(
          'name', c.name,
          'image_url', c.image_url,
          'local_image_url', c.local_image_url
        ) END AS cards
      FROM decks d
      JOIN tournaments t ON t.id = d.tournament_id
      JOIN games g ON g.id = t.game_id
      LEFT JOIN cards c ON c.id = d.leader_card_id
      WHERE g.slug = $1
        AND d.placement = ANY($2::text[])
      ORDER BY d.created_at DESC
      LIMIT 24
    `, [game, ['1st', '1', '2nd', '2', '3rd', '3', '4th', '4']]);
  } catch (error) {
    console.error('Failed to load deck page:', error);
  }

  return (
    <div className="min-h-screen bg-[#0b1329] text-white pt-24 pb-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 sm:gap-6 border-b border-white/10 pb-6 sm:pb-8">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-600 mb-1.5 sm:mb-2">
              COMPETITIVE META
            </h1>
            <p className="text-zinc-400 text-sm sm:text-base md:text-lg">
              The top performing decks from recent tournaments around the world.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-emerald-400 bg-emerald-400/10 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full border border-emerald-400/20 shadow-[0_0_15px_rgba(52,211,153,0.2)]">
            <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse" />
            Live Sync Active
          </div>
        </div>

        {/* Top Decks Grid (2-Lane on Mobile, 3 on Tablet, 4 on Desktop) */}
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5 sm:gap-3 mb-4 sm:mb-6 text-white">
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
            Recent Winning Decks
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 md:gap-6">
            {deckRows.map((deck) => (
              <Link key={deck.id} href={`/${game}/decks/${deck.id}`}>
                <Card className="group overflow-hidden rounded-xl sm:rounded-2xl border-white/10 bg-[#080e1e]/90 hover:bg-white/[0.07] transition-all duration-300 hover:-translate-y-1 hover:border-orange-500/30 hover:shadow-xl hover:shadow-orange-500/10 h-full flex flex-col">
                  {/* Leader Image Header */}
                  <div className="relative h-20 sm:h-28 md:h-32 w-full bg-black/60 overflow-hidden">
                    {(deck.cards?.image_url || deck.cards?.local_image_url) ? (
                      <Image
                        src={resolveCardImageUrl(deck.cards.local_image_url || deck.cards.image_url) ?? ''}
                        alt={deck.cards.name || 'Leader'}
                        fill
                        className="object-cover object-top opacity-75 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#080e1e] via-transparent to-transparent" />
                    
                    {/* Placement Badge */}
                    <div className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-black/80 backdrop-blur-md rounded-full border border-white/20 text-[10px] sm:text-xs font-bold flex items-center gap-1">
                      {deck.placement.includes('1') && <span>🥇</span>}
                      {deck.placement.includes('2') && <span>🥈</span>}
                      {deck.placement.includes('3') && <span>🥉</span>}
                      <span>{deck.placement}</span>
                    </div>
                  </div>

                  <CardContent className="flex-1 p-2.5 sm:p-3.5 md:p-4 flex flex-col justify-between">
                    <div className="mb-2 sm:mb-3">
                      <h3 className="font-bold text-xs sm:text-sm md:text-base leading-snug mb-1 truncate text-white group-hover:text-orange-400 transition-colors">
                        {deck.cards?.name || 'Unknown Leader'}
                      </h3>
                      <p className="text-[11px] sm:text-xs font-medium text-orange-400/90 truncate flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                        <span className="truncate">{deck.player_name || 'Anonymous'}</span>
                      </p>
                    </div>

                    <div className="pt-2 sm:pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-2 mt-auto">
                      <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Deck Value</span>
                      {deck.total_price ? (
                        <FormattedPrice price={deck.total_price} className="font-black text-emerald-400 text-xs sm:text-sm md:text-base" />
                      ) : (
                        <span className="text-[11px] sm:text-xs font-bold text-zinc-500">Syncing...</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}

            {deckRows.length === 0 && (
              <div className="col-span-full py-16 sm:py-20 text-center border border-dashed border-white/10 rounded-2xl bg-white/5">
                <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-zinc-600 mx-auto mb-3" />
                <h3 className="text-lg sm:text-xl font-bold text-zinc-400">No Decks Found</h3>
                <p className="text-xs sm:text-sm text-zinc-500 mt-1">Tournaments are currently being synced...</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Tournaments Table */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold flex items-center gap-3 mb-6 text-white">
            <Calendar className="w-6 h-6 text-blue-500" />
            Recent Tournaments
          </h2>
          
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-xs uppercase tracking-widest text-zinc-400 border-b border-white/10">
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold">Tournament Name</th>
                    <th className="p-4 font-semibold">Format</th>
                    <th className="p-4 font-semibold text-right">Players</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-sm">
                  {tournamentRows.map((t) => (
                    <tr key={t.id} className="hover:bg-white/5 transition-colors group">
                      <td className="p-4 text-zinc-400 whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString()}
                      </td>
                      <td className="p-4 font-medium text-white">
                        <a href={t.source_url ?? undefined} target="_blank" rel="noopener noreferrer" className="hover:text-orange-400 transition-colors">
                          {t.name}
                        </a>
                      </td>
                      <td className="p-4 text-zinc-400">
                        <span className="bg-zinc-800/50 px-2 py-1 rounded-md text-xs border border-zinc-700/50 group-hover:border-zinc-500 transition-colors">{t.format}</span>
                      </td>
                      <td className="p-4 text-right font-medium text-zinc-300 flex items-center justify-end gap-1.5">
                        <Users className="w-4 h-4 text-zinc-500" />
                        {t.num_players}
                      </td>
                    </tr>
                  ))}
                  {tournamentRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-zinc-500">
                        No tournaments recorded yet. Waiting for sync...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
